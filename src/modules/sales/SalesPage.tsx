import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'
import { Button } from '../../components/ui/Button'
import { Badge, type BadgeVariant } from '../../components/ui/Badge'
import { getSalesDashboardStats, getSalesReport, getPendingOrders, markSaleReady, markSaleDelivered, type SaleFilters } from './SalesRepository'

type Tab = 'dashboard' | 'invoices' | 'orders' | 'reports'

const statusBadge: Record<string, BadgeVariant> = {
  draft: 'gray', confirmed: 'blue', cancelled: 'red',
}
const paymentBadge: Record<string, BadgeVariant> = {
  unpaid: 'red', partial: 'yellow', paid: 'green',
}

export default function SalesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('orders')
  const [orderWorking, setOrderWorking] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const stats = useLiveQuery(() => getSalesDashboardStats(), [])

  const sales = useLiveQuery(async () => {
    if (tab !== 'invoices') return undefined
    const filters: SaleFilters = {}
    if (query) filters.query = query
    if (statusFilter) filters.status = statusFilter
    if (paymentFilter) filters.paymentStatus = paymentFilter
    if (fromDate) filters.fromDate = fromDate
    if (toDate) filters.toDate = toDate
    return getSalesReport(filters)
  }, [tab, query, statusFilter, paymentFilter, fromDate, toDate])

  const pendingOrders = useLiveQuery(() => getPendingOrders(), [])

  const reportRows = useLiveQuery(async () => {
    if (tab !== 'reports') return undefined
    const filters: SaleFilters = {}
    if (fromDate) filters.fromDate = fromDate
    if (toDate) filters.toDate = toDate
    if (statusFilter) filters.status = statusFilter
    if (paymentFilter) filters.paymentStatus = paymentFilter
    return getSalesReport(filters)
  }, [tab, fromDate, toDate, statusFilter, paymentFilter])

  const patientMap = useLiveQuery(async () => {
    const patients = await db.patients.toArray()
    return new Map(patients.map(p => [p.id, p.fullName]))
  }, [])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'orders', label: t('sales.tabs.orders') },
    { key: 'invoices', label: t('sales.tabs.invoices') },
    { key: 'dashboard', label: t('sales.tabs.dashboard') },
    { key: 'reports', label: t('sales.tabs.reports') },
  ]

  const today = new Date().toISOString().slice(0, 10)

  async function doMarkReady(saleId: string) {
    setOrderWorking(saleId)
    try { await markSaleReady(saleId) }
    finally { setOrderWorking(null) }
  }

  async function doMarkDelivered(saleId: string) {
    setOrderWorking(saleId)
    try { await markSaleDelivered(saleId) }
    finally { setOrderWorking(null) }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">{t('sales.title')}</h1>
        <Button onClick={() => navigate('/sales/new')}>{t('sales.newInvoice')}</Button>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="space-y-3">
          {!pendingOrders?.length ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">✅</p>
              <p className="font-medium">{t('sales.ordersEmpty')}</p>
              <p className="text-sm">{t('sales.ordersEmptyHint')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-start">{t('sales.invoiceNumber')}</th>
                    <th className="px-4 py-3 text-start">{t('sales.customer')}</th>
                    <th className="px-4 py-3 text-start">{t('sales.date')}</th>
                    <th className="px-4 py-3 text-start">{t('sales.readyDate')}</th>
                    <th className="px-4 py-3 text-start">{t('common.status')}</th>
                    <th className="px-4 py-3 text-end">{t('sales.total')}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {pendingOrders.map(s => {
                    const isOverdue = s.readyDate && s.readyDate < today && s.status !== 'ready'
                    return (
                      <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${isOverdue ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs">{s.saleNumber}</td>
                        <td className="px-4 py-3">
                          {s.patientId ? (patientMap?.get(s.patientId) ?? '—') : (s.walkInName ?? t('sales.walkIn'))}
                        </td>
                        <td className="px-4 py-3">{s.saleDate}</td>
                        <td className="px-4 py-3">
                          {s.readyDate
                            ? <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{s.readyDate}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={s.status === 'ready' ? 'teal' : 'blue'}>
                            {t(`sales.status.${s.status}`)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-end">{s.total.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            {s.status === 'confirmed' && (
                              <Button size="sm" loading={orderWorking === s.id} onClick={() => doMarkReady(s.id)}>
                                {t('sales.markReady')}
                              </Button>
                            )}
                            {s.status === 'ready' && (
                              <Button size="sm" loading={orderWorking === s.id} onClick={() => doMarkDelivered(s.id)}>
                                {t('sales.markDelivered')}
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/sales/${s.id}`)}>
                              {t('common.view')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'dashboard' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t('sales.stats.todaySales'), value: stats.todaySales },
              { label: t('sales.stats.todayRevenue'), value: stats.todayRevenue.toFixed(2) },
              { label: t('sales.stats.monthSales'), value: stats.monthSales },
              { label: t('sales.stats.monthRevenue'), value: stats.monthRevenue.toFixed(2) },
              { label: t('sales.stats.totalCollected'), value: stats.totalCollected.toFixed(2) },
              { label: t('sales.stats.outstanding'), value: stats.totalOutstanding.toFixed(2) },
              { label: t('sales.stats.totalRefunds'), value: stats.totalRefundsIssued.toFixed(2) },
              { label: t('sales.stats.totalInvoices'), value: stats.totalInvoices },
              { label: t('sales.stats.totalReturns'), value: stats.totalReturns },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              {t('sales.recentInvoices')}
            </h2>
            <RecentSalesList patientMap={patientMap} onView={id => navigate(`/sales/${id}`)} />
          </div>
        </div>
      )}

      {tab === 'invoices' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <input
              className="form-input flex-1 min-w-48"
              placeholder={t('common.search')}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <select className="form-input w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">{t('common.allStatuses')}</option>
              <option value="draft">{t('sales.status.draft')}</option>
              <option value="confirmed">{t('sales.status.confirmed')}</option>
              <option value="cancelled">{t('sales.status.cancelled')}</option>
            </select>
            <select className="form-input w-40" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
              <option value="">{t('sales.allPaymentStatuses')}</option>
              <option value="unpaid">{t('sales.payment.unpaid')}</option>
              <option value="partial">{t('sales.payment.partial')}</option>
              <option value="paid">{t('sales.payment.paid')}</option>
            </select>
            <input type="date" className="form-input w-36" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <input type="date" className="form-input w-36" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>

          {!sales?.length ? (
            <p className="text-center text-gray-500 py-12">{t('sales.empty')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-start">{t('sales.invoiceNumber')}</th>
                    <th className="px-4 py-3 text-start">{t('sales.customer')}</th>
                    <th className="px-4 py-3 text-start">{t('sales.date')}</th>
                    <th className="px-4 py-3 text-start">{t('common.status')}</th>
                    <th className="px-4 py-3 text-start">{t('sales.payment.status')}</th>
                    <th className="px-4 py-3 text-end">{t('sales.total')}</th>
                    <th className="px-4 py-3 text-end">{t('sales.balance')}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sales.map(s => (
                    <tr key={s.saleId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 font-mono text-xs">{s.saleNumber}</td>
                      <td className="px-4 py-3">
                        {s.patientId ? (patientMap?.get(s.patientId) ?? '—') : (s.walkInName ?? t('sales.walkIn'))}
                      </td>
                      <td className="px-4 py-3">{s.saleDate}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadge[s.status] ?? 'gray'}>{t(`sales.status.${s.status}`)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={paymentBadge[s.paymentStatus] ?? 'gray'}>{t(`sales.payment.${s.paymentStatus}`)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-end">{s.total.toFixed(2)}</td>
                      <td className="px-4 py-3 text-end">{s.balanceDue.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/sales/${s.saleId}`)}>
                          {t('common.view')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <select className="form-input w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">{t('common.allStatuses')}</option>
              <option value="draft">{t('sales.status.draft')}</option>
              <option value="confirmed">{t('sales.status.confirmed')}</option>
              <option value="cancelled">{t('sales.status.cancelled')}</option>
            </select>
            <select className="form-input w-40" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
              <option value="">{t('sales.allPaymentStatuses')}</option>
              <option value="unpaid">{t('sales.payment.unpaid')}</option>
              <option value="partial">{t('sales.payment.partial')}</option>
              <option value="paid">{t('sales.payment.paid')}</option>
            </select>
            <input type="date" className="form-input w-36" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <input type="date" className="form-input w-36" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>

          {reportRows && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {(() => {
                  const active = reportRows.filter(r => r.status !== 'cancelled')
                  const totalRev = active.reduce((s, r) => s + r.total, 0)
                  const totalReturned = active.reduce((s, r) => s + r.returnedAmount, 0)
                  const totalNet = active.reduce((s, r) => s + r.netRevenue, 0)
                  const totalPaid = active.reduce((s, r) => s + r.paidAmount, 0)
                  const totalBal = active.reduce((s, r) => s + r.balanceDue, 0)
                  return [
                    { label: t('sales.stats.invoiceCount'), value: active.length },
                    { label: t('sales.stats.totalRevenue'), value: totalRev.toFixed(2) },
                    { label: t('sales.stats.totalRefunds'), value: totalReturned.toFixed(2) },
                    { label: t('sales.stats.netRevenue'), value: totalNet.toFixed(2) },
                    { label: t('sales.stats.collected'), value: totalPaid.toFixed(2) },
                    { label: t('sales.stats.outstanding'), value: totalBal.toFixed(2) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                    </div>
                  ))
                })()}
              </div>

              {reportRows.length === 0 ? (
                <p className="text-center text-gray-500 py-8">{t('sales.empty')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <th className="py-2 text-start">{t('sales.invoiceNumber')}</th>
                        <th className="py-2 text-start">{t('sales.date')}</th>
                        <th className="py-2 text-start">{t('sales.customer')}</th>
                        <th className="py-2 text-start">{t('common.status')}</th>
                        <th className="py-2 text-end">{t('sales.total')}</th>
                        <th className="py-2 text-end">{t('sales.stats.returned')}</th>
                        <th className="py-2 text-end">{t('sales.stats.netRevenue')}</th>
                        <th className="py-2 text-end">{t('sales.paid')}</th>
                        <th className="py-2 text-end">{t('sales.balance')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.map(r => (
                        <tr key={r.saleId} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => navigate(`/sales/${r.saleId}`)}>
                          <td className="py-2 font-mono text-xs">{r.saleNumber}</td>
                          <td className="py-2">{r.saleDate}</td>
                          <td className="py-2">
                            {r.patientId ? (patientMap?.get(r.patientId) ?? '—') : (r.walkInName ?? t('sales.walkIn'))}
                          </td>
                          <td className="py-2">
                            <Badge variant={statusBadge[r.status] ?? 'gray'}>{t(`sales.status.${r.status}`)}</Badge>
                          </td>
                          <td className="py-2 text-end">{r.total.toFixed(2)}</td>
                          <td className="py-2 text-end text-red-500">{r.returnedAmount > 0 ? `-${r.returnedAmount.toFixed(2)}` : '—'}</td>
                          <td className="py-2 text-end font-medium">{r.netRevenue.toFixed(2)}</td>
                          <td className="py-2 text-end">{r.paidAmount.toFixed(2)}</td>
                          <td className="py-2 text-end">{r.balanceDue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RecentSalesList({
  patientMap,
  onView,
}: {
  patientMap: Map<string, string> | undefined
  onView: (id: string) => void
}) {
  const { t } = useTranslation()
  const recent = useLiveQuery(async () => {
    const all = await db.sales.filter(s => !s.deletedAt).toArray()
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10)
  }, [])

  if (!recent?.length) return <p className="text-sm text-gray-400">{t('sales.empty')}</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-2 text-start">{t('sales.invoiceNumber')}</th>
            <th className="px-4 py-2 text-start">{t('sales.customer')}</th>
            <th className="px-4 py-2 text-end">{t('sales.total')}</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {recent.map(s => (
            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-4 py-2 font-mono text-xs">{s.saleNumber}</td>
              <td className="px-4 py-2">
                {s.patientId ? (patientMap?.get(s.patientId) ?? '—') : (s.walkInName ?? t('sales.walkIn'))}
              </td>
              <td className="px-4 py-2 text-end">{s.total.toFixed(2)}</td>
              <td className="px-4 py-2">
                <Button size="sm" variant="ghost" onClick={() => onView(s.id)}>{t('common.view')}</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
