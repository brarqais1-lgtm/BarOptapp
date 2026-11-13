import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../contexts/ToastContext'
import {
  getMedicalHistory,
  getOcularHistory,
  getPatientSymptoms,
  upsertMedicalHistory,
  upsertOcularHistory,
  addSymptom,
  archiveSymptom,
} from '../../medicalHistory/MedicalHistoryRepository'
import {
  MedicalHistoryFormSchema,
  OcularHistoryFormSchema,
  SymptomFormSchema,
  type MedicalHistoryFormValues,
  type OcularHistoryFormValues,
  type SymptomFormValues,
} from '../../medicalHistory/schema'
import { db } from '../../../database/db'
import type { PatientMedicalHistory, PatientOcularHistory, PatientSymptom, Patient } from '../../../database/schema'
import i18n from 'i18next'

interface Props {
  patient: Patient
}

type Modal = 'medical' | 'ocular' | 'symptom' | null

const SYMPTOM_TYPES = [
  'blurry_vision', 'headache', 'eye_strain',
  'near_difficulty', 'far_difficulty',
  'photophobia', 'dry_eye', 'other',
] as const

function TagList({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-slate-400 text-sm">—</span>
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {items.map((item, i) => (
        <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs">{item}</span>
      ))}
    </div>
  )
}

function SectionHeader({ title, onEdit }: { title: string; onEdit: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{title}</h3>
      <button onClick={onEdit} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">{t('common.edit')}</button>
    </div>
  )
}

function ArrayTextarea({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
      <p className="text-xs text-slate-400 mt-0.5">{i18n.language === 'ar' ? 'سطر لكل عنصر' : 'One per line'}</p>
    </div>
  )
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-blue-600" />
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
    </label>
  )
}

function arrToText(arr: string[]) { return arr.join('\n') }
function textToArr(text: string) { return text.split('\n').map(s => s.trim()).filter(Boolean) }

