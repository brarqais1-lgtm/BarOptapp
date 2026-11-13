import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { FormField } from '../../components/ui/FormField'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../contexts/ToastContext'
import { ProductCategorySchema, type ProductCategoryValues } from './schema'
import { getCategories, createCategory, updateCategory, archiveCategory } from './ProductCategoryRepository'
import { db } from '../../database/db'
import type { ProductCategory } from '../../database/schema'

const EMPTY: ProductCategoryValues = { nameAr: '', nameEn: '', type: 'both', description: '' }
const TYPE_BADGE: Record<string, 'blue' | 'purple' | 'teal'> = { frame: 'blue', lens: 'purple', both: 'teal' }

export function ProductCategoriesPage() {
  const { t } = useTranslation()
  const { toast } = useToast()

  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [editing, setEditing] = useState<ProductCategory | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ProductCategoryValues>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof ProductCategoryValues, string>>>({})
  const [saving, setSaving] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<ProductCategory | null>(null)

  const load = () => getCategories(undefined, db).then(setCategories)
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(EMPTY); setErrors({}); setShowForm(true) }
  const openEdit = (c: ProductCategory) => {
    setEditing(c)
    setForm({ nameAr: c.nameAr, nameEn: c.nameEn, type: c.type, description: c.description ?? '' })
    setErrors({})
    setShowForm(true)
  }

  const setF = (field: keyof ProductCategoryValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(v => ({ ...v, [field]: e.target.value }))
    setErrors(errs => ({ ...errs, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = ProductCategorySchema.safeParse(form)
    if (!parsed.success) {
      const errs: typeof errors = {}
      parsed.error.issues.forEach(i => { if (i.path.length) errs[String(i.path[0]) as keyof ProductCategoryValues] = i.message })
      setErrors(errs)
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateCategory(editing.id, parsed.data, db)
        toast(t('catalog.updateSuccess'), 'success')
      } else {
        await createCategory(parsed.data, db)
        toast(t('catalog.createSuccess'), 'success')
      }
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (c: ProductCategory) => {
    await archiveCategory(c.id, db)
    toast(t('catalog.archiveSuccess'), 'success')
    load()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('catalog.categories.title')}</h1>
        <Button onClick={openNew} icon={<span>+</span>}>{t('catalog.categories.new')}</Button>
      </div>

      {/* Inline form panel */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 mb-5">
          <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-4">
            {editing ? t('catalog.categories.edit') : t('catalog.categories.new')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('catalog.categories.nameAr')} required error={errors.nameAr}>
                <input value={form.nameAr} onChange={setF('nameAr')} className="form-input" dir="rtl" />
              </FormField>
              <FormField label={t('catalog.categories.nameEn')} required error={errors.nameEn}>
                <input value={form.nameEn} onChange={setF('nameEn')} className="form-input" />
              </FormField>
            </div>
            <FormField label={t('catalog.categories.type')} required error={errors.type}>
              <select value={form.type} onChange={setF('type')} className="form-input">
                <option value="frame">{t('catalog.categories.typeFrame')}</option>
                <option value="lens">{t('catalog.categories.typeLens')}</option>
                <option value="both">{t('catalog.categories.typeBoth')}</option>
              </select>
            </FormField>
            <FormField label={t('catalog.categories.description')} error={errors.description}>
              <textarea value={form.description} onChange={setF('description')} rows={2} className="form-input resize-none" />
            </FormField>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={saving}>{editing ? t('common.save') : t('catalog.categories.create')}</Button>
            </div>
          </form>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="text-center py-12 text-slate-400">{t('catalog.categories.empty')}</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.categories.nameAr')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.categories.nameEn')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.categories.type')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {categories.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white" dir="rtl">{c.nameAr}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.nameEn}</td>
                  <td className="px-4 py-3">
                    <Badge variant={TYPE_BADGE[c.type] ?? 'gray'}>{t(`catalog.categories.type${c.type.charAt(0).toUpperCase() + c.type.slice(1)}`)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(c)} className="text-xs text-blue-600 hover:underline">{t('common.edit')}</button>
                      <button onClick={() => setArchiveTarget(c)} className="text-xs text-red-500 hover:underline">{t('common.archive')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        title={t('catalog.archiveConfirm')}
        description={t('catalog.archiveWarning')}
        confirmLabel={t('common.archive')}
        danger
        onConfirm={() => { if (archiveTarget) handleArchive(archiveTarget); setArchiveTarget(null) }}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  )
}
