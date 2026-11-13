import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'

const STATUS_OPTIONS = ['', 'draft', 'ordered', 'partial', 'received', 'cancelled']

const statusColor: Record<string, string> = {
  draft: 'badge-gray',
  ordered: 'badge-blue',
  partial: 'badge-yellow',
  received: 'badge-green',
  cancelled: 'badge-red',
}

export default function PurchasesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const purchases = useLiveQuery(async () => {
    let all = await db.purchases.filter(p => !p.deletedAt).toArray()
    if (statusFilter) all = all.filter(p => p.status === statusFilter)
    if (query) {
      const q = query.toLowerCase()
      all = all.filter(p =>
        p.purchaseNumber.toLowerCase().includes(q) ||
        (p.invoiceNumber ?? '').toLowerCase().includes(q)
      )
    }
    return all.sort((a, b) =>
      (b.purchaseDate ?? b.createdAt).localeCompare(a.purchaseDate ?? a.createdAt)
    )
  }, [query, statusFilter])

  const supplierMap = useLiveQuery(async () => {
    const suppliers = await db.suppliers.toArray()
    return new Map(suppliers.map(s => [s.id, s.name]))
  }, [])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">{t('purchases.title')}</h1>
        <button onClick={() => navigate('/purchases/new')} className="btn-primary">
          {t('purchases.newPO')}
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          className="form-input flex-1 min-w-48"
          placeholder={t('common.search')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select
          className="form-input w-40"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s || t('common.allStatuses')}</option>
          ))}
        </select>
      </div>

      {!purchases?.length ? (
        <p className="text-center text-gray-500 py-12">{t('purchases.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-start">{t('purchases.poNumber')}</th>
                <th className="px-4 py-3 text-start">{t('purchases.supplier')}</th>
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
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={() => navigate(`/purchases/${p.id}`)}
                    >
                      {p.purchaseNumber}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {supplierMap?.get(p.supplierId) ?? p.supplierId}
                  </td>
                  <td className="px-4 py-3">{(p.purchaseDate ?? p.createdAt).slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <span className={statusColor[p.status] ?? 'badge-gray'}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-end font-mono">{p.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
