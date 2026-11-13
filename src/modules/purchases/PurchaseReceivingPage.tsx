import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../../database/db'
import { receivePurchaseItems } from './PurchaseService'
import type { Purchase, PurchaseItem } from '../../database/schema'

export default function PurchaseReceivingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    db.purchases.get(id).then(p => {
      if (!p) return
      setPurchase(p)
      db.purchaseItems.where('purchaseId').equals(id).toArray().then(its => {
        const outstanding = its.filter(i => i.orderedQty > i.receivedQty)
        setItems(outstanding)
        const initial: Record<string, number> = {}
        outstanding.forEach(i => { initial[i.id] = i.orderedQty - i.receivedQty })
        setQtys(initial)
      })
    })
  }, [id])

  if (!purchase) return <div className="p-4 text-gray-500">{t('common.loading')}</div>

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setError('')
    setSubmitting(true)
    try {
      const receivingItems = Object.entries(qtys)
        .map(([itemId, qty]) => ({ itemId, qty }))
        .filter(({ qty }) => qty > 0)
      if (receivingItems.length === 0) {
        setError(t('purchases.noQtyToReceive'))
        return
      }
      await receivePurchaseItems(id, receivingItems, receivedDate)
      navigate(`/purchases/${id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="p-4 max-w-2xl mx-auto text-center space-y-4">
        <p className="text-gray-500">{t('purchases.allReceived')}</p>
        <button className="btn-secondary" onClick={() => navigate(`/purchases/${id}`)}>
          {t('common.back')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/purchases/${id}`)} className="text-gray-500 hover:text-gray-700 text-sm">
          ← {t('common.back')}
        </button>
        <h1 className="text-xl font-semibold">
          {t('purchases.receiving')} — {purchase.purchaseNumber}
        </h1>
      </div>

      {error && (
        <div className="rounded bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">{t('purchases.receivedDate')}</label>
          <input
            type="date"
            className="form-input max-w-xs"
            value={receivedDate}
            onChange={e => setReceivedDate(e.target.value)}
            required
          />
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-start">{t('purchases.product')}</th>
                <th className="px-4 py-3 text-end">{t('purchases.ordered')}</th>
                <th className="px-4 py-3 text-end">{t('purchases.alreadyReceived')}</th>
                <th className="px-4 py-3 text-end">{t('purchases.outstanding')}</th>
                <th className="px-4 py-3 text-end">{t('purchases.qtyToReceive')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {items.map(item => {
                const outstanding = item.orderedQty - item.receivedQty
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-gray-500">{item.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-end font-mono">{item.orderedQty}</td>
                    <td className="px-4 py-3 text-end font-mono">{item.receivedQty}</td>
                    <td className="px-4 py-3 text-end font-mono">{outstanding}</td>
                    <td className="px-4 py-3 text-end">
                      <input
                        type="number"
                        min={0}
                        max={outstanding}
                        value={qtys[item.id] ?? 0}
                        onChange={e => setQtys(q => ({ ...q, [item.id]: Number(e.target.value) }))}
                        className="form-input w-20 text-end"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? t('common.saving') : t('purchases.confirmReceiving')}
          </button>
          <button type="button" onClick={() => navigate(`/purchases/${id}`)} className="btn-secondary">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
