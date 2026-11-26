import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
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

const inputClass = "w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
const labelClass = "block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5"

export function FrameFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [price, setPrice] = useState<string>('')
  const [qty, setQty] = useState<string>('')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isEdit && id) {
      getFrameById(id, db).then(frame => {
        if (!frame) { navigate('/frames'); return }
        setName(frame.name ?? '')
        setPrice(String(frame.sellingPrice ?? ''))
        setQty(String(frame.quantity ?? ''))
        setLoading(false)
      })
    }
  }, [id, isEdit, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const values: FrameFormValues = {
      ...EMPTY,
      name: name.trim(),
      brand: name.trim(),
      sku: `FRM-${Date.now()}`,
      sellingPrice: price === '' ? (undefined as unknown as number) : Number(price),
      quantity: qty === '' ? (undefined as unknown as number) : Number(qty),
    }

    const parsed = FrameFormSchema.safeParse(values)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'خطأ في البيانات')
      return
    }

    setSaving(true)
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
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-sm mx-auto px-4 py-6">
      <button onClick={() => navigate('/frames')} className="text-sm text-blue-600 hover:underline mb-4 block">
        ← {t('catalog.frames.title')}
      </button>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-5">
        {isEdit ? t('catalog.frames.edit') : t('catalog.frames.new')}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div>
          <label className={labelClass}>اسم الإطار <span className="text-red-500">*</span></label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputClass}
            placeholder="مثال: راي بان كلاسيك"
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>السعر (د.ع) <span className="text-red-500">*</span></label>
            <input
              type="number"
              min={0}
              step={500}
              value={price}
              onChange={e => setPrice(e.target.value)}
              className={inputClass}
              placeholder="0"
              required
            />
          </div>
          <div>
            <label className={labelClass}>الكمية <span className="text-red-500">*</span></label>
            <input
              type="number"
              min={0}
              step={1}
              value={qty}
              onChange={e => setQty(e.target.value)}
              className={inputClass}
              placeholder="0"
              required
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={() => navigate('/frames')}>{t('common.cancel')}</Button>
          <Button type="submit" loading={saving}>{isEdit ? t('common.save') : t('catalog.frames.create')}</Button>
        </div>
      </form>
    </div>
  )
}
