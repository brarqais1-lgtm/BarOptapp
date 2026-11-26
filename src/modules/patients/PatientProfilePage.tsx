import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { PageSpinner } from '../../components/ui/Spinner'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { OverviewTab } from './tabs/OverviewTab'
import { NotesTab } from './tabs/NotesTab'
import { ExaminationsTab } from './tabs/ExaminationsTab'
import { MedicalHistoryTab } from './tabs/MedicalHistoryTab'
import { SalesTab } from './tabs/SalesTab'
import { PatientPaymentsTab } from './tabs/PatientPaymentsTab'
import { GlassesSaleModal } from '../sales/GlassesSaleModal'
import { PrintView } from './PrintView'
import { useToast } from '../../contexts/ToastContext'
import { archivePatient, restorePatient, updatePatient } from './PatientRepository'
import { getPatientFinancialSummary, type PatientFinancialSummary } from './financial.service'
import { logAudit } from '../../services/audit.service'
import { db } from '../../database/db'
import type { Patient } from '../../database/schema'
import i18n from 'i18next'
import { normalizePhone, normalizeSearch } from '../../utils/format'

type TabId = 'overview' | 'examinations' | 'medicalHistory' | 'purchases' | 'payments' | 'notes'

export function PatientProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US'

  const [patient, setPatient] = useState<Patient | null>(null)
  const [financial, setFinancial] = useState<PatientFinancialSummary>({
    totalSalesAmount: 0, totalDiscounts: 0, totalPaid: 0, totalBalance: 0, purchaseCount: 0,
  })
  const [examinationCount, setExaminationCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [tabRefreshKey, setTabRefreshKey] = useState(0)

  const load = async () => {
    if (!id) return
    const p = await db.patients.get(id)
    if (!p) { navigate('/patients', { replace: true }); return }
    setPatient(p)
    const [fin, examCount] = await Promise.all([
      getPatientFinancialSummary(id, db),
      db.eyeExaminations.where('patientId').equals(id).count(),
    ])
    setFinancial(fin)
    setExaminationCount(examCount)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const handleArchive = async () => {
    if (!patient) return
    try {
      await archivePatient(patient.id, db)
      await logAudit({ action: 'delete', entityType: 'Patient', entityId: patient.id, before: patient, db })
      toast(t('patients.archiveSuccess'), 'success')
      navigate('/patients')
    } catch {
      toast(t('common.error'), 'error')
    }
  }

  const handleRestore = async () => {
    if (!patient) return
    try {
      await restorePatient(patient.id, db)
      await logAudit({ action: 'restore', entityType: 'Patient', entityId: patient.id, db })
      toast(t('patients.restoreSuccess'), 'success')
      load()
    } catch {
      toast(t('common.error'), 'error')
    }
  }

  const handleSaveNotes = async (notes: string) => {
    if (!patient) return
    const updated = await updatePatient(patient.id, {
      notes,
      fullNameNormalized: normalizeSearch(patient.fullName),
      phoneNormalized: patient.phone ? normalizePhone(patient.phone) : undefined,
    }, db)
    setPatient(updated)
    toast(t('common.success'), 'success')
  }

  const handlePrint = () => window.print()

  if (loading) return <PageSpinner />
  if (!patient) return null

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview',        label: t('patients.tabs.overview') },
    { id: 'examinations',    label: t('patients.tabs.examinations') },
    { id: 'medicalHistory',  label: t('patients.tabs.medicalHistory') },
    { id: 'purchases',       label: t('patients.tabs.purchases') },
    { id: 'payments',        label: t('patients.tabs.payments') },
    { id: 'notes',           label: t('patients.tabs.notes') },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Print view — hidden on screen, shown on print */}
      <PrintView patient={patient} financial={financial} examinationCount={examinationCount} />

      {/* Back button */}
      <button
        onClick={() => navigate('/patients')}
        className="no-print mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
      >
        ← {t('patients.title')}
      </button>

      {/* Patient header */}
      <div className="no-print bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 mb-5">
        {/* Top row: avatar + info */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xl shrink-0">
            {patient.fullName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">{patient.fullName}</h1>
              {patient.deletedAt && <Badge variant="yellow">{t('common.archived')}</Badge>}
              {patient.gender && <Badge variant="blue">{t(`patients.${patient.gender}`)}</Badge>}
            </div>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{patient.fileNumber}</span>
              {patient.phone && <span dir="ltr">{patient.phone}</span>}
              <span>{fmtDate(patient.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Actions row — always below info on mobile */}
        <div className="flex gap-2 flex-wrap mt-4 justify-end">
          {!patient.deletedAt && (
            <Button size="sm" icon={<span>🕶</span>} onClick={() => setShowSaleModal(true)}>
              بيع نظارة
            </Button>
          )}
          <Button variant="secondary" size="sm" icon={<span>🖨</span>} onClick={handlePrint}>
            {t('common.print')}
          </Button>
          <Button variant="secondary" size="sm" icon={<span>✏️</span>} onClick={() => navigate(`/patients/${patient.id}/edit`)}>
            {t('common.edit')}
          </Button>
          {patient.deletedAt ? (
            <Button variant="secondary" size="sm" onClick={handleRestore}>
              {t('common.restore')}
            </Button>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setArchiveDialogOpen(true)}>
              {t('common.archive')}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="no-print">
        <div className="overflow-x-auto pb-1 mb-5 -mx-1 px-1">
          <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-900 rounded-2xl p-1 min-w-max w-full">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap min-w-[72px] ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 min-h-64 overflow-hidden">
          {activeTab === 'overview' && (
            <OverviewTab
              patient={patient}
              financial={financial}
              examinationCount={examinationCount}
              locale={locale}
            />
          )}
          {activeTab === 'examinations' && (
            <ExaminationsTab
              patient={patient}
              onExamCountChange={setExaminationCount}
            />
          )}
          {activeTab === 'medicalHistory' && (
            <MedicalHistoryTab patient={patient} />
          )}
          {activeTab === 'purchases' && <SalesTab patient={patient} refreshKey={tabRefreshKey} />}
          {activeTab === 'payments' && <PatientPaymentsTab patient={patient} refreshKey={tabRefreshKey} />}
          {activeTab === 'notes' && (
            <NotesTab notes={patient.notes ?? ''} onSave={handleSaveNotes} />
          )}
        </div>
      </div>

      {/* Glasses sale modal */}
      {showSaleModal && (
        <GlassesSaleModal
          patient={patient}
          onClose={() => setShowSaleModal(false)}
          onComplete={() => {
            setShowSaleModal(false)
            setTabRefreshKey(k => k + 1)
            setActiveTab('purchases')
          }}
        />
      )}

      {/* Archive confirm */}
      <ConfirmDialog
        open={archiveDialogOpen}
        title={t('patients.archiveConfirm')}
        description={t('patients.archiveWarning')}
        confirmLabel={t('common.archive')}
        danger
        onConfirm={handleArchive}
        onCancel={() => setArchiveDialogOpen(false)}
      />
    </div>
  )
}
