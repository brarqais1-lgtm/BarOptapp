import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'
import { getSupplierStats, archiveSupplier, restoreSupplier, type SupplierStats } from './SupplierRepository'
import type { Supplier, Purchase } from '../../database/schema'

export default function SupplierDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [stats, setStats] = useState<SupplierStats | null>(null)

  useEffect(() => {
    if (!id) return
    db.suppliers.get(id).then(s => setSupplier(s ?? null))
    getSupplierStats(id).then(setStats)
  }, [id])

  const purchases = useLiveQuery<Purchase[]>(async () => {
    if (!id) return []
    return db.purchases
      .where('supplierId').equals(id)
      .filter(p => !p.deletedAt)
      .reverse()
      .sortBy('purchaseDate')
  }, [id])

  if (!supplier) return <div className="p-4 text-gray-500">{t('common.loading')}</div>

  async function handleToggleArchive() {
    if (!id) return
    if (supplier?.deletedAt) {
      await restoreSupplier(id)
      setSupplier(prev => prev ? { ...prev, deletedAt: undefined } : prev)
    } else {
      await archiveSupplier(id)
      setSupplier(prev => prev ? { ...prev, deletedAt: new Date().toISOString() } : prev)
    }
  }

  const statusColor: Record<string, string> = {
    draft: 'badge-gray',
    ordered: 'badge-blue',
    partial: 'badge-yellow',
    received: 'badge-green',
    cancelled: 'badge-red',
  }

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{supplier.name}</h1>
          {supplier.deletedAt && (
            <span className="badge-red text-xs mt-1">{t('common.archived')}</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary text-sm"
            onClick={() => navigate(`/suppliers/${id}/edit`)}
          >
            {t('common.edit')}
          </button>
          <button
            className={`text-sm px-3 py-1.5 rounded ${supplier.deletedAt ? 'btn-primary' : 'btn-danger'}`}
            onClick={handleToggleArchive}
          >
            {supplier.deletedAt ? t('common.restore') : t('common.archive')}
          </button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('suppliers.stats.totalOrders'), value: stats?.totalOrders ?? 0 },
          { label: t('suppliers.stats.totalReceived'), value: stats?.totalReceived ?? 0 },
          { label: t('suppliers.stats.totalValue'), value: `${stats?.totalValue?.toFixed(2) ?? '0.00'}` },
          { label: t('suppliers.stats.lastOrder'), value: stats?.lastOrderDate ? stats.lastOrderDate.slice(0, 10) : '—' },
        ].map(card => (
          <div key={card.label} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className="text-lg font-semibold mt-0.5">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Contact info */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2 text-sm">
        {supplier.contactName && <p><span className="text-gray-500">{t('suppliers.contact')}:</span> {supplier.contactName}</p>}
        {supplier.phone && <p><span className="text-gray-500">{t('suppliers.phone')}:</span> {supplier.phone}</p>}
        {supplier.email && <p><span className="text-gray-500">{t('suppliers.email')}:</span> {supplier.email}</p>}
        {supplier.address && <p><span className="text-gray-500">{t('suppliers.address')}:</span> {supplier.address}</p>}
        {supplier.taxNumber && <p><span className="text-gray-500">{t('suppliers.taxNumber')}:</span> {supplier.taxNumber}</p>}
        {supplier.paymentTerms && <p><span className="text-gray-500">{t('suppliers.paymentTerms')}:</span> {supplier.paymentTerms}</p>}
        {supplier.notes && <p><span className="text-gray-500">{t('common.notes')}:</span> {supplier.notes}</p>}
      </div>

      {/* Purchase history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{t('suppliers.purchaseHistory')}</h2>
          <button
            className="btn-primary text-sm"
            onClick={() => navigate(`/purchases/new?supplierId=${id}`)}
          >
            {t('purchases.newPO')}
          </button>
        </div>
        {!purchases?.length ? (
          <p className="text-sm text-gray-500">{t('suppliers.noPurchases')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-start">{t('purchases.poNumber')}</th>
                  <th className="px-4 py-3 text-start">{t('purchases.date')}</th>
                  <th className="px-4 py-3 text-start">{t('common.status')}</th>
                  <th className="px-4 py-3 text-end">{t('purchases.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {purchases.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3">
                      <button
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                        onClick={() => navigate(`/purchases/${p.id}`)}
                      >
                        {p.purchaseNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3">{(p.purchaseDate ?? p.createdAt).slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <span className={statusColor[p.status] ?? 'badge-gray'}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-end">{p.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
