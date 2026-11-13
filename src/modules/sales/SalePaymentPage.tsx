import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { PaymentFormSchema, type PaymentFormValues } from './sales.schema'
import { addPayment } from './PaymentsRepository'

export default function SalePaymentPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const sale = useLiveQuery(() => db.sales.get(id!), [id])

  const [form, setForm] = useState<Partial<PaymentFormValues>>({
    method: 'cash',
    paidAt: new Date().toISOString().slice(0, 10),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  if (!sale) return <div className="p-4 text-gray-400">{t('common.loading')}</div>

  function setField<K extends keyof PaymentFormValues>(key: K, value: PaymentFormValues[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    const parsed = PaymentFormSchema.safeParse(form)
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      parsed.error.issues.forEach(e => {
        if (e.path.length) errs[String(e.path[0])] = e.message
      })
      setErrors(errs)
      return
    }

    if (parsed.data.amount > sale!.balanceDue + 0.001) {
      setErrors({ amount: t('sales.errors.exceedsBalance', { balance: sale!.balanceDue.toFixed(2) }) })
      return
    }

    setErrors({})
    setSaving(true)
    try {
      await addPayment(id!, parsed.data)
      navigate(`/sales/${id}`)
    } catch (err) {
      setErrors({ submit: String(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-lg">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/sales/${id}`)}>← {t('common.back')}</Button>
        <h1 className="text-xl font-semibold">{t('sales.addPayment')}</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">{t('sales.invoiceNumber')}</span>
          <span className="font-mono">{sale.saleNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t('sales.total')}</span>
          <span>{sale.total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>{t('sales.balance')}</span>
          <span>{sale.balanceDue.toFixed(2)}</span>
        </div>
      </div>

      {errors.submit && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg px-4 py-3 text-sm">
          {errors.submit}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <FormField label={t('sales.payment.amount')} error={errors.amount} required>
          <input type="number" min="0.01" step="0.01" className="form-input w-full"
            value={form.amount ?? ''}
            onChange={e => setField('amount', Number(e.target.value))} />
        </FormField>

        <FormField label={t('sales.payment.method')} error={errors.method} required>
          <select className="form-input w-full"
            value={form.method ?? 'cash'}
            onChange={e => setField('method', e.target.value as PaymentFormValues['method'])}>
            {(['cash', 'card', 'transfer', 'cheque', 'other'] as const).map(m => (
              <option key={m} value={m}>{t(`sales.payment.methods.${m}`)}</option>
            ))}
          </select>
        </FormField>

        <FormField label={t('sales.payment.date')} error={errors.paidAt} required>
          <input type="date" className="form-input w-full"
            value={form.paidAt ?? ''}
            onChange={e => setField('paidAt', e.target.value)} />
        </FormField>

        <FormField label={t('sales.payment.reference')} error={errors.reference}>
          <input className="form-input w-full"
            value={form.reference ?? ''}
            onChange={e => setField('reference', e.target.value)} />
        </FormField>

        <FormField label={t('common.notes')}>
          <input className="form-input w-full"
            value={form.notes ?? ''}
            onChange={e => setField('notes', e.target.value)} />
        </FormField>
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={() => navigate(`/sales/${id}`)}>{t('common.cancel')}</Button>
        <Button loading={saving} onClick={handleSave}>{t('sales.recordPayment')}</Button>
      </div>
    </div>
  )
}
