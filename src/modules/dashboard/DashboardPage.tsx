import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../../database/db'
import { getDashboardSummary, getLast7DaysRevenue } from './DashboardRepository'
import { PageSpinner } from '../../components/ui/Spinner'
import type { Sale } from '../../database/schema'
import type { Patient } from '../../database/schema'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  color = 'blue',
  icon,
  onClick,
}: {
  label: string
  value: string | number
  sub?: string
  color?: 'blue' | 'green' | 'amber' | 'red' | 'teal' | 'slate'
  icon: string
  onClick?: () => void
}) {
  const colorMap = {
    blue:  'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    red:   'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    teal:  'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300',
    slate: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  }
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl p-5 ${colorMap[color]} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
    </div>
  )
}

// ── Revenue Bar Chart (pure CSS) ──────────────────────────────────────────────

function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  const { t } = useTranslation()
  const max = Math.max(...data.map(d => d.revenue), 1)

  const dayLabel = (date: string) => {
    const d = new Date(date + 'T12:00:00')
    return d.toLocaleDateString(undefined, { weekday: 'short' })
  }

  return (
    <div>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">
        {t('dashboard.last7Days')}
      </p>
      <div className="flex items-end gap-1.5 h-28">
        {data.map(({ date, revenue }) => (
          <div key={date} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative flex-1 w-full flex items-end justify-center">
              <div
                className="w-full rounded-t-md bg-blue-500 dark:bg-blue-600 transition-all group-hover:bg-blue-700 dark:group-hover:bg-blue-500"
                style={{ height: `${Math.max((revenue / max) * 100, revenue > 0 ? 8 : 2)}%` }}
                title={fmt(revenue)}
              />
            </div>
            <span
              className={`text-[10px] font-medium ${date === today() ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}
            >
              {dayLabel(date)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pending Orders Row ────────────────────────────────────────────────────────

function OrderRow({ sale }: { sale: Sale }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isOverdue = sale.readyDate && sale.readyDate < today()

  const statusColor: Record<string, string> = {
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    ready:     'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  }

  return (
    <tr
      className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${isOverdue ? 'bg-red-50/60 dark:bg-red-900/10' : ''}`}
      onClick={() => navigate(`/sales/${sale.id}`)}
    >
      <td className="py-2.5 px-3 text-sm font-mono text-slate-500">{sale.saleNumber}</td>
      <td className="py-2.5 px-3 text-sm text-slate-700 dark:text-slate-300">
        {sale.walkInName || '—'}
      </td>
      <td className="py-2.5 px-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[sale.status] ?? ''}`}>
          {t(`sales.status.${sale.status}`)}
        </span>
      </td>
      <td className={`py-2.5 px-3 text-sm ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-500'}`}>
        {sale.readyDate ?? '—'}
        {isOverdue && ' ⚠'}
      </td>
    </tr>
  )
}

// ── Recent Patients Row ───────────────────────────────────────────────────────

function PatientRow({ patient }: { patient: Patient }) {
  const navigate = useNavigate()
  return (
    <tr
      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
      onClick={() => navigate(`/patients/${patient.id}`)}
    >
      <td className="py-2.5 px-3 text-sm font-mono text-slate-500">{patient.fileNumber}</td>
      <td className="py-2.5 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
        {patient.fullName}
      </td>
      <td className="py-2.5 px-3 text-sm text-slate-500 dir-ltr" dir="ltr">
        {patient.phone ?? '—'}
      </td>
    </tr>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const summary = useLiveQuery(() => getDashboardSummary(db), [])
  const chartData = useLiveQuery(() => getLast7DaysRevenue(db), [])

  if (!summary || !chartData) return <PageSpinner />

  const { sales, patientsToday, pendingOrdersCount, pendingOrders, recentPatients, lowStockCount, outOfStockCount } = summary
  const alertCount = lowStockCount + outOfStockCount

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('dashboard.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {/* Quick Actions */}
        <div className="hidden sm:flex gap-2">
          <button
            onClick={() => navigate('/patients/new')}
            className="px-3 py-2 text-sm rounded-xl bg-blue-700 text-white hover:bg-blue-800 transition-colors"
          >
            + {t('patients.new')}
          </button>
          <button
            onClick={() => navigate('/sales/new')}
            className="px-3 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            + {t('sales.new')}
          </button>
        </div>
      </div>

      {/* Alert banner — low stock */}
      {alertCount > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate('/inventory')}
        >
          <span className="text-lg">⚠️</span>
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {t('dashboard.stockAlert', { count: alertCount })}
          </span>
          <span className="ms-auto text-xs text-amber-600 dark:text-amber-400 underline">
            {t('dashboard.viewInventory')}
          </span>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label={t('dashboard.todayRevenue')}
          value={fmt(sales.todayRevenue)}
          sub={t('dashboard.invoicesCount', { count: sales.todaySales })}
          color="blue"
          icon="💰"
          onClick={() => navigate('/sales')}
        />
        <KpiTile
          label={t('dashboard.monthRevenue')}
          value={fmt(sales.monthRevenue)}
          sub={t('dashboard.invoicesCount', { count: sales.monthSales })}
          color="green"
          icon="📈"
          onClick={() => navigate('/sales')}
        />
        <KpiTile
          label={t('dashboard.pendingOrders')}
          value={pendingOrdersCount}
          sub={t('dashboard.awaitingPickup')}
          color={pendingOrdersCount > 0 ? 'teal' : 'slate'}
          icon="🕶"
          onClick={() => navigate('/sales')}
        />
        <KpiTile
          label={t('dashboard.patientsToday')}
          value={patientsToday}
          sub={t('dashboard.registeredToday')}
          color={patientsToday > 0 ? 'teal' : 'slate'}
          icon="👤"
          onClick={() => navigate('/patients')}
        />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label={t('dashboard.totalOutstanding')}
          value={fmt(sales.totalOutstanding)}
          color={sales.totalOutstanding > 0 ? 'amber' : 'slate'}
          icon="⏳"
          onClick={() => navigate('/sales')}
        />
        <KpiTile
          label={t('dashboard.totalCollected')}
          value={fmt(sales.totalCollected)}
          color="slate"
          icon="✅"
        />
        <KpiTile
          label={t('dashboard.totalInvoices')}
          value={sales.totalInvoices}
          color="slate"
          icon="🧾"
          onClick={() => navigate('/sales')}
        />
        <KpiTile
          label={t('dashboard.totalReturns')}
          value={sales.totalReturns}
          sub={sales.totalRefundsIssued > 0 ? fmt(sales.totalRefundsIssued) : undefined}
          color={sales.totalReturns > 0 ? 'red' : 'slate'}
          icon="↩"
          onClick={() => navigate('/sales')}
        />
      </div>

      {/* Chart + pending orders */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Revenue sparkline */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <RevenueChart data={chartData} />
        </div>

        {/* Pending orders */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {t('dashboard.pendingOrdersList')}
            </p>
            {pendingOrdersCount > 6 && (
              <button
                onClick={() => navigate('/sales')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t('dashboard.viewAll')}
              </button>
            )}
          </div>
          {pendingOrders.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">{t('dashboard.noOrders')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="pb-2 px-3 text-start font-medium">#</th>
                    <th className="pb-2 px-3 text-start font-medium">{t('patients.fullName')}</th>
                    <th className="pb-2 px-3 text-start font-medium">{t('common.status')}</th>
                    <th className="pb-2 px-3 text-start font-medium">{t('sales.readyDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map(sale => (
                    <OrderRow key={sale.id} sale={sale} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent patients */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {t('dashboard.recentPatients')}
          </p>
          <button
            onClick={() => navigate('/patients')}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('dashboard.viewAll')}
          </button>
        </div>
        {recentPatients.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">{t('dashboard.noPatients')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-2 px-3 text-start font-medium">{t('patients.fileNumber')}</th>
                  <th className="pb-2 px-3 text-start font-medium">{t('patients.fullName')}</th>
                  <th className="pb-2 px-3 text-start font-medium">{t('patients.phone')}</th>
                </tr>
              </thead>
              <tbody>
                {recentPatients.map(patient => (
                  <PatientRow key={patient.id} patient={patient} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
