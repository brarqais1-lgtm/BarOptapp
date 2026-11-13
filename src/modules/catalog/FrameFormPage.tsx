import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { PageSpinner } from '../../components/ui/Spinner'
import { useToast } from '../../contexts/ToastContext'
import { FrameFormSchema, type FrameFormValues } from './schema'
import { createFrame, updateFrame, getFrameById } from './FrameRepository'
import { db } from '../../database/db'

const EMPTY: FrameFormValues = {
  name: '', sellingPrice: undefined as unknown as number, quantity: undefined as unknown as number,
  sku: '', brand: '', model: '', barcode: '', gender: undefined,
  frameShape: '', material: '', color: '', size: '', frameType: undefined,
  supplierId: '', categoryId: '', imageUrl: '', notes: '',
}

export function FrameFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()

  const [values, setValues] = useState<FrameFormValues>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FrameFormValues, string>>>({})
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    if (isEdit && id) {
      getFrameById(id, db).then(frame => {
        if (!frame) { navigate('/frames'); return }
        setValues({
          name: frame.name ?? '', sellingPrice: frame.sellingPrice ?? 0, quantity: frame.quantity ?? 0,
          sku: frame.sku, brand: frame.brand, model: frame.model ?? '',
          barcode: frame.barcode ?? '', gender: frame.gender, frameShape: frame.frameShape ?? '',
          material: frame.material ?? '', color: frame.color ?? '', size: frame.size ?? '',
          frameType: frame.frameType, supplierId: frame.supplierId ?? '',
          categoryId: frame.categoryId ?? '', imageUrl: frame.imageUrl ?? '', notes: frame.notes ?? '',
        })
        setLoading(false)
      })
    }
  }, [id, isEdit, navigate])

  const set = (field: keyof FrameFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setValues(v => ({ ...v, [field]: e.target.value }))
    setErrors(errs => ({ ...errs, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = FrameFormSchema.safeParse(values)
    if (!parsed.success) {
      const errs: typeof errors = {}
      parsed.error.issues.forEach(i => { if (i.path.length) errs[String(i.path[0]) as keyof FrameFormValues] = i.message })
      setErrors(errs)
      return
    }
    setSaving(true)
    setServerError('')
    try {
      if (isEdit && id) {
        await updateFrame(id, parsed.data, db)
        toast(t('catalog.updateSuccess'), 'success')
      } else {
        await createFrame(parsed.data, db)
        toast(t('catalog.createSuccess'), 'success')
      }
      navigate('/frames')
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
        <button onClick={() => navigate('/frames')} className="text-sm text-blue-600 hover:underline mb-2 block">
          ← {t('catalog.frames.title')}
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {isEdit ? t('catalog.frames.edit') : t('catalog.frames.new')}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        {serverError && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-xl px-4 py-3">{serverError}</div>
        )}

        <FormField label="اسم المنتج" required error={errors.name}>
          <input value={values.name} onChange={set('name')} className="form-input" placeholder="مثال: راي بان كلاسيك" autoFocus />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="السعر (د.ع)" required error={errors.sellingPrice}>
            <input
              type="number" min={0} step={500}
              value={values.sellingPrice ?? ''}
              onChange={set('sellingPrice')}
              className="form-input"
              placeholder="0"
            />
          </FormField>
          <FormField label="الكمية" required error={errors.quantity}>
            <input
              type="number" min={0} step={1}
              value={values.quantity ?? ''}
              onChange={set('quantity')}
              className="form-input"
              placeholder="0"
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={() => navigate('/frames')}>{t('common.cancel')}</Button>
          <Button type="submit" loading={saving}>{isEdit ? t('common.save') : t('catalog.frames.create')}</Button>
        </div>
      </form>
    </div>
  )
}
