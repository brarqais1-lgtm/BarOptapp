import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'
import { markAsOrdered, cancelPurchase, getPurchaseMovements } from './PurchaseService'
import type { Purchase, PurchaseItem, Supplier, InventoryMovement } from '../../database/schema'

const statusColor: Record<string, string> = {
  draft: 'badge-gray',
  ordered: 'badge-blue',
  partial: 'badge-yellow',
  received: 'badge-green',
  cancelled: 'badge-red',
}

export default function PurchaseDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  const items = useLiveQuery<PurchaseItem[]>(() =>
    id ? db.purchaseItems.where('purchaseId').equals(id).toArray() : Promise.resolve([])
  , [id])

  useEffect(() => {
    if (!id) return
    db.purchases.get(id).then(p => {
      setPurchase(p ?? null)
      if (p) db.suppliers.get(p.supplierId).then(s => setSupplier(s ?? null))
    })
    getPurchaseMovements(id).then(setMovements)
    Promise.all([
      db.frames.filter(fr => !fr.deletedAt).toArray(),
      db.lenses.filter(l => !l.deletedAt).toArray(),
    ]).then(([frames, lenses]) => {
      const map: Record<string, string> = {}
      frames.forEach(fr => { if (fr.id && fr.name) map[fr.id] = fr.name })
      lenses.forEach(l => { if (l.id && l.name) map[l.id] = l.name })
      setProductNames(map)
    })
  }, [id])

  if (!purchase) return <div className="p-4 text-gray-500">{t('common.loading')}</div>

  async function handleMarkOrdered() {
    if (!id) return
    try {
      await markAsOrdered(id)
      const updated = await db.purchases.get(id)
      if (updated) setPurchase(updated)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleCancel() {
    if (!id) return
    try {
      await cancelPurchase(id)
      const updated = await db.purchases.get(id)
      if (updated) setPurchase(updated)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const canOrder = purchase.status === 'draft'
  const canReceive = purchase.status === 'ordered' || purchase.status === 'partial'
  const canCancel = purchase.status !== 'received' && purchase.status !== 'cancelled'

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      {error && (
        <div className="rounded bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{purchase.purchaseNumber}</h1>
            <span className={statusColor[purchase.status] ?? 'badge-gray'}>{purchase.status}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {supplier?.name ?? purchase.supplierId} · {(purchase.purchaseDate ?? purchase.createdAt).slice(0, 10)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canOrder && (
            <button className="btn-primary text-sm" onClick={handleMarkOrdered}>
              {t('purchases.markOrdered')}
            </button>
          )}
          {canReceive && (
            <button className="btn-primary text-sm" onClick={() => navigate(`/purchases/${id}/receive`)}>
              {t('purchases.receive')}
            </button>
          )}
          {canCancel && (
            <button className="btn-danger text-sm" onClick={handleCancel}>
              {t('purchases.cancel')}
            </button>
          )}
        </div>
      </div>

      {/* Meta */}
      {(purchase.invoiceNumber || purchase.expectedDeliveryDate || purchase.notes) && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm space-y-1">
          {purchase.invoiceNumber && <p><span className="text-gray-500">{t('purchases.invoiceNumber')}:</span> {purchase.invoiceNumber}</p>}
          {purchase.expectedDeliveryDate && <p><span className="text-gray-500">{t('purchases.expectedDelivery')}:</span> {purchase.expectedDeliveryDate}</p>}
          {purchase.notes && <p><span className="text-gray-500">{t('common.notes')}:</span> {purchase.notes}</p>}
        </div>
      )}

      {/* Items */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-start">{t('purchases.product')}</th>
              <th className="px-4 py-3 text-end">{t('purchases.qty')}</th>
              <th className="px-4 py-3 text-end">{t('purchases.received')}</th>
              <th className="px-4 py-3 text-end">{t('purchases.outstanding')}</th>
              <th className="px-4 py-3 text-end">{t('purchases.unitCost')}</th>
              <th className="px-4 py-3 text-end">{t('purchases.lineTotal')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items?.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{item.description}</p>
                  <p className="text-xs text-gray-500">{item.sku}</p>
                </td>
                <td className="px-4 py-3 text-end font-mono">{item.orderedQty}</td>
                <td className="px-4 py-3 text-end font-mono">{item.receivedQty}</td>
                <td className="px-4 py-3 text-end font-mono">{item.orderedQty - item.receivedQty}</td>
                <td className="px-4 py-3 text-end font-mono">{item.unitCost.toFixed(2)}</td>
                <td className="px-4 py-3 text-end font-mono">{item.lineTotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="text-sm space-y-1 min-w-48">
          <p className="flex justify-between gap-6 text-gray-500">
            <span>{t('purchases.subtotal')}</span>
            <span className="font-mono">{purchase.subtotal.toFixed(2)}</span>
          </p>
          {purchase.discountAmount > 0 && (
            <p className="flex justify-between gap-6 text-gray-500">
              <span>{t('purchases.orderDiscount')}</span>
              <span className="font-mono">-{purchase.discountAmount.toFixed(2)}</span>
            </p>
          )}
          {purchase.taxAmount > 0 && (
            <p className="flex justify-between gap-6 text-gray-500">
              <span>{t('purchases.orderTax')}</span>
              <span className="font-mono">+{purchase.taxAmount.toFixed(2)}</span>
            </p>
          )}
          <p className="flex justify-between gap-6 font-semibold border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
            <span>{t('purchases.total')}</span>
            <span className="font-mono">{purchase.total.toFixed(2)}</span>
          </p>
        </div>
      </div>

      {/* Stock movements */}
      {movements.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">{t('purchases.stockMovements')}</h2>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-start">{t('inventory.movements.product')}</th>
                  <th className="px-4 py-3 text-end">{t('inventory.movements.qty')}</th>
                  <th className="px-4 py-3 text-start">{t('inventory.movements.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {movements.map(m => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">{productNames[m.itemId] ?? m.itemId.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-end font-mono">+{m.quantity}</td>
                    <td className="px-4 py-3">{m.movementDate.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
