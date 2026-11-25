import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { DegreeSelect } from '../../components/ui/DegreeSelect'
import { FormField } from '../../components/ui/FormField'
import { PageSpinner } from '../../components/ui/Spinner'
import { useToast } from '../../contexts/ToastContext'
import { LensFormSchema, type LensFormValues } from './schema'
import { createLens, updateLens, getLensWithVariants } from './LensRepository'
import { db } from '../../database/db'

type VariantDraft = {
  id?: string
  sph: string
  cyl: string
  quantity: string
  price: string
}

const EMPTY_VARIANT: VariantDraft = { sph: '0.00', cyl: '0.00', quantity: '0', price: '0' }


const LENS_TYPES = [
  { value: 'single_vision', label: 'Single Vision' },
  { value: 'bifocal',       label: 'Bifocal' },
  { value: 'progressive',   label: 'Progressive' },
]

export function LensFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [lensType, setLensType] = useState('single_vision')
  const [notes, setNotes] = useState('')
  const [variants, setVariants] = useState<VariantDraft[]>([{ ...EMPTY_VARIANT }])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    if (!isEdit || !id) return
    getLensWithVariants(id, db).then(data => {
      if (!data) { navigate('/lenses'); return }
      const { lens, variants: vs } = data
      setName(lens.name)
      setLensType(lens.lensType)
      setNotes(lens.notes ?? '')
      setVariants(
        vs.length
          ? vs.map(v => ({
              id: v.id,
              sph: v.sph.toFixed(2),
              cyl: v.cyl.toFixed(2),
              quantity: String(v.quantity),
              price: String(v.price),
            }))
          : [{ ...EMPTY_VARIANT }],
      )
      setLoading(false)
    })
  }, [id, isEdit, navigate])

  const setVariantField = (i: number, field: keyof VariantDraft, value: string) => {
    setVariants(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v))
    setErrors(e => { const n = { ...e }; delete n[`v${i}_${field}`]; return n })
  }

  const addVariant = () => setVariants(prev => [...prev, { ...EMPTY_VARIANT }])

  const removeVariant = (i: number) =>
    setVariants(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const formData: LensFormValues = {
      name,
      lensType: lensType as LensFormValues['lensType'],
      notes,
      variants: variants.map(v => ({
        id: v.id,
        sph: Number(v.sph),
        cyl: Number(v.cyl),
        quantity: Math.round(Number(v.quantity)),
        price: Number(v.price),
      })),
    }

    const parsed = LensFormSchema.safeParse(formData)
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      parsed.error.issues.forEach(issue => {
        const key = issue.path.join('_')
        errs[key] = issue.message
      })
      setErrors(errs)
      return
    }

    setSaving(true)
    setServerError('')
    try {
      if (isEdit && id) {
        await updateLens(id, parsed.data, db)
        toast('تم تحديث العدسة بنجاح', 'success')
      } else {
        await createLens(parsed.data, db)
        toast('تم إضافة العدسة بنجاح', 'success')
      }
      navigate('/lenses')
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-5">
        <button onClick={() => navigate('/lenses')} className="text-sm text-blue-600 hover:underline mb-2 block">
          ← العدسات
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {isEdit ? 'تعديل العدسة' : 'إضافة عدسة جديدة'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {serverError && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-xl px-4 py-3">{serverError}</div>
        )}

        {/* Lens info */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <FormField label="اسم العدسة" required error={errors.name}>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setErrors(er => ({ ...er, name: '' })) }}
              className="form-input"
              placeholder="مثال: Essilor Varilux, Zeiss Progressive..."
              dir="ltr"
            />
          </FormField>

          <FormField label="نوع العدسة" required error={errors.lensType}>
            <div className="flex gap-2 flex-wrap">
              {LENS_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setLensType(t.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    lensType === t.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="ملاحظات" error={errors.notes}>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="form-input resize-none"
            />
          </FormField>
        </div>

        {/* Degree variants */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white">الدرجات والمخزون</h2>
              <p className="text-xs text-slate-400 mt-0.5">كل صف: درجة كروية (SPH) + أسطوانية (CYL) + كمية + سعر</p>
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <span className="text-base leading-none">+</span>
              إضافة درجة
            </button>
          </div>

          {errors.variants && (
            <div className="text-red-500 text-xs mb-3">{errors.variants}</div>
          )}

          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_80px_90px_32px] gap-2 mb-2 px-1">
            <span className="text-xs font-semibold text-slate-500 uppercase">SPH</span>
            <span className="text-xs font-semibold text-slate-500 uppercase">CYL</span>
            <span className="text-xs font-semibold text-slate-500 uppercase">كمية</span>
            <span className="text-xs font-semibold text-slate-500 uppercase">سعر (IQD)</span>
            <span />
          </div>

          <div className="space-y-2">
            {variants.map((v, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_80px_90px_32px] gap-2 items-start">
                <div>
                  <DegreeSelect
                    value={v.sph}
                    onChange={val => setVariantField(i, 'sph', val)}
                    min={-20}
                    max={20}
                    hasError={!!errors[`v${i}_sph`]}
                  />
                  {errors[`v${i}_sph`] && <p className="text-red-500 text-xs mt-0.5">{errors[`v${i}_sph`]}</p>}
                </div>
                <div>
                  <DegreeSelect
                    value={v.cyl}
                    onChange={val => setVariantField(i, 'cyl', val)}
                    min={-10}
                    max={10}
                    hasError={!!errors[`v${i}_cyl`]}
                  />
                  {errors[`v${i}_cyl`] && <p className="text-red-500 text-xs mt-0.5">{errors[`v${i}_cyl`]}</p>}
                </div>
                <div>
                  <input
                    type="number"
                    value={v.quantity}
                    onChange={e => setVariantField(i, 'quantity', e.target.value)}
                    step="1"
                    min="0"
                    className={`form-input text-center text-sm ${errors[`v${i}_quantity`] ? 'border-red-400' : ''}`}
                    placeholder="0"
                  />
                  {errors[`v${i}_quantity`] && <p className="text-red-500 text-xs mt-0.5">{errors[`v${i}_quantity`]}</p>}
                </div>
                <div>
                  <input
                    type="number"
                    value={v.price}
                    onChange={e => setVariantField(i, 'price', e.target.value)}
                    step="500"
                    min="0"
                    className={`form-input text-center text-sm ${errors[`v${i}_price`] ? 'border-red-400' : ''}`}
                    placeholder="0"
                  />
                  {errors[`v${i}_price`] && <p className="text-red-500 text-xs mt-0.5">{errors[`v${i}_price`]}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeVariant(i)}
                  disabled={variants.length === 1}
                  className="mt-1 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="حذف"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Summary */}
          {variants.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-6 text-xs text-slate-500">
              <span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0)}
                </span>{' '}
                قطعة إجمالي
              </span>
              <span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {variants.length}
                </span>{' '}
                درجة
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate('/lenses')}>إلغاء</Button>
          <Button type="submit" loading={saving}>{isEdit ? 'حفظ التعديلات' : 'إضافة العدسة'}</Button>
        </div>
      </form>
    </div>
  )
}
