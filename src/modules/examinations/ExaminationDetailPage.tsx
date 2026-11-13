import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { PageSpinner } from '../../components/ui/Spinner'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { PrescriptionPrintView } from './PrescriptionPrintView'
import { useToast } from '../../contexts/ToastContext'
import {
  archiveExamination,
  createPrescription,
  getExaminationPrescriptions,
} from './ExaminationRepository'
import { PrescriptionFormSchema, type PrescriptionFormValues } from './schema'
import { logAudit } from '../../services/audit.service'
import { db } from '../../database/db'
import type { EyeExamination, Patient, Prescription } from '../../database/schema'
import i18n from 'i18next'

export function ExaminationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()
  const isAr = i18n.language === 'ar'
  const locale = isAr ? 'ar-SA' : 'en-US'

  const [exam, setExam] = useState<EyeExamination | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueForm, setIssueForm] = useState<Partial<PrescriptionFormValues>>({})
  const [issueErrors, setIssueErrors] = useState<Record<string, string>>({})
  const [issueSaving, setIssueSaving] = useState(false)
  const [printRx, setPrintRx] = useState<Prescription | null>(null)

  const load = async () => {
    if (!id) return
    const e = await db.eyeExaminations.get(id)
    if (!e) { navigate('/examinations', { replace: true }); return }
    setExam(e)
    const [p, rxs] = await Promise.all([
      db.patients.get(e.patientId),
      getExaminationPrescriptions(id, db),
    ])
    setPatient(p ?? null)
    setPrescriptions(rxs)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })

  const fmtNum = (n: number | undefined) =>
    n !== undefined ? (n >= 0 ? `+${n}` : String(n)) : '—'

  const handleArchive = async () => {
    if (!exam) return
    try {
      await archiveExamination(exam.id, db)
      await logAudit({ action: 'delete', entityType: 'EyeExamination', entityId: exam.id, before: exam, db })
      toast(t('examinations.archiveSuccess'), 'success')
      navigate('/examinations')
    } catch {
      toast(t('common.error'), 'error')
    }
  }

  const openIssueDialog = () => {
    if (!exam) return
    setIssueForm({
      prescriptionDate: new Date().toISOString().slice(0, 10),
      examinedBy: exam.examinedBy ?? '',
      reSphere: exam.reSphere, reCylinder: exam.reCylinder, reAxis: exam.reAxis, reAdd: exam.reAdd,
      rePrismPower: exam.rePrismPower, rePrismBase: exam.rePrismBase,
      reVA: exam.visualAcuityRight,
      rePd: exam.rePd,
      leSphere: exam.leSphere, leCylinder: exam.leCylinder, leAxis: exam.leAxis, leAdd: exam.leAdd,
      lePrismPower: exam.lePrismPower, lePrismBase: exam.lePrismBase,
      leVA: exam.visualAcuityLeft,
      lePd: exam.lePd,
      pdDistance: exam.pdDistance, pdNear: exam.pdNear,
    })
    setIssueOpen(true)
  }

  const handleIssuePrescription = async () => {
    if (!exam || !patient) return
    const data = {
      prescriptionDate: issueForm.prescriptionDate ?? new Date().toISOString().slice(0, 10),
      examinedBy: issueForm.examinedBy,
      validUntil: issueForm.validUntil,
      reSphere: issueForm.reSphere, reCylinder: issueForm.reCylinder, reAxis: issueForm.reAxis, reAdd: issueForm.reAdd,
      rePrismPower: issueForm.rePrismPower, rePrismBase: issueForm.rePrismBase,
      reVA: issueForm.reVA, rePd: issueForm.rePd,
      leSphere: issueForm.leSphere, leCylinder: issueForm.leCylinder, leAxis: issueForm.leAxis, leAdd: issueForm.leAdd,
      lePrismPower: issueForm.lePrismPower, lePrismBase: issueForm.lePrismBase,
      leVA: issueForm.leVA, lePd: issueForm.lePd,
      pdDistance: issueForm.pdDistance, pdNear: issueForm.pdNear,
      lensType: issueForm.lensType, notes: issueForm.notes,
    }
    const result = PrescriptionFormSchema.safeParse(data)
    if (!result.success) {
      const errs: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? '')
        if (key) errs[key] = issue.message
      }
      setIssueErrors(errs)
      return
    }
    setIssueSaving(true)
    try {
      const rx = await createPrescription({ ...result.data, patientId: patient.id, examinationId: exam.id }, db)
      await logAudit({ action: 'create', entityType: 'Prescription', entityId: rx.id, after: rx, db })
      toast(t('examinations.prescription.issued'), 'success')
      setIssueOpen(false)
      await load()
    } catch (err) {
      toast(`${t('common.error')}: ${String(err)}`, 'error')
    } finally {
      setIssueSaving(false)
    }
  }

  if (loading) return <PageSpinner />
  if (!exam || !patient) return null

  const examTypeColor: Record<string, 'blue' | 'green' | 'purple' | 'yellow'> = {
    comprehensive: 'blue', distance: 'green', near: 'purple', recheck: 'yellow',
  }

  const MeasurementRow = ({ label, od, os }: { label: string; od: string; os: string }) => (
    <tr className="border-b border-slate-100 dark:border-slate-700 last:border-0">
      <td className="py-2 px-3 text-xs font-bold text-slate-500 uppercase w-20">{label}</td>
      <td className="py-2 px-3 text-sm font-mono text-center" dir="ltr">{od}</td>
      <td className="py-2 px-3 text-sm font-mono text-center" dir="ltr">{os}</td>
    </tr>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">

      {/* Print view (hidden on screen) */}
      {printRx && (
        <PrescriptionPrintView patient={patient} examination={exam} prescription={printRx} />
      )}

      {/* Back */}
      <button onClick={() => navigate(-1)}
        className="no-print mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
        ← {t('examinations.title')}
      </button>

      {/* Header card */}
      <div className="no-print bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{exam.examinationNumber}</span>
              <Badge variant={examTypeColor[exam.examType] ?? 'blue'}>{t(`examinations.${exam.examType}`)}</Badge>
              {exam.deletedAt && <Badge variant="yellow">{t('common.archived')}</Badge>}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-0.5">
              <div>
                <span className="font-semibold">{patient.fullName}</span>
                <span className="text-slate-400 ms-2 font-mono text-xs">{patient.fileNumber}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>📅 {fmtDate(exam.examinationDate)}</span>
                {exam.examinedBy && <span>👤 {exam.examinedBy}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm"
              onClick={() => navigate(`/patients/${patient.id}`)}>
              {t('patients.title')}
            </Button>
            {!exam.deletedAt && (
              <>
                <Button variant="secondary" size="sm"
                  onClick={() => navigate(`/examinations/${exam.id}/edit`)}>
                  {t('common.edit')}
                </Button>
                <Button variant="ghost" size="sm" onClick={openIssueDialog}>
                  📄 {t('examinations.prescription.issue')}
                </Button>
                <Button variant="danger" size="sm" onClick={() => setArchiveOpen(true)}>
                  {t('common.archive')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">

        {/* Measurements table */}
        <div className="no-print bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('examinations.measurements')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 px-3 text-xs text-slate-400 font-medium text-start w-20"></th>
                  <th className="py-2 px-3 text-center">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">OD</span>
                  </th>
                  <th className="py-2 px-3 text-center">
                    <span className="text-xs font-bold text-green-600 dark:text-green-400">OS</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <MeasurementRow label="SPH"  od={fmtNum(exam.reSphere)}   os={fmtNum(exam.leSphere)} />
                <MeasurementRow label="CYL"  od={fmtNum(exam.reCylinder)} os={fmtNum(exam.leCylinder)} />
                <MeasurementRow label="AXIS" od={exam.reAxis !== undefined ? String(exam.reAxis) : '—'} os={exam.leAxis !== undefined ? String(exam.leAxis) : '—'} />
                <MeasurementRow label="ADD"  od={fmtNum(exam.reAdd)}      os={fmtNum(exam.leAdd)} />
                {(exam.rePrismPower !== undefined || exam.lePrismPower !== undefined) && (
                  <MeasurementRow label="PRISM"
                    od={exam.rePrismPower !== undefined ? `${exam.rePrismPower}Δ${exam.rePrismBase ? ` ${exam.rePrismBase}` : ''}` : '—'}
                    os={exam.lePrismPower !== undefined ? `${exam.lePrismPower}Δ${exam.lePrismBase ? ` ${exam.lePrismBase}` : ''}` : '—'} />
                )}
                <MeasurementRow label="VA"
                  od={exam.visualAcuityRight ?? '—'}
                  os={exam.visualAcuityLeft ?? '—'} />
              </tbody>
            </table>
          </div>
        </div>

        {/* PD + VA */}
        <div className="no-print bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">{t('examinations.pd')}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {exam.pdDistance !== undefined && (
              <div><p className="text-xs text-slate-400">{t('examinations.pdBinocular')}</p>
                <p className="font-mono font-semibold" dir="ltr">{exam.pdDistance} mm</p></div>
            )}
            {exam.pdNear !== undefined && (
              <div><p className="text-xs text-slate-400">{t('examinations.pdNear')}</p>
                <p className="font-mono font-semibold" dir="ltr">{exam.pdNear} mm</p></div>
            )}
            {exam.rePd !== undefined && (
              <div><p className="text-xs text-slate-400">{t('examinations.pdMonocularRight')}</p>
                <p className="font-mono font-semibold" dir="ltr">{exam.rePd} mm</p></div>
            )}
            {exam.lePd !== undefined && (
              <div><p className="text-xs text-slate-400">{t('examinations.pdMonocularLeft')}</p>
                <p className="font-mono font-semibold" dir="ltr">{exam.lePd} mm</p></div>
            )}
          </div>

          {(exam.unaidedVARight || exam.unaidedVALeft || exam.bcvaRight || exam.bcvaLeft) && (
            <>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-4 mb-3">{t('examinations.visualAcuity')}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {(exam.unaidedVARight || exam.unaidedVALeft) && (
                  <>
                    {exam.unaidedVARight && <div><p className="text-xs text-slate-400">{t('examinations.unaidedVA')} OD</p><p className="font-mono font-semibold" dir="ltr">{exam.unaidedVARight}</p></div>}
                    {exam.unaidedVALeft && <div><p className="text-xs text-slate-400">{t('examinations.unaidedVA')} OS</p><p className="font-mono font-semibold" dir="ltr">{exam.unaidedVALeft}</p></div>}
                  </>
                )}
                {(exam.bcvaRight || exam.bcvaLeft) && (
                  <>
                    {exam.bcvaRight && <div><p className="text-xs text-slate-400">{t('examinations.bcva')} OD</p><p className="font-mono font-semibold" dir="ltr">{exam.bcvaRight}</p></div>}
                    {exam.bcvaLeft && <div><p className="text-xs text-slate-400">{t('examinations.bcva')} OS</p><p className="font-mono font-semibold" dir="ltr">{exam.bcvaLeft}</p></div>}
                  </>
                )}
              </div>
            </>
          )}

          {exam.notes && (
            <div className="mt-4">
              <p className="text-xs text-slate-400 mb-1">{t('examinations.notes')}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{exam.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Prescriptions */}
      <div className="no-print bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {t('examinations.prescription.title')} ({prescriptions.length})
          </h2>
          {!exam.deletedAt && (
            <Button variant="ghost" size="sm" onClick={openIssueDialog}>
              + {t('examinations.prescription.issue')}
            </Button>
          )}
        </div>
        {prescriptions.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">{t('examinations.prescription.noPrescription')}</p>
        ) : (
          <div className="space-y-3">
            {prescriptions.map(rx => (
              <div key={rx.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">{rx.prescriptionNumber}</span>
                  <span className="text-xs text-slate-500 ms-2">
                    {new Date(rx.prescriptionDate).toLocaleDateString(locale)}
                  </span>
                </div>
                <Button variant="secondary" size="sm"
                  icon={<span>🖨</span>}
                  onClick={() => { setPrintRx(rx); setTimeout(() => window.print(), 100) }}>
                  {t('examinations.prescription.print')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Archive confirm */}
      <ConfirmDialog
        open={archiveOpen}
        title={t('examinations.archiveConfirm')}
        description={t('examinations.archiveWarning')}
        confirmLabel={t('common.archive')}
        danger
        onConfirm={handleArchive}
        onCancel={() => setArchiveOpen(false)}
      />

      {/* Issue Prescription Dialog */}
      {issueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-lg shadow-xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {t('examinations.prescription.issue')}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{t('examinations.prescription.date')} *</label>
                  <input type="date" dir="ltr" value={issueForm.prescriptionDate ?? ''}
                    onChange={e => setIssueForm((p: Partial<PrescriptionFormValues>) => ({ ...p, prescriptionDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {issueErrors.prescriptionDate && <p className="text-xs text-red-500 mt-0.5">{issueErrors.prescriptionDate}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{t('examinations.prescription.validUntil')}</label>
                  <input type="date" dir="ltr" value={issueForm.validUntil ?? ''}
                    onChange={e => setIssueForm((p: Partial<PrescriptionFormValues>) => ({ ...p, validUntil: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{t('examinations.examinedBy')}</label>
                <input type="text" value={issueForm.examinedBy ?? ''}
                  onChange={e => setIssueForm((p: Partial<PrescriptionFormValues>) => ({ ...p, examinedBy: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{t('examinations.notes')}</label>
                <textarea value={issueForm.notes ?? ''} rows={2}
                  onChange={e => setIssueForm((p: Partial<PrescriptionFormValues>) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <p className="text-xs text-slate-400">{t('examinations.prescription.prefilled')}</p>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <Button variant="secondary" onClick={() => { setIssueOpen(false); setIssueErrors({}) }}>{t('common.cancel')}</Button>
              <Button onClick={handleIssuePrescription} loading={issueSaving}>{t('examinations.prescription.issue')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
