import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { PageSpinner } from '../../components/ui/Spinner'
import { useToast } from '../../contexts/ToastContext'
import { PatientFormSchema, type PatientFormValues } from './schema'
import {
  createPatient, updatePatient, findDuplicateCandidates, getNextFileNumber,
} from './PatientRepository'
import { logAudit } from '../../services/audit.service'
import { db } from '../../database/db'
import type { Patient } from '../../database/schema'
import { normalizePhone, normalizeSearch } from '../../utils/format'

const EMPTY_FORM: PatientFormValues = {
  fullName: '', phone: '', phone2: '',
  email: '', dateOfBirth: '', gender: undefined, address: '', notes: '',
}

const MONTHS = [
  { value: '1', label: 'يناير' }, { value: '2', label: 'فبراير' },
  { value: '3', label: 'مارس' },  { value: '4', label: 'أبريل' },
  { value: '5', label: 'مايو' },  { value: '6', label: 'يونيو' },
  { value: '7', label: 'يوليو' }, { value: '8', label: 'أغسطس' },
  { value: '9', label: 'سبتمبر'},{ value: '10', label: 'أكتوبر' },
  { value: '11', label: 'نوفمبر'},{ value: '12', label: 'ديسمبر' },
]

export function PatientFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()

  const [form, setForm] = useState<PatientFormValues>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof PatientFormValues, string>>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [existingPatient, setExistingPatient] = useState<Patient | null>(null)
  const [duplicates, setDuplicates] = useState<Patient[]>([])
  const [ignoreWarning, setIgnoreWarning] = useState(false)
  const [age, setAge] = useState('')
  const [birthMonth, setBirthMonth] = useState('')

  const computeDateOfBirth = (a: string, m: string) => {
    if (!a || !m) return ''
    const year = new Date().getFullYear() - parseInt(a)
    return `${year}-${m.padStart(2, '0')}-01`
  }

  useEffect(() => {
    if (!isEdit) return
    db.patients.get(id!).then(p => {
      if (p) {
        setExistingPatient(p)
        setForm({
          fullName: p.fullName, phone: p.phone ?? '', phone2: '',
          email: '', dateOfBirth: p.dateOfBirth ?? '',
          gender: p.gender, address: p.address ?? '', notes: '',
        })
        if (p.dateOfBirth) {
          const year = parseInt(p.dateOfBirth.slice(0, 4))
          const month = p.dateOfBirth.slice(5, 7)
          setAge(String(new Date().getFullYear() - year))
          setBirthMonth(String(parseInt(month)))
        }
      }
      setLoading(false)
    })
  }, [id, isEdit])

  // Duplicate detection (debounced by effect deps)
  useEffect(() => {
    if (!form.fullName.trim() && !form.phone?.trim()) {
      setDuplicates([])
      return
    }
    const timer = setTimeout(async () => {
      const dupes = await findDuplicateCandidates(
        form.fullName, form.phone, existingPatient?.id, db
      )
      setDuplicates(dupes)
    }, 400)
    return () => clearTimeout(timer)
  }, [form.fullName, form.phone, existingPatient?.id])

  const set = (field: keyof PatientFormValues, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validate = (): boolean => {
    const result = PatientFormSchema.safeParse(form)
    if (result.success) { setErrors({}); return true }
    const errs: typeof errors = {}
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof PatientFormValues
      if (key) errs[key] = issue.message
    }
    setErrors(errs)
    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const dob = computeDateOfBirth(age, birthMonth)
    setForm(prev => ({ ...prev, dateOfBirth: dob }))
    form.dateOfBirth = dob
    if (!validate()) return
    if (duplicates.length > 0 && !ignoreWarning) {
      setIgnoreWarning(false) // show warning, let user click continue
      return
    }
    setSaving(true)
    try {
      if (isEdit && existingPatient) {
        const before = { ...existingPatient }
        const updated = await updatePatient(id!, {
          ...form,
          fullNameNormalized: normalizeSearch(form.fullName),
          phoneNormalized: form.phone ? normalizePhone(form.phone) : undefined,
        }, db)
        await logAudit({ action: 'update', entityType: 'Patient', entityId: updated.id, before, after: updated, db })
        toast(t('patients.updateSuccess'), 'success')
      } else {
        const fileNumber = await getNextFileNumber(db)
        const patient = await createPatient({
          fileNumber,
          ...form,
          fullNameNormalized: normalizeSearch(form.fullName),
          phoneNormalized: form.phone ? normalizePhone(form.phone) : undefined,
        }, db)
        await logAudit({ action: 'create', entityType: 'Patient', entityId: patient.id, after: patient, db })
        toast(t('patients.saveSuccess'), 'success')
        navigate(`/patients/${patient.id}`, { replace: true })
        return
      }
      navigate(-1)
    } catch (err) {
      toast(`${t('common.error')}: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {isEdit ? t('common.edit') : t('patients.new')}
        </h1>
      </div>

      {/* Duplicate warning */}
      {duplicates.length > 0 && !ignoreWarning && (
        <div className="mb-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
            ⚠ {t('patients.duplicateWarning')}
          </p>
          <div className="space-y-1">
            {duplicates.map(d => (
              <p key={d.id} className="text-xs text-amber-700 dark:text-amber-400">
                {d.fileNumber} — {d.fullName} {d.phone && `(${d.phone})`}
              </p>
            ))}
          </div>
          <button
            onClick={() => setIgnoreWarning(true)}
            className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300 underline"
          >
            {t('patients.continueAnyway')}
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        {/* الاسم الكامل */}
        <FormGroup label={t('patients.fullName')} required error={errors.fullName}>
          <FormInput
            value={form.fullName}
            onChange={v => set('fullName', v)}
            placeholder={t('patients.fullName')}
            autoFocus
          />
        </FormGroup>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* رقم الهاتف */}
          <FormGroup label={t('patients.phone')} error={errors.phone}>
            <FormInput value={form.phone ?? ''} onChange={v => set('phone', v)} type="tel" dir="ltr" placeholder="+966 5x xxx xxxx" />
          </FormGroup>

          {/* الجنس */}
          <FormGroup label={t('patients.gender')} error={errors.gender}>
            <select
              value={form.gender ?? ''}
              onChange={e => set('gender', e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('common.optional')}</option>
              <option value="male">{t('patients.male')}</option>
              <option value="female">{t('patients.female')}</option>
            </select>
          </FormGroup>

          {/* العمر */}
          <FormGroup label="العمر">
            <input
              type="number"
              min={0}
              max={120}
              value={age}
              onChange={e => {
                setAge(e.target.value)
                setForm(prev => ({ ...prev, dateOfBirth: computeDateOfBirth(e.target.value, birthMonth) }))
              }}
              placeholder="مثال: 35"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </FormGroup>

          {/* شهر الميلاد */}
          <FormGroup label="شهر الميلاد">
            <select
              value={birthMonth}
              onChange={e => {
                setBirthMonth(e.target.value)
                setForm(prev => ({ ...prev, dateOfBirth: computeDateOfBirth(age, e.target.value) }))
              }}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">اختر الشهر</option>
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </FormGroup>
        </div>

        {/* العنوان */}
        <FormGroup label={t('patients.address')} error={errors.address}>
          <FormInput value={form.address ?? ''} onChange={v => set('address', v)} />
        </FormGroup>

        {/* File number display (edit mode) */}
        {isEdit && existingPatient && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-400">
              {t('patients.fileNumber')}:{' '}
              <Badge variant="blue">{existingPatient.fileNumber}</Badge>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            loading={saving}
            disabled={duplicates.length > 0 && !ignoreWarning}
          >
            {t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  )
}

function FormGroup({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
        {label}
        {required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function FormInput({ value, onChange, type = 'text', placeholder, autoFocus, dir }: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoFocus?: boolean
  dir?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      dir={dir}
      className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  )
}