export function MedicalHistoryTab({ patient }: Props) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const isAr = i18n.language === 'ar'
  const locale = isAr ? 'ar-SA' : 'en-US'

  const [medical, setMedical] = useState<PatientMedicalHistory | undefined>()
  const [ocular, setOcular] = useState<PatientOcularHistory | undefined>()
  const [symptoms, setSymptoms] = useState<PatientSymptom[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Modal>(null)
  const [saving, setSaving] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null)

  // Medical form state
  const [mForm, setMForm] = useState({
    chronicConditions: '', hasDiabetes: false, hasHypertension: false,
    allergies: '', medications: '', previousSurgeries: '', additionalNotes: '',
  })
  // Ocular form state
  const [oForm, setOForm] = useState({
    previousEyeConditions: '', eyeSurgeries: '', eyeInjuries: '',
    previousGlasses: false, previousContactLenses: false,
    lastEyeExamDate: '', familyEyeHistory: '', additionalNotes: '',
  })
  // Symptom form state
  const [sForm, setSForm] = useState<SymptomFormValues>({
    symptomType: 'blurry_vision', eye: 'OU', onsetDate: '', description: '',
  })
  const [sErrors, setSErrors] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    const [m, o, s] = await Promise.all([
      getMedicalHistory(patient.id, db),
      getOcularHistory(patient.id, db),
      getPatientSymptoms(patient.id, db),
    ])
    setMedical(m)
    setOcular(o)
    setSymptoms(s)
    setLoading(false)
  }

  useEffect(() => { load() }, [patient.id])

  const openMedical = () => {
    setMForm({
      chronicConditions: arrToText(medical?.chronicConditions ?? []),
      hasDiabetes: medical?.hasDiabetes ?? false,
      hasHypertension: medical?.hasHypertension ?? false,
      allergies: arrToText(medical?.allergies ?? []),
      medications: arrToText(medical?.medications ?? []),
      previousSurgeries: arrToText(medical?.previousSurgeries ?? []),
      additionalNotes: medical?.additionalNotes ?? '',
    })
    setModal('medical')
  }

  const openOcular = () => {
    setOForm({
      previousEyeConditions: arrToText(ocular?.previousEyeConditions ?? []),
      eyeSurgeries: arrToText(ocular?.eyeSurgeries ?? []),
      eyeInjuries: arrToText(ocular?.eyeInjuries ?? []),
      previousGlasses: ocular?.previousGlasses ?? false,
      previousContactLenses: ocular?.previousContactLenses ?? false,
      lastEyeExamDate: ocular?.lastEyeExamDate ?? '',
      familyEyeHistory: ocular?.familyEyeHistory ?? '',
      additionalNotes: ocular?.additionalNotes ?? '',
    })
    setModal('ocular')
  }

  const handleSaveMedical = async () => {
    const parsed = MedicalHistoryFormSchema.safeParse({
      chronicConditions: textToArr(mForm.chronicConditions),
      hasDiabetes: mForm.hasDiabetes,
      hasHypertension: mForm.hasHypertension,
      allergies: textToArr(mForm.allergies),
      medications: textToArr(mForm.medications),
      previousSurgeries: textToArr(mForm.previousSurgeries),
      additionalNotes: mForm.additionalNotes || undefined,
    })
    if (!parsed.success) return
    setSaving(true)
    try {
      const result = await upsertMedicalHistory(patient.id, parsed.data as MedicalHistoryFormValues, db)
      setMedical(result)
      setModal(null)
      toast(t('medicalHistory.saveSuccess'), 'success')
    } catch {
      toast(t('common.error'), 'error')
    } finally { setSaving(false) }
  }

  const handleSaveOcular = async () => {
    const parsed = OcularHistoryFormSchema.safeParse({
      previousEyeConditions: textToArr(oForm.previousEyeConditions),
      eyeSurgeries: textToArr(oForm.eyeSurgeries),
      eyeInjuries: textToArr(oForm.eyeInjuries),
      previousGlasses: oForm.previousGlasses,
      previousContactLenses: oForm.previousContactLenses,
      lastEyeExamDate: oForm.lastEyeExamDate || undefined,
      familyEyeHistory: oForm.familyEyeHistory || undefined,
      additionalNotes: oForm.additionalNotes || undefined,
    })
    if (!parsed.success) return
    setSaving(true)
    try {
      const result = await upsertOcularHistory(patient.id, parsed.data as OcularHistoryFormValues, db)
      setOcular(result)
      setModal(null)
      toast(t('medicalHistory.saveSuccess'), 'success')
    } catch {
      toast(t('common.error'), 'error')
    } finally { setSaving(false) }
  }

  const handleAddSymptom = async () => {
    const parsed = SymptomFormSchema.safeParse({
      ...sForm,
      onsetDate: sForm.onsetDate || undefined,
      description: sForm.description || undefined,
    })
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      parsed.error.issues.forEach(e => { if (e.path.length) errs[String(e.path[0])] = e.message })
      setSErrors(errs)
      return
    }
    setSErrors({})
    setSaving(true)
    try {
      const result = await addSymptom(patient.id, parsed.data, db)
      setSymptoms(prev => [result, ...prev])
      setModal(null)
      toast(t('medicalHistory.symptomAdded'), 'success')
    } catch {
      toast(t('common.error'), 'error')
    } finally { setSaving(false) }
  }

  const handleArchiveSymptom = async (id: string) => {
    await archiveSymptom(id, db)
    setSymptoms(prev => prev.filter(s => s.id !== id))
    setArchiveTarget(null)
    toast(t('medicalHistory.symptomRemoved'), 'success')
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <span className="text-sm">{t('common.loading')}</span>
      </div>
    )
  }

  const hasAnyMedical = medical && (
    medical.chronicConditions.length > 0 || medical.hasDiabetes || medical.hasHypertension ||
    medical.allergies.length > 0 || medical.medications.length > 0 || medical.previousSurgeries.length > 0 ||
    medical.additionalNotes
  )
  const hasAnyOcular = ocular && (
    ocular.previousEyeConditions.length > 0 || ocular.eyeSurgeries.length > 0 ||
    ocular.eyeInjuries.length > 0 || ocular.previousGlasses || ocular.previousContactLenses ||
    ocular.lastEyeExamDate || ocular.familyEyeHistory || ocular.additionalNotes
  )

  const symptomLabel = (type: string) => t(`medicalHistory.symptoms.${type}`)
  const eyeLabel = (eye: string) => eye

  return (
    <div className="p-5 space-y-6">

      {/* ── Medical History Section ── */}
      <div>
        <SectionHeader title={t('medicalHistory.medicalTitle')} onEdit={openMedical} />
        {hasAnyMedical ? (
          <div className="space-y-3">
            {(medical.hasDiabetes || medical.hasHypertension) && (
              <div className="flex flex-wrap gap-2">
                {medical.hasDiabetes && <Badge variant="red">{t('medicalHistory.diabetes')}</Badge>}
                {medical.hasHypertension && <Badge variant="yellow">{t('medicalHistory.hypertension')}</Badge>}
              </div>
            )}
            {medical.chronicConditions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('medicalHistory.chronicConditions')}</p>
                <TagList items={medical.chronicConditions} />
              </div>
            )}
            {medical.allergies.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('medicalHistory.allergies')}</p>
                <TagList items={medical.allergies} />
              </div>
            )}
            {medical.medications.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('medicalHistory.medications')}</p>
                <TagList items={medical.medications} />
              </div>
            )}
            {medical.previousSurgeries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('medicalHistory.surgeries')}</p>
                <TagList items={medical.previousSurgeries} />
              </div>
            )}
            {medical.additionalNotes && (
              <p className="text-sm text-slate-600 dark:text-slate-400 italic">{medical.additionalNotes}</p>
            )}
            <p className="text-xs text-slate-400">{t('medicalHistory.lastUpdated')}: {fmtDate(medical.updatedAt)}</p>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400">
            <p className="text-sm">{t('medicalHistory.noMedical')}</p>
            <button onClick={openMedical} className="text-xs text-blue-500 hover:underline mt-1">{t('medicalHistory.addMedical')}</button>
          </div>
        )}
      </div>

      <hr className="border-slate-200 dark:border-slate-700" />

      {/* ── Ocular History Section ── */}
      <div>
        <SectionHeader title={t('medicalHistory.ocularTitle')} onEdit={openOcular} />
        {hasAnyOcular ? (
          <div className="space-y-3">
            {(ocular.previousGlasses || ocular.previousContactLenses) && (
              <div className="flex flex-wrap gap-2">
                {ocular.previousGlasses && <Badge variant="blue">{t('medicalHistory.woreGlasses')}</Badge>}
                {ocular.previousContactLenses && <Badge variant="teal">{t('medicalHistory.woreContacts')}</Badge>}
              </div>
            )}
            {ocular.previousEyeConditions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('medicalHistory.eyeConditions')}</p>
                <TagList items={ocular.previousEyeConditions} />
              </div>
            )}
            {ocular.eyeSurgeries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('medicalHistory.eyeSurgeries')}</p>
                <TagList items={ocular.eyeSurgeries} />
              </div>
            )}
            {ocular.eyeInjuries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('medicalHistory.eyeInjuries')}</p>
                <TagList items={ocular.eyeInjuries} />
              </div>
            )}
            {ocular.lastEyeExamDate && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('medicalHistory.lastExamDate')}: <span className="font-medium" dir="ltr">{ocular.lastEyeExamDate}</span>
              </p>
            )}
            {ocular.familyEyeHistory && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('medicalHistory.familyHistory')}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{ocular.familyEyeHistory}</p>
              </div>
            )}
            {ocular.additionalNotes && (
              <p className="text-sm text-slate-600 dark:text-slate-400 italic">{ocular.additionalNotes}</p>
            )}
            <p className="text-xs text-slate-400">{t('medicalHistory.lastUpdated')}: {fmtDate(ocular.updatedAt)}</p>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400">
            <p className="text-sm">{t('medicalHistory.noOcular')}</p>
            <button onClick={openOcular} className="text-xs text-blue-500 hover:underline mt-1">{t('medicalHistory.addOcular')}</button>
          </div>
        )}
      </div>

      <hr className="border-slate-200 dark:border-slate-700" />

      {/* ── Current Symptoms Section ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            {t('medicalHistory.symptomsTitle')}
          </h3>
          <button onClick={() => { setSForm({ symptomType: 'blurry_vision', eye: 'OU', onsetDate: '', description: '' }); setSErrors({}); setModal('symptom') }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            + {t('medicalHistory.addSymptom')}
          </button>
        </div>
        {symptoms.length > 0 ? (
          <div className="space-y-2">
            {symptoms.map(s => (
              <div key={s.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    <Badge variant="blue">{symptomLabel(s.symptomType)}</Badge>
                    <Badge variant="gray">{eyeLabel(s.eye)}</Badge>
                    {s.onsetDate && <span className="text-xs text-slate-400" dir="ltr">{s.onsetDate}</span>}
                  </div>
                  {s.description && <p className="text-sm text-slate-600 dark:text-slate-400">{s.description}</p>}
                </div>
                <button
                  onClick={() => setArchiveTarget(s.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors text-xs shrink-0 mt-0.5"
                  title={t('common.archive')}
                >✕</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400">
            <p className="text-sm">{t('medicalHistory.noSymptoms')}</p>
          </div>
        )}
      </div>

      {/* ── Medical History Modal ── */}
      {modal === 'medical' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">{t('medicalHistory.medicalTitle')}</h2>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <CheckField label={t('medicalHistory.diabetes')} checked={mForm.hasDiabetes} onChange={v => setMForm(p => ({ ...p, hasDiabetes: v }))} />
                <CheckField label={t('medicalHistory.hypertension')} checked={mForm.hasHypertension} onChange={v => setMForm(p => ({ ...p, hasHypertension: v }))} />
              </div>
              <ArrayTextarea label={t('medicalHistory.chronicConditions')} value={mForm.chronicConditions}
                onChange={v => setMForm(p => ({ ...p, chronicConditions: v }))}
                placeholder={isAr ? 'ضغط دم\nسكري نوع 2' : 'Hypertension\nType 2 Diabetes'} />
              <ArrayTextarea label={t('medicalHistory.allergies')} value={mForm.allergies}
                onChange={v => setMForm(p => ({ ...p, allergies: v }))}
                placeholder={isAr ? 'بنسلين\nغبار' : 'Penicillin\nDust'} />
              <ArrayTextarea label={t('medicalHistory.medications')} value={mForm.medications}
                onChange={v => setMForm(p => ({ ...p, medications: v }))}
                placeholder={isAr ? 'ميتفورمين 500mg\nأسبرين 100mg' : 'Metformin 500mg\nAspirin 100mg'} />
              <ArrayTextarea label={t('medicalHistory.surgeries')} value={mForm.previousSurgeries}
                onChange={v => setMForm(p => ({ ...p, previousSurgeries: v }))} />
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{t('medicalHistory.additionalNotes')}</label>
                <textarea value={mForm.additionalNotes} rows={2}
                  onChange={e => setMForm(p => ({ ...p, additionalNotes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <Button variant="secondary" onClick={() => setModal(null)}>{t('common.cancel')}</Button>
              <Button onClick={handleSaveMedical} loading={saving}>{t('common.save')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ocular History Modal ── */}
      {modal === 'ocular' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">{t('medicalHistory.ocularTitle')}</h2>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <CheckField label={t('medicalHistory.previousGlasses')} checked={oForm.previousGlasses} onChange={v => setOForm(p => ({ ...p, previousGlasses: v }))} />
                <CheckField label={t('medicalHistory.previousContacts')} checked={oForm.previousContactLenses} onChange={v => setOForm(p => ({ ...p, previousContactLenses: v }))} />
              </div>
              <ArrayTextarea label={t('medicalHistory.eyeConditions')} value={oForm.previousEyeConditions}
                onChange={v => setOForm(p => ({ ...p, previousEyeConditions: v }))}
                placeholder={isAr ? 'مياه بيضاء\nضغط العين' : 'Cataract\nGlaucoma'} />
              <ArrayTextarea label={t('medicalHistory.eyeSurgeries')} value={oForm.eyeSurgeries}
                onChange={v => setOForm(p => ({ ...p, eyeSurgeries: v }))}
                placeholder={isAr ? 'عملية الليزك\nعملية مياه بيضاء' : 'LASIK\nCataract surgery'} />
              <ArrayTextarea label={t('medicalHistory.eyeInjuries')} value={oForm.eyeInjuries}
                onChange={v => setOForm(p => ({ ...p, eyeInjuries: v }))} />
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{t('medicalHistory.lastExamDate')}</label>
                <input type="date" dir="ltr" value={oForm.lastEyeExamDate}
                  onChange={e => setOForm(p => ({ ...p, lastEyeExamDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{t('medicalHistory.familyHistory')}</label>
                <input type="text" value={oForm.familyEyeHistory}
                  onChange={e => setOForm(p => ({ ...p, familyEyeHistory: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{t('medicalHistory.additionalNotes')}</label>
                <textarea value={oForm.additionalNotes} rows={2}
                  onChange={e => setOForm(p => ({ ...p, additionalNotes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <Button variant="secondary" onClick={() => setModal(null)}>{t('common.cancel')}</Button>
              <Button onClick={handleSaveOcular} loading={saving}>{t('common.save')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Symptom Modal ── */}
      {modal === 'symptom' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">{t('medicalHistory.addSymptom')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{t('medicalHistory.symptomType')} *</label>
                <select value={sForm.symptomType}
                  onChange={e => setSForm(p => ({ ...p, symptomType: e.target.value as typeof sForm.symptomType }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {SYMPTOM_TYPES.map(st => (
                    <option key={st} value={st}>{t(`medicalHistory.symptoms.${st}`)}</option>
                  ))}
                </select>
                {sErrors.symptomType && <p className="text-xs text-red-500 mt-0.5">{sErrors.symptomType}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{t('medicalHistory.affectedEye')} *</label>
                <div className="flex gap-3">
                  {(['OD', 'OS', 'OU'] as const).map(eye => (
                    <label key={eye} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="eye" value={eye} checked={sForm.eye === eye}
                        onChange={() => setSForm(p => ({ ...p, eye }))} className="accent-blue-600" />
                      <span className="text-sm font-mono text-slate-700 dark:text-slate-300">{eye}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{t('medicalHistory.onsetDate')}</label>
                <input type="date" dir="ltr" value={sForm.onsetDate ?? ''}
                  onChange={e => setSForm(p => ({ ...p, onsetDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{t('medicalHistory.symptomDesc')}</label>
                <textarea value={sForm.description ?? ''} rows={2}
                  onChange={e => setSForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <Button variant="secondary" onClick={() => setModal(null)}>{t('common.cancel')}</Button>
              <Button onClick={handleAddSymptom} loading={saving}>{t('common.add')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Archive symptom confirm */}
      <ConfirmDialog
        open={archiveTarget !== null}
        title={t('medicalHistory.archiveSymptomConfirm')}
        description={t('medicalHistory.archiveSymptomWarning')}
        confirmLabel={t('common.archive')}
        danger
        onConfirm={() => archiveTarget && handleArchiveSymptom(archiveTarget)}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  )
}
