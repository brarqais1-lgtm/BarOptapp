import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FormField } from '../../components/ui/FormField'
import { db } from '../../database/db'
import { PurchaseFormSchema, PurchaseItemFormSchema } from './purchases.schema'
import type { PurchaseFormValues, PurchaseItemFormValues } from './purchases.schema'
import { createPurchase, calculateTotals } from './PurchaseRepository'

interface DraftItem {
  productType: 'frame' | 'lens'
  productId: string
  orderedQty: string
  unitCost: string
  discountAmount: string
  taxAmount: string
}

const EMPTY_ITEM: DraftItem = {
  productType: 'frame', productId: '',
  orderedQty: '1', unitCost: '0',
  discountAmount: '0', taxAmount: '0',
}

type HeaderValues = {
  supplierId: string
  purchaseDate: string
  expectedDeliveryDate: string
  invoiceNumber: string
  notes: string
  discountAmount: string
  taxAmount: string
}

export default function PurchaseFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const today = new Date().toISOString().slice(0, 10)
  const [header, setHeader] = useState<HeaderValues>({
    supplierId: searchParams.get('supplierId') ?? '',
    purchaseDate: today,
    expectedDeliveryDate: '', invoiceNumber: '', notes: '',
    discountAmount: '0', taxAmount: '0',
  })
  const [items, setItems] = useState<DraftItem[]>([])
  const [headerErrors, setHeaderErrors] = useState<Partial<Record<keyof PurchaseFormValues, string>>>({})
  const [itemErrors, setItemErrors] = useState<Record<number, Partial<Record<keyof PurchaseItemFormValues, string>>>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  const suppliers = useLiveQuery(() => db.suppliers.filter(s => !s.deletedAt).toArray(), [])
  const frames = useLiveQuery(() => db.frames.filter(f => !f.deletedAt).toArray(), [])
  const lenses = useLiveQuery(() => db.lenses.filter(l => !l.deletedAt).toArray(), [])

  function setH(field: keyof HeaderValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setHeader(h => ({ ...h, [field]: e.target.value }))
      setHeaderErrors(errs => ({ ...errs, [field]: undefined }))
    }
  }

  function setItem(idx: number, field: keyof DraftItem) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setItems(its => its.map((item, i) => i === idx ? { ...item, [field]: e.target.value } : item))
      setItemErrors(errs => ({ ...errs, [idx]: { ...errs[idx], [field]: undefined } }))
    }
  }

  function addItem() {
    setItems(its => [...its, { ...EMPTY_ITEM }])
  }

  function removeItem(idx: number) {
    setItems(its => its.filter((_, i) => i !== idx))
    setItemErrors(errs => {
      const next: typeof errs = {}
      Object.entries(errs).forEach(([k, v]) => {
        const n = Number(k)
        if (n < idx) next[n] = v
        else if (n > idx) next[n - 1] = v
      })
      return next
    })
  }

  // Live totals for preview
  const parsedItems = items.map(it => ({
    orderedQty: Number(it.orderedQty) || 0,
    unitCost: Number(it.unitCost) || 0,
    discountAmount: Number(it.discountAmount) || 0,
    taxAmount: Number(it.taxAmount) || 0,
  }))
  const totals = calculateTotals(parsedItems, Number(header.discountAmount) || 0, Number(header.taxAmount) || 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Validate header
    const hParsed = PurchaseFormSchema.safeParse({
      ...header,
      discountAmount: header.discountAmount,
      taxAmount: header.taxAmount,
    })
    if (!hParsed.success) {
      const errs: typeof headerErrors = {}
      hParsed.error.issues.forEach(i => {
        if (i.path.length) errs[String(i.path[0]) as keyof PurchaseFormValues] = i.message
      })
      setHeaderErrors(errs)
      return
    }
    // Validate items
    if (items.length === 0) {
      setServerError(t('purchases.noQtyToReceive'))
      return
    }
    const validItems: PurchaseItemFormValues[] = []
    const newItemErrors: typeof itemErrors = {}
    let hasItemErrors = false
    items.forEach((it, idx) => {
      const parsed = PurchaseItemFormSchema.safeParse(it)
      if (!parsed.success) {
        const errs: Partial<Record<keyof PurchaseItemFormValues, string>> = {}
        parsed.error.issues.forEach(i => {
          if (i.path.length) errs[String(i.path[0]) as keyof PurchaseItemFormValues] = i.message
        })
        newItemErrors[idx] = errs
        hasItemErrors = true
      } else {
        validItems.push(parsed.data)
      }
    })
    if (hasItemErrors) {
      setItemErrors(newItemErrors)
      return
    }
    setSaving(true)
    setServerError('')
    try {
      await createPurchase(hParsed.data, validItems)
      navigate('/purchases')
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold">{t('purchases.newPO')}</h1>

      {serverError && (
        <div className="rounded bg-red-50 dark:bg-red-900/30 border border-red-200 p-3 text-sm text-red-700 dark:text-red-300">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">{t('purchases.orderDetails')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={t('purchases.supplier')} error={headerErrors.supplierId} required>
              <select value={header.supplierId} onChange={setH('supplierId')} className="form-input">
                <option value="">{t('common.select')}</option>
                {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label={t('purchases.date')} error={headerErrors.purchaseDate} required>
              <input value={header.purchaseDate} onChange={setH('purchaseDate')} type="date" className="form-input" />
            </FormField>
            <FormField label={t('purchases.expectedDelivery')} error={undefined}>
              <input value={header.expectedDeliveryDate} onChange={setH('expectedDeliveryDate')} type="date" className="form-input" />
            </FormField>
            <FormField label={t('purchases.invoiceNumber')} error={undefined}>
              <input value={header.invoiceNumber} onChange={setH('invoiceNumber')} className="form-input" />
            </FormField>
          </div>
          <FormField label={t('common.notes')} error={undefined}>
            <textarea value={header.notes} onChange={setH('notes')} className="form-input" rows={2} />
          </FormField>
        </div>

        {/* Items */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">{t('purchases.items')}</h2>
          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase">
                    <th className="pb-2 text-start">{t('purchases.product')}</th>
                    <th className="pb-2 text-end">{t('purchases.qty')}</th>
                    <th className="pb-2 text-end">{t('purchases.unitCost')}</th>
                    <th className="pb-2 text-end">{t('purchases.discount')}</th>
                    <th className="pb-2 text-end">{t('purchases.tax')}</th>
                    <th className="pb-2 text-end">{t('purchases.lineTotal')}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((item, idx) => {
                    const productOptions = item.productType === 'frame' ? (frames ?? []) : (lenses ?? [])
                    const lineTotal = (Number(item.orderedQty) || 0) * (Number(item.unitCost) || 0)
                      - (Number(item.discountAmount) || 0) + (Number(item.taxAmount) || 0)
                    const errs = itemErrors[idx] ?? {}
                    return (
                      <tr key={idx} className="align-top">
                        <td className="py-2 pe-2 min-w-48">
                          <div className="space-y-1">
                            <select value={item.productType} onChange={setItem(idx, 'productType')} className="form-input text-xs">
                              <option value="frame">{t('catalog.frame')}</option>
                              <option value="lens">{t('catalog.lens')}</option>
                            </select>
                            <select value={item.productId} onChange={setItem(idx, 'productId')} className={`form-input text-xs ${errs.productId ? 'border-red-400' : ''}`}>
                              <option value="">{t('common.select')}</option>
                              {productOptions.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.brand} {(p as { model?: string }).model ?? ''} ({p.sku})
                                </option>
                              ))}
                            </select>
                            {errs.productId && <p className="text-xs text-red-500">{errs.productId}</p>}
                          </div>
                        </td>
                        <td className="py-2 px-1">
                          <input value={item.orderedQty} onChange={setItem(idx, 'orderedQty')} type="number" min="1" className={`form-input w-16 text-end text-xs ${errs.orderedQty ? 'border-red-400' : ''}`} />
                        </td>
                        <td className="py-2 px-1">
                          <input value={item.unitCost} onChange={setItem(idx, 'unitCost')} type="number" min="0" step="0.01" className="form-input w-24 text-end text-xs" />
                        </td>
                        <td className="py-2 px-1">
                          <input value={item.discountAmount} onChange={setItem(idx, 'discountAmount')} type="number" min="0" step="0.01" className="form-input w-20 text-end text-xs" />
                        </td>
                        <td className="py-2 px-1">
                          <input value={item.taxAmount} onChange={setItem(idx, 'taxAmount')} type="number" min="0" step="0.01" className="form-input w-20 text-end text-xs" />
                        </td>
                        <td className="py-2 px-1 text-end font-mono text-xs pt-3">
                          {lineTotal.toFixed(2)}
                        </td>
                        <td className="py-2 ps-2">
                          <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 text-sm">×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" onClick={addItem} className="btn-secondary text-sm">
            + {t('purchases.addItem')}
          </button>
        </div>

        {/* Totals */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col sm:flex-row gap-6 justify-between">
            <div className="space-y-3 sm:max-w-xs">
              <FormField label={t('purchases.orderDiscount')} error={headerErrors.discountAmount}>
                <input value={header.discountAmount} onChange={setH('discountAmount')} type="number" min="0" step="0.01" className="form-input" />
              </FormField>
              <FormField label={t('purchases.orderTax')} error={headerErrors.taxAmount}>
                <input value={header.taxAmount} onChange={setH('taxAmount')} type="number" min="0" step="0.01" className="form-input" />
              </FormField>
            </div>
            <div className="text-sm space-y-1 text-end min-w-40">
              <p className="text-gray-500">{t('purchases.subtotal')}: <span className="font-mono">{totals.subtotal.toFixed(2)}</span></p>
              <p className="text-gray-500">{t('purchases.orderDiscount')}: <span className="font-mono">-{(Number(header.discountAmount) || 0).toFixed(2)}</span></p>
              <p className="text-gray-500">{t('purchases.orderTax')}: <span className="font-mono">+{(Number(header.taxAmount) || 0).toFixed(2)}</span></p>
              <p className="font-semibold text-base border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                {t('purchases.total')}: <span className="font-mono">{totals.total.toFixed(2)}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('common.saving') : t('purchases.saveDraft')}
          </button>
          <button type="button" onClick={() => navigate('/purchases')} className="btn-secondary">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
