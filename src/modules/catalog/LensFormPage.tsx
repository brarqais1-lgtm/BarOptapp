import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { PageSpinner } from '../../components/ui/Spinner'
import { useToast } from '../../contexts/ToastContext'
import { LensFormSchema, type LensFormValues } from './schema'
import { createLens, updateLens, getLensById } from './LensRepository'
import { getCategories } from './ProductCategoryRepository'
import { db } from '../../database/db'
import type { ProductCategory } from '../../database/schema'

const COATING_OPTIONS = ['ar', 'blue_cut', 'uv', 'photochromic'] as const
type Coating = typeof COATING_OPTIONS[number]

const EMPTY: LensFormValues = {
  sku: '', name: '', brand: '', model: '', barcode: '',
  lensType: 'single_vision', material: '', coatings: [],
  index: undefined, sphereMin: undefined, sphereMax: undefined,
  cylinderMin: undefined, cylinderMax: undefined,
  addMin: undefined, addMax: undefined,
  supplierId: '', categoryId: '', imageUrl: '', notes: '',
}

export function LensFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()

  const [values, setValues] = useState<LensFormValues>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof LensFormValues, string>>>({})
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    getCategories('lens', db).then(setCategories)
    if (isEdit && id) {
      getLensById(id, db).then(lens => {
        if (!lens) { navigate('/lenses'); return }
        setValues({
          sku: lens.sku, name: lens.name ?? '', brand: lens.brand, model: lens.model ?? '',
          barcode: lens.barcode ?? '', lensType: lens.lensType, material: lens.material ?? '',
          coatings: (lens.coatings ?? []) as Coating[],
          index: lens.index, sphereMin: lens.sphereMin, sphereMax: lens.sphereMax,
          cylinderMin: lens.cylinderMin, cylinderMax: lens.cylinderMax,
          addMin: lens.addMin, addMax: lens.addMax,
          supplierId: lens.supplierId ?? '', categoryId: lens.categoryId ?? '',
          imageUrl: lens.imageUrl ?? '', notes: lens.notes ?? '',
        })
        setLoading(false)
      })
    }
  }, [id, isEdit, navigate])

  const set = (field: keyof LensFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setValues(v => ({ ...v, [field]: e.target.value }))
    setErrors(errs => ({ ...errs, [field]: undefined }))
  }

  const toggleCoating = (c: Coating) => {
    setValues(v => ({
      ...v,
      coatings: v.coatings.includes(c) ? v.coatings.filter(x => x !== c) : [...v.coatings, c],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = LensFormSchema.safeParse(values)
    if (!parsed.success) {
      const errs: typeof errors = {}
      parsed.error.issues.forEach(i => { if (i.path.length) errs[String(i.path[0]) as keyof LensFormValues] = i.message })
      setErrors(errs)
      return
    }
    setSaving(true)
    setServerError('')
    try {
      if (isEdit && id) {
        await updateLens(id, parsed.data, db)
        toast(t('catalog.updateSuccess'), 'success')
      } else {
        await createLens(parsed.data, db)
        toast(t('catalog.createSuccess'), 'success')
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
          ← {t('catalog.lenses.title')}
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {isEdit ? t('catalog.lenses.edit') : t('catalog.lenses.new')}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        {serverError && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-xl px-4 py-3">{serverError}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('catalog.sku')} required error={errors.sku}>
            <input value={values.sku} onChange={set('sku')} className="form-input" placeholder="LNS-001" />
          </FormField>
          <FormField label={t('catalog.name')} required error={errors.name}>
            <input value={values.name} onChange={set('name')} className="form-input" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('catalog.brand')} required error={errors.brand}>
            <input value={values.brand} onChange={set('brand')} className="form-input" />
          </FormField>
          <FormField label={t('catalog.model')} error={errors.model}>
            <input value={values.model} onChange={set('model')} className="form-input" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('catalog.lenses.lensType')} required error={errors.lensType}>
            <select value={values.lensType} onChange={set('lensType')} className="form-input">
              <option value="single_vision">{t('catalog.lenses.single_vision')}</option>
              <option value="bifocal">{t('catalog.lenses.bifocal')}</option>
              <option value="progressive">{t('catalog.lenses.progressive')}</option>
            </select>
          </FormField>
          <FormField label={t('catalog.lenses.material')} error={errors.material}>
            <input value={values.material} onChange={set('material')} className="form-input" placeholder="CR-39, Polycarbonate…" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('catalog.barcode')} error={errors.barcode}>
            <input value={values.barcode} onChange={set('barcode')} className="form-input" />
          </FormField>
          <FormField label={t('catalog.lenses.index')} error={errors.index}>
            <input value={values.index ?? ''} onChange={set('index')} type="number" step="0.01" min="1" max="2" className="form-input" placeholder="1.56" />
          </FormField>
        </div>

        {/* Coatings */}
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('catalog.lenses.coatings')}</p>
          <div className="flex flex-wrap gap-2">
            {COATING_OPTIONS.map(c => (
              <label key={c} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm cursor-pointer border transition-colors ${values.coatings.includes(c) ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400'}`}>
                <input type="checkbox" className="sr-only" checked={values.coatings.includes(c)} onChange={() => toggleCoating(c)} />
                {t(`catalog.lenses.coating_${c}`)}
              </label>
            ))}
          </div>
        </div>

        {/* Power ranges */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t('catalog.lenses.powerRanges')}</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('catalog.lenses.sphereMin')} error={errors.sphereMin}>
              <input value={values.sphereMin ?? ''} onChange={set('sphereMin')} type="number" step="0.25" className="form-input" placeholder="-20" />
            </FormField>
            <FormField label={t('catalog.lenses.sphereMax')} error={errors.sphereMax}>
              <input value={values.sphereMax ?? ''} onChange={set('sphereMax')} type="number" step="0.25" className="form-input" placeholder="+20" />
            </FormField>
            <FormField label={t('catalog.lenses.cylinderMin')} error={errors.cylinderMin}>
              <input value={values.cylinderMin ?? ''} onChange={set('cylinderMin')} type="number" step="0.25" className="form-input" placeholder="-6" />
            </FormField>
            <FormField label={t('catalog.lenses.cylinderMax')} error={errors.cylinderMax}>
              <input value={values.cylinderMax ?? ''} onChange={set('cylinderMax')} type="number" step="0.25" className="form-input" placeholder="+6" />
            </FormField>
            {(values.lensType === 'bifocal' || values.lensType === 'progressive') && (
              <>
                <FormField label={t('catalog.lenses.addMin')} error={errors.addMin}>
                  <input value={values.addMin ?? ''} onChange={set('addMin')} type="number" step="0.25" className="form-input" placeholder="0.75" />
                </FormField>
                <FormField label={t('catalog.lenses.addMax')} error={errors.addMax}>
                  <input value={values.addMax ?? ''} onChange={set('addMax')} type="number" step="0.25" className="form-input" placeholder="3.50" />
                </FormField>
              </>
            )}
          </div>
        </div>

        {categories.length > 0 && (
          <FormField label={t('catalog.category')} error={errors.categoryId}>
            <select value={values.categoryId} onChange={set('categoryId')} className="form-input">
              <option value="">{t('common.none')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr} / {c.nameEn}</option>)}
            </select>
          </FormField>
        )}

        <FormField label={t('catalog.imageUrl')} error={errors.imageUrl}>
          <input value={values.imageUrl} onChange={set('imageUrl')} className="form-input" type="url" placeholder="https://…" />
        </FormField>

        <FormField label={t('catalog.notes')} error={errors.notes}>
          <textarea value={values.notes} onChange={set('notes')} rows={2} className="form-input resize-none" />
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={() => navigate('/lenses')}>{t('common.cancel')}</Button>
          <Button type="submit" loading={saving}>{isEdit ? t('common.save') : t('catalog.lenses.create')}</Button>
        </div>
      </form>
    </div>
  )
}
