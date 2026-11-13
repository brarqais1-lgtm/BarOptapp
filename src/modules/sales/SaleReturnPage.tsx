import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { processReturn, type ReturnItemInput } from './ReturnsService'

export default function SaleReturnPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const sale = useLiveQuery(() => db.sales.get(id!), [id])
  const saleItems = useLiveQuery(() => db.saleItems.where('saleId').equals(id!).toArray(), [id])

  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [restock, setRestock] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!sale || !saleItems) return <div className="p-4 text-gray-400">{t('common.loading')}</div>

  const activeSale = sale
  const returnableItems = saleItems.filter(i => i.quantity > i.returnedQty)

  function setQty(itemId: string, val: number) {
    setQtys(prev => ({ ...prev, [itemId]: Math.max(0, val) }))
  }

  async function handleSubmit() {
    const items: ReturnItemInput[] = returnableItems
      .map(i => ({
        saleItemId: i.id,
        quantity: qtys[i.id] ?? 0,
        restockItem: restock[i.id] !== false,
      }))
      .filter(i => i.quantity > 0)

    if (items.length === 0) {
      setError(t('sales.errors.noReturnItems'))
      return
    }

    setError('')
    setSaving(true)
    try {
      await processReturn(activeSale.id, items, returnDate, reason || undefined, notes || undefined)
      navigate(`/sales/${id}`)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const totalRefundPreview = returnableItems.reduce((sum, i) => {
    const qty = qtys[i.id] ?? 0
    if (qty <= 0) return sum
    const unitRefund = i.quantity > 0 ? i.total / i.quantity : 0
    return sum + Math.round(unitRefund * qty * 100) / 100
  }, 0)

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/sales/${id}`)}>← {t('common.back')}</Button>
        <h1 className="text-xl font-semibold">{t('sales.processReturn')}</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">{t('sales.invoiceNumber')}</span>
          <span className="font-mono">{sale.saleNumber}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label={t('sales.return.date')} required>
            <input type="date" className="form-input w-full"
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)} />
          </FormField>
          <FormField label={t('sales.return.reason')}>
            <input className="form-input w-full"
              value={reason}
              onChange={e => setReason(e.target.value)} />
          </FormField>
        </div>

        <FormField label={t('common.notes')}>
          <input className="form-input w-full"
            value={notes}
            onChange={e => setNotes(e.target.value)} />
        </FormField>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="font-medium mb-3">{t('sales.return.selectItems')}</h2>
        {returnableItems.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('sales.return.noReturnable')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="py-2 text-start">{t('sales.description')}</th>
                <th className="py-2 text-end">{t('sales.sold')}</th>
                <th className="py-2 text-end">{t('sales.returned')}</th>
                <th className="py-2 text-end">{t('sales.return.qty')}</th>
                <th className="py-2 text-center">{t('sales.return.restock')}</th>
              </tr>
            </thead>
            <tbody>
              {returnableItems.map(item => {
                const maxReturnable = item.quantity - item.returnedQty
                return (
                  <tr key={item.id} className="border-b border-gray-50 dark:border-gray-700">
                    <td className="py-2">{item.description}</td>
                    <td className="py-2 text-end">{item.quantity}</td>
                    <td className="py-2 text-end">{item.returnedQty}</td>
                    <td className="py-2 text-end">
                      <input type="number" min="0" max={maxReturnable}
                        className="form-input w-16 text-sm text-end"
                        value={qtys[item.id] ?? 0}
                        onChange={e => setQty(item.id, Number(e.target.value))} />
                    </td>
                    <td className="py-2 text-center">
                      <input type="checkbox"
                        checked={restock[item.id] !== false}
                        onChange={e => setRestock(prev => ({ ...prev, [item.id]: e.target.checked }))} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalRefundPreview > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-3 text-sm flex justify-between">
          <span>{t('sales.return.estimatedRefund')}</span>
          <span className="font-semibold">{totalRefundPreview.toFixed(2)}</span>
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={() => navigate(`/sales/${id}`)}>{t('common.cancel')}</Button>
        <Button loading={saving} onClick={handleSubmit}>{t('sales.return.submit')}</Button>
      </div>
    </div>
  )
}
