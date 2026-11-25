import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { DegreeSelect } from '../../components/ui/DegreeSelect'
import { PageSpinner } from '../../components/ui/Spinner'
import { useToast } from '../../contexts/ToastContext'
import { ExaminationFormSchema, type ExaminationFormValues } from './schema'
import { createExamination, updateExamination } from './ExaminationRepository'
import { logAudit } from '../../services/audit.service'
import { db } from '../../database/db'
import type { Patient } from '../../database/schema'

type ExamType = 'comprehensive' | 'distance' | 'near' | 'recheck'

interface FormState {
  examinationDate: string
  examinedBy: string
  examType: ExamType
  reSphere: string; reCylinder: string; reAxis: string; reAdd: string
  rePrismPower: string; rePrismBase: string; visualAcuityRight: string; rePd: string
  leSphere: string; leCylinder: string; leAxis: string; leAdd: string
  lePrismPower: string; lePrismBase: string; visualAcuityLeft: string; lePd: string
  pdDistance: string; pdNear: string
  unaidedVARight: string; unaidedVALeft: string
  bcvaRight: string; bcvaLeft: string
  notes: string
}

const EMPTY: FormState = {
  examinationDate: new Date().toISOString().slice(0, 10),
  examinedBy: '', examType: 'comprehensive',
  reSphere: '', reCylinder: '', reAxis: '', reAdd: '',
  rePrismPower: '', rePrismBase: '', visualAcuityRight: '', rePd: '',
  leSphere: '', leCylinder: '', leAxis: '', leAdd: '',
  lePrismPower: '', lePrismBase: '', visualAcuityLeft: '', lePd: '',
  pdDistance: '', pdNear: '',
  unaidedVARight: '', unaidedVALeft: '',
  bcvaRight: '', bcvaLeft: '',
  notes: '',
}

const VA_OPTIONS = ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', 'CF', 'HM', 'PL', 'NLP']

function PatientSearch({ onSelect }: { onSelect: (p: Patient) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Patient[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      const q = query.trim().toLowerCase()
      const all = await db.patients.filter(p =>
        !p.deletedAt && (
          p.fullName.toLowerCase().includes(q) ||
          (p.phone ?? '').includes(q) ||
          (p.fileNumber ?? '').toLowerCase().includes(q)
        )
      ).limit(8).toArray()
      setResults(all)
      setOpen(true)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        placeholder="ابحث باسم المريض أو رقم الهاتف أو رقم الملف..."
        autoFocus
        className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          {results.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onSelect(p); setQuery(p.fullName); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-start transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {p.fullName.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{p.fullName}</p>
                <p className="text-xs text-slate-400">{p.fileNumber} {p.phone ? `· ${p.phone}` : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-400">
          لا توجد نتائج
        </div>
      )}
    </div>
  )
}

function parseNum(s: string): number | undefined {
  if (s === '' || s === undefined) return undefined
  const n = parseFloat(s)
  return Number.isNaN(n) ? undefined : n
}

function fmtNum(n: number | undefined): string {
  return n !== undefined ? String(n) : ''
}

function fmtDeg(n: number | undefined): string {
  return n !== undefined ? n.toFixed(2) : ''
}

function toFormValues(f: FormState): ExaminationFormValues {
  return {
    examinationDate: f.examinationDate,
    examinedBy: f.examinedBy || undefined,
    examType: f.examType,
    reSphere: parseNum(f.reSphere), reCylinder: parseNum(f.reCylinder),
    reAxis: parseNum(f.reAxis), reAdd: parseNum(f.reAdd),
    rePrismPower: parseNum(f.rePrismPower), rePrismBase: f.rePrismBase || undefined,
    visualAcuityRight: f.visualAcuityRight || undefined, rePd: parseNum(f.rePd),
    leSphere: parseNum(f.leSphere), leCylinder: parseNum(f.leCylinder),
    leAxis: parseNum(f.leAxis), leAdd: parseNum(f.leAdd),
    lePrismPower: parseNum(f.lePrismPower), lePrismBase: f.lePrismBase || undefined,
    visualAcuityLeft: f.visualAcuityLeft || undefined, lePd: parseNum(f.lePd),
    pdDistance: parseNum(f.pdDistance), pdNear: parseNum(f.pdNear),
    unaidedVARight: f.unaidedVARight || undefined, unaidedVALeft: f.unaidedVALeft || undefined,
    bcvaRight: f.bcvaRight || undefined, bcvaLeft: f.bcvaLeft || undefined,
    notes: f.notes || undefined,
  }
}

function VAButtons({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {VA_OPTIONS.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? '' : opt)}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            value === opt
              ? 'bg-blue-700 text-white border-blue-700'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:text-blue-600'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function NumField({ value, onChange, step = '0.25', min, max, placeholder }: {
  value: string; onChange: (v: string) => void
  step?: string; min?: string; max?: string; placeholder?: string
}) {
  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? '—'}
      dir="ltr"
      className="w-full px-3 py-2.5 text-sm text-center rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  )
}

