import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { FormField } from '../../components/ui/FormField'
import { SupplierFormSchema, type SupplierFormValues } from './purchases.schema'
import { createSupplier, updateSupplier, getSupplierById } from './SupplierRepository'

const EMPTY: SupplierFormValues = {
  name: '', contactName: '', phone: '', email: '',
  address: '', taxNumber: '', paymentTerms: '', notes: '',
}

export default function SupplierFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [values, setValues] = useState<SupplierFormValues>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof SupplierFormValues, string>>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    if (!id) return
    getSupplierById(id).then(s => {
      if (!s) { navigate('/suppliers'); return }
      setValues({
        name: s.name,
        contactName: s.contactName ?? '',
        phone: s.phone ?? '',
        email: s.email ?? '',
        address: s.address ?? '',
        taxNumber: s.taxNumber ?? '',
        paymentTerms: s.paymentTerms ?? '',
        notes: s.notes ?? '',
      })
    })
  }, [id, navigate])

  const set = (field: keyof SupplierFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues(v => ({ ...v, [field]: e.target.value }))
      setErrors(errs => ({ ...errs, [field]: undefined }))
    }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = SupplierFormSchema.safeParse(values)
    if (!parsed.success) {
      const errs: typeof errors = {}
      parsed.error.issues.forEach(i => {
        if (i.path.length) errs[String(i.path[0]) as keyof SupplierFormValues] = i.message
      })
      setErrors(errs)
      return
    }
    setSaving(true)
    setServerError('')
    try {
      if (id) {
        await updateSupplier(id, parsed.data)
      } else {
        await createSupplier(parsed.data)
      }
      navigate('/suppliers')
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold">
        {isEdit ? t('suppliers.editTitle') : t('suppliers.newTitle')}
      </h1>

      {serverError && (
        <div className="rounded bg-red-50 dark:bg-red-900/30 border border-red-200 p-3 text-sm text-red-700 dark:text-red-300">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label={t('suppliers.name')} error={errors.name} required>
          <input value={values.name} onChange={set('name')} className="form-input" />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={t('suppliers.contact')} error={errors.contactName}>
            <input value={values.contactName} onChange={set('contactName')} className="form-input" />
          </FormField>
          <FormField label={t('suppliers.phone')} error={errors.phone}>
            <input value={values.phone} onChange={set('phone')} className="form-input" />
          </FormField>
          <FormField label={t('suppliers.email')} error={errors.email}>
            <input value={values.email} onChange={set('email')} type="email" className="form-input" />
          </FormField>
          <FormField label={t('suppliers.taxNumber')} error={errors.taxNumber}>
            <input value={values.taxNumber} onChange={set('taxNumber')} className="form-input" />
          </FormField>
        </div>

        <FormField label={t('suppliers.address')} error={errors.address}>
          <textarea value={values.address} onChange={set('address')} className="form-input" rows={2} />
        </FormField>

        <FormField label={t('suppliers.paymentTerms')} error={errors.paymentTerms}>
          <input value={values.paymentTerms} onChange={set('paymentTerms')} className="form-input" placeholder="e.g. Net 30" />
        </FormField>

        <FormField label={t('common.notes')} error={errors.notes}>
          <textarea value={values.notes} onChange={set('notes')} className="form-input" rows={3} />
        </FormField>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('common.saving') : t('common.save')}
          </button>
          <button type="button" onClick={() => navigate('/suppliers')} className="btn-secondary">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