export function ExaminationFormPage() {
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const patientId = searchParams.get('patientId')
  const isEdit = !!id

  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (isEdit && id) {
        const exam = await db.eyeExaminations.get(id)
        if (!exam) { navigate('/examinations', { replace: true }); return }
        const p = await db.patients.get(exam.patientId)
        setPatient(p ?? null)
        setForm({
          examinationDate: exam.examinationDate.slice(0, 10),
          examinedBy: exam.examinedBy ?? '',
          examType: exam.examType ?? 'comprehensive',
          reSphere: fmtDeg(exam.reSphere), reCylinder: fmtDeg(exam.reCylinder),
          reAxis: fmtNum(exam.reAxis), reAdd: fmtNum(exam.reAdd),
          rePrismPower: fmtNum(exam.rePrismPower), rePrismBase: exam.rePrismBase ?? '',
          visualAcuityRight: exam.visualAcuityRight ?? '', rePd: fmtNum(exam.rePd),
          leSphere: fmtDeg(exam.leSphere), leCylinder: fmtDeg(exam.leCylinder),
          leAxis: fmtNum(exam.leAxis), leAdd: fmtNum(exam.leAdd),
          lePrismPower: fmtNum(exam.lePrismPower), lePrismBase: exam.lePrismBase ?? '',
          visualAcuityLeft: exam.visualAcuityLeft ?? '', lePd: fmtNum(exam.lePd),
          pdDistance: fmtNum(exam.pdDistance), pdNear: fmtNum(exam.pdNear),
          unaidedVARight: exam.unaidedVARight ?? '', unaidedVALeft: exam.unaidedVALeft ?? '',
          bcvaRight: exam.bcvaRight ?? '', bcvaLeft: exam.bcvaLeft ?? '',
          notes: exam.notes ?? '',
        })
      } else if (patientId) {
        const p = await db.patients.get(patientId)
        setPatient(p ?? null)
      }
      setLoading(false)
    }
    load()
  }, [id, patientId, isEdit, navigate])

  const set = (field: keyof FormState, v: string) => {
    setForm(prev => ({ ...prev, [field]: v }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined as unknown as string }))
  }

  const validate = (): boolean => {
    const values = toFormValues(form)
    const result = ExaminationFormSchema.safeParse(values)
    if (result.success) { setErrors({}); return true }
    const errs: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? '')
      if (key) errs[key] = issue.message
    }
    setErrors(errs)
    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patient) { toast(t('examinations.patientRequired'), 'error'); return }
    if (!validate()) return
    setSaving(true)
    try {
      const values = toFormValues(form)
      if (isEdit && id) {
        const before = await db.eyeExaminations.get(id)
        const updated = await updateExamination(id, values, db)
        await logAudit({ action: 'update', entityType: 'EyeExamination', entityId: updated.id, before, after: updated, db })
        toast(t('examinations.updateSuccess'), 'success')
        navigate(`/examinations/${id}`)
      } else {
        const exam = await createExamination({ ...values, patientId: patient.id }, db)
        await logAudit({ action: 'create', entityType: 'EyeExamination', entityId: exam.id, after: exam, db })
        toast(t('examinations.saveSuccess'), 'success')
        navigate(`/examinations/${exam.id}`, { replace: true })
      }
    } catch (err) {
      toast(`${t('common.error')}: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
          ←
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {isEdit ? t('common.edit') : t('examinations.new')}
        </h1>
      </div>

      {/* Patient selector */}
      <div className="mb-5">
        {patient ? (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {patient.fullName.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 dark:text-white">{patient.fullName}</p>
              <p className="text-xs text-slate-500 font-mono">{patient.fileNumber}</p>
            </div>
            {!isEdit && (
              <button
                type="button"
                onClick={() => setPatient(null)}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2"
              >
                تغيير
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">اختر المريض <span className="text-red-500">*</span></p>
            <PatientSearch onSelect={p => setPatient(p)} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── 1. الحدة البصرية ── */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-base font-bold text-slate-800 dark:text-white mb-5">
            الحدة البصرية
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* عين يمنى */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-400">عين يمنى (OD)</span>
              </div>
              {form.visualAcuityRight && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  المختار: <span className="font-bold text-blue-700 dark:text-blue-300">{form.visualAcuityRight}</span>
                </p>
              )}
              <VAButtons value={form.visualAcuityRight} onChange={v => set('visualAcuityRight', v)} />
            </div>

            {/* عين يسرى */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-green-600 inline-block"></span>
                <span className="text-sm font-bold text-green-700 dark:text-green-400">عين يسرى (OS)</span>
              </div>
              {form.visualAcuityLeft && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  المختار: <span className="font-bold text-green-700 dark:text-green-300">{form.visualAcuityLeft}</span>
                </p>
              )}
              <VAButtons value={form.visualAcuityLeft} onChange={v => set('visualAcuityLeft', v)} />
            </div>
          </div>
        </section>

        {/* ── 2. التصحيح ── */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-base font-bold text-slate-800 dark:text-white mb-5">
            التصحيح
          </h2>
          <div className="grid grid-cols-2 gap-4">

            {/* عين يمنى */}
            <div>
              <p className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-3">عين يمنى (OD)</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">SPH</label>
                  <DegreeSelect value={form.reSphere} onChange={v => set('reSphere', v)} min={-20} max={20} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">CYL</label>
                  <DegreeSelect value={form.reCylinder} onChange={v => set('reCylinder', v)} min={-10} max={10} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">AXIS</label>
                  <NumField value={form.reAxis} onChange={v => set('reAxis', v)} step="1" min="0" max="180" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">ADD</label>
                  <NumField value={form.reAdd} onChange={v => set('reAdd', v)} min="0" max="4" />
                </div>
              </div>
            </div>

            {/* عين يسرى */}
            <div>
              <p className="text-sm font-bold text-green-700 dark:text-green-400 mb-3">عين يسرى (OS)</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">SPH</label>
                  <DegreeSelect value={form.leSphere} onChange={v => set('leSphere', v)} min={-20} max={20} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">CYL</label>
                  <DegreeSelect value={form.leCylinder} onChange={v => set('leCylinder', v)} min={-10} max={10} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">AXIS</label>
                  <NumField value={form.leAxis} onChange={v => set('leAxis', v)} step="1" min="0" max="180" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">ADD</label>
                  <NumField value={form.leAdd} onChange={v => set('leAdd', v)} min="0" max="4" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. المسافة البؤرية (PD) ── */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-base font-bold text-slate-800 dark:text-white mb-4">
            {t('examinations.pd')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: t('examinations.pdBinocular'), field: 'pdDistance' as const },
              { label: t('examinations.pdNear'), field: 'pdNear' as const },
              { label: t('examinations.pdMonocularRight'), field: 'rePd' as const },
              { label: t('examinations.pdMonocularLeft'), field: 'lePd' as const },
            ].map(({ label, field }) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{label}</label>
                <div className="relative">
                  <input type="number" step="0.5" min="20" max="80"
                    value={form[field]} onChange={e => set(field, e.target.value)} dir="ltr"
                    className="w-full px-3 py-2.5 pe-10 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">mm</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. معلومات الفحص ── */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-base font-bold text-slate-800 dark:text-white mb-4">
            {t('examinations.examInfo')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                {t('examinations.examDate')} <span className="text-red-500">*</span>
              </label>
              <input type="date" value={form.examinationDate} onChange={e => set('examinationDate', e.target.value)} dir="ltr"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                {t('examinations.examinedBy')}
              </label>
              <input type="text" value={form.examinedBy} onChange={e => set('examinedBy', e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                {t('examinations.examType')}
              </label>
              <select value={form.examType} onChange={e => set('examType', e.target.value as ExamType)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {(['comprehensive', 'distance', 'near', 'recheck'] as ExamType[]).map(type => (
                  <option key={type} value={type}>{t(`examinations.${type}`)}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ── 5. ملاحظات ── */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            {t('examinations.notes')}
          </label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder={t('examinations.notesPlaceholder')} />
        </section>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={saving}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  )
}
