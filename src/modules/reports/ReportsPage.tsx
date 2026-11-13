import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'
import {
  getProfitLossReport, getMonthlySalesSummary, getInventoryValuation,
  type SalesSummaryRow, type InventoryValuationSummary,
} from './ReportsRepository'
import { EXPENSE_CATEGORIES } from '../expenses/ExpenseRepository'
import { PageSpinner } from '../../components/ui/Spinner'

type Tab = 'pl' | 'sales' | 'inventory'

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(n: number) {
  return (n >= 0 ? '' : '') + n.toFixed(1) + '%'
}

function thisMonthRange() {
  const today = new Date().toISOString().slice(0, 10)
  return { from: today.slice(0, 7) + '-01', to: today }
}

function thisYearRange() {
  const today = new Date().toISOString().slice(0, 10)
  return { from: today.slice(0, 4) + '-01-01', to: today }
}

// ── P&L line ──────────────────────────────────────────────────────────────────

function PLRow({
  label,
  value,
  indent = false,
  bold = false,
  color,
  borderTop = false,
}: {
  label: string
  value: number
  indent?: boolean
  bold?: boolean
  color?: 'green' | 'red' | 'amber'
  borderTop?: boolean
}) {
  const colorClass = color === 'green'
    ? 'text-green-600 dark:text-green-400'
    : color === 'red'
      ? 'text-red-600 dark:text-red-400'
      : color === 'amber'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-slate-700 dark:text-slate-300'

  return (
    <div className={`flex justify-between items-baseline py-2 px-4 ${borderTop ? 'border-t border-slate-200 dark:border-slate-700' : ''} ${bold ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}>
      <span className={`text-sm ${indent ? 'ps-4 text-slate-500 dark:text-slate-400' : bold ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>
        {label}
      </span>
      <span className={`text-sm font-mono ${bold ? 'font-bold text-base' : ''} ${colorClass}`}>
        {value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value)}
      </span>
    </div>
  )
}

// ── P&L Tab ───────────────────────────────────────────────────────────────────

function PLTab() {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<'month' | 'year' | 'custom'>('month')
  const [fromDate, setFromDate] = useState(thisMonthRange().from)
  const [toDate, setToDate] = useState(thisMonthRange().to)

  function applyPreset(p: 'month' | 'year') {
    setPreset(p)
    const range = p === 'month' ? thisMonthRange() : thisYearRange()
    setFromDate(range.from)
    setToDate(range.to)
  }

  const report = useLiveQuery(
    () => getProfitLossReport(fromDate, toDate, db),
    [fromDate, toDate],
  )

  if (!report) return <PageSpinner />

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex flex-wrap items-end gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
        <div className="flex gap-1">
          {(['month', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${preset === p ? 'bg-blue-700 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              {t(`reports.period.${p}`)}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">{t('expenses.fromDate')}</label>
            <input type="date" className="form-input text-sm" value={fromDate}
              onChange={e => { setFromDate(e.target.value); setPreset('custom') }} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">{t('expenses.toDate')}</label>
            <input type="date" className="form-input text-sm" value={toDate}
              onChange={e => { setToDate(e.target.value); setPreset('custom') }} />
          </div>
        </div>
      </div>

      {/* P&L Statement */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{t('reports.pl.title')}</p>
          <p className="text-xs text-slate-400 mt-0.5">{fromDate} → {toDate}</p>
        </div>

        {/* Revenue */}
        <div className="border-b border-slate-100 dark:border-slate-800">
          <div className="px-4 py-2 bg-green-50/50 dark:bg-green-900/10">
            <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">{t('reports.pl.revenue')}</span>
          </div>
          <PLRow label={t('reports.pl.grossRevenue')} value={report.grossRevenue} indent />
          {report.totalReturns > 0 && <PLRow label={t('reports.pl.returns')} value={-report.totalReturns} indent color="red" />}
          <PLRow label={t('reports.pl.netRevenue')} value={report.netRevenue} bold color="green" borderTop />
        </div>

        {/* COGS */}
        <div className="border-b border-slate-100 dark:border-slate-800">
          <div className="px-4 py-2 bg-amber-50/50 dark:bg-amber-900/10">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">{t('reports.pl.cogs')}</span>
          </div>
          <PLRow label={t('reports.pl.purchases')} value={-report.cogs} indent color={report.cogs > 0 ? 'red' : undefined} />
          <PLRow
            label={`${t('reports.pl.grossProfit')} (${pct(report.grossMarginPct)})`}
            value={report.grossProfit}
            bold
            color={report.grossProfit >= 0 ? 'green' : 'red'}
            borderTop
          />
        </div>

        {/* Expenses */}
        <div className="border-b border-slate-100 dark:border-slate-800">
          <div className="px-4 py-2 bg-red-50/50 dark:bg-red-900/10">
            <span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">{t('reports.pl.expenses')}</span>
          </div>
          {EXPENSE_CATEGORIES.filter(cat => (report.expensesByCategory[cat] ?? 0) > 0).map(cat => (
            <PLRow
              key={cat}
              label={t(`expenses.categories.${cat}`)}
              value={-report.expensesByCategory[cat]}
              indent
              color="red"
            />
          ))}
          {Object.entries(report.expensesByCategory)
            .filter(([cat]) => !EXPENSE_CATEGORIES.includes(cat as typeof EXPENSE_CATEGORIES[number]))
            .map(([cat, amt]) => (
              <PLRow key={cat} label={cat} value={-(amt as number)} indent color="red" />
            ))}
          <PLRow label={t('reports.pl.totalExpenses')} value={-report.totalExpenses} bold color="red" borderTop />
        </div>

        {/* Net Profit */}
        <div>
          <PLRow
            label={`${t('reports.pl.netProfit')} (${pct(report.netMarginPct)})`}
            value={report.netProfit}
            bold
            color={report.netProfit >= 0 ? 'green' : 'red'}
          />
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: t('reports.pl.invoices'), value: String(report.invoiceCount) },
          { label: t('reports.pl.returnsCount'), value: String(report.returnCount) },
          { label: t('reports.pl.expensesCount'), value: String(report.expenseCount) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sales Tab ─────────────────────────────────────────────────────────────────

function SalesTab() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  const rows = useLiveQuery(
    () => getMonthlySalesSummary(year, db),
    [year],
  )

  const months = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec',
  ]

  const safeRows: SalesSummaryRow[] = rows ?? []
  const zeroTotals = { invoiceCount: 0, grossRevenue: 0, returnedAmount: 0, netRevenue: 0, collected: 0, outstanding: 0 }
  const totals = safeRows.reduce(
    (acc: typeof zeroTotals, r: SalesSummaryRow) => ({
      invoiceCount: acc.invoiceCount + r.invoiceCount,
      grossRevenue: acc.grossRevenue + r.grossRevenue,
      returnedAmount: acc.returnedAmount + r.returnedAmount,
      netRevenue: acc.netRevenue + r.netRevenue,
      collected: acc.collected + r.collected,
      outstanding: acc.outstanding + r.outstanding,
    }),
    zeroTotals,
  )

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <div className="flex items-center gap-2">
        <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">◀</button>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 w-12 text-center">{year}</span>
        <button onClick={() => setYear(y => y + 1)} disabled={year >= currentYear} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30">▶</button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-400">
              <tr>
                <th className="py-3 px-4 text-start font-medium">{t('reports.sales.month')}</th>
                <th className="py-3 px-4 text-end font-medium">{t('reports.sales.invoices')}</th>
                <th className="py-3 px-4 text-end font-medium">{t('reports.sales.grossRevenue')}</th>
                <th className="py-3 px-4 text-end font-medium">{t('reports.sales.returns')}</th>
                <th className="py-3 px-4 text-end font-medium">{t('reports.sales.netRevenue')}</th>
                <th className="py-3 px-4 text-end font-medium">{t('reports.sales.collected')}</th>
                <th className="py-3 px-4 text-end font-medium">{t('reports.sales.outstanding')}</th>
              </tr>
            </thead>
            <tbody>
              {safeRows.map((row: SalesSummaryRow, i: number) => (
                <tr key={row.period} className={`border-b border-slate-50 dark:border-slate-800/50 ${row.invoiceCount === 0 ? 'opacity-40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
                  <td className="py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300">{months[i]}</td>
                  <td className="py-2.5 px-4 text-end text-slate-500">{row.invoiceCount || '—'}</td>
                  <td className="py-2.5 px-4 text-end text-slate-600 dark:text-slate-300">{row.grossRevenue > 0 ? fmt(row.grossRevenue) : '—'}</td>
                  <td className="py-2.5 px-4 text-end text-red-500">{row.returnedAmount > 0 ? `(${fmt(row.returnedAmount)})` : '—'}</td>
                  <td className="py-2.5 px-4 text-end font-semibold text-green-600 dark:text-green-400">{row.netRevenue > 0 ? fmt(row.netRevenue) : '—'}</td>
                  <td className="py-2.5 px-4 text-end text-slate-500">{row.collected > 0 ? fmt(row.collected) : '—'}</td>
                  <td className="py-2.5 px-4 text-end text-amber-600 dark:text-amber-400">{row.outstanding > 0 ? fmt(row.outstanding) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-semibold">
              <tr>
                <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-200">{t('common.total')}</td>
                <td className="py-3 px-4 text-end text-sm text-slate-600 dark:text-slate-300">{totals.invoiceCount}</td>
                <td className="py-3 px-4 text-end text-sm text-slate-600 dark:text-slate-300">{fmt(totals.grossRevenue)}</td>
                <td className="py-3 px-4 text-end text-sm text-red-500">{totals.returnedAmount > 0 ? `(${fmt(totals.returnedAmount)})` : '—'}</td>
                <td className="py-3 px-4 text-end text-sm text-green-600 dark:text-green-400">{fmt(totals.netRevenue)}</td>
                <td className="py-3 px-4 text-end text-sm text-slate-600 dark:text-slate-300">{fmt(totals.collected)}</td>
                <td className="py-3 px-4 text-end text-sm text-amber-600 dark:text-amber-400">{fmt(totals.outstanding)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Inventory Tab ─────────────────────────────────────────────────────────────

function InventoryTab() {
  const { t } = useTranslation()
  const [typeFilter, setTypeFilter] = useState<'all' | 'frame' | 'lens'>('all')

  const data = useLiveQuery(
    () => getInventoryValuation(db),
    [],
  )

  if (!data) return <PageSpinner />

  const rows = typeFilter === 'all' ? data.rows : data.rows.filter((r: InventoryValuationSummary['rows'][number]) => r.productType === typeFilter)

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('reports.inventory.costValue'), value: fmt(data.totalCostValue), color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
          { label: t('reports.inventory.sellingValue'), value: fmt(data.totalSellingValue), color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' },
          { label: t('reports.inventory.potentialProfit'), value: fmt(data.potentialProfit), color: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300' },
          { label: t('reports.inventory.totalUnits'), value: String(data.totalUnits), color: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-2xl p-4 ${color}`}>
            <p className="text-xs font-medium opacity-80 mb-1">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1">
        {(['all', 'frame', 'lens'] as const).map(type => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${typeFilter === type ? 'bg-blue-700 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            {t(`reports.inventory.filter.${type}`)}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {rows.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">{t('reports.inventory.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-400">
                <tr>
                  <th className="py-3 px-4 text-start font-medium">{t('reports.inventory.product')}</th>
                  <th className="py-3 px-4 text-start font-medium">SKU</th>
                  <th className="py-3 px-4 text-end font-medium">{t('reports.inventory.qty')}</th>
                  <th className="py-3 px-4 text-end font-medium">{t('reports.inventory.costPrice')}</th>
                  <th className="py-3 px-4 text-end font-medium">{t('reports.inventory.sellingPrice')}</th>
                  <th className="py-3 px-4 text-end font-medium">{t('reports.inventory.costValue')}</th>
                  <th className="py-3 px-4 text-end font-medium">{t('reports.inventory.sellingValue')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: InventoryValuationSummary['rows'][number]) => (
                  <tr key={row.productId} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{row.name}</span>
                      <span className="ms-2 text-xs text-slate-400">{row.productType === 'frame' ? '🕶' : '🔬'}</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-400">{row.sku}</td>
                    <td className="py-2.5 px-4 text-end text-slate-600 dark:text-slate-300">{row.quantity}</td>
                    <td className="py-2.5 px-4 text-end text-slate-500">{row.costPrice > 0 ? fmt(row.costPrice) : '—'}</td>
                    <td className="py-2.5 px-4 text-end text-slate-500">{row.sellingPrice > 0 ? fmt(row.sellingPrice) : '—'}</td>
                    <td className="py-2.5 px-4 text-end font-semibold text-blue-600 dark:text-blue-400">{fmt(row.totalCostValue)}</td>
                    <td className="py-2.5 px-4 text-end font-semibold text-green-600 dark:text-green-400">{fmt(row.totalSellingValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-semibold">
                <tr>
                  <td colSpan={5} className="py-3 px-4 text-sm text-slate-700 dark:text-slate-200">{t('common.total')} ({rows.length})</td>
                  <td className="py-3 px-4 text-end text-sm text-blue-600 dark:text-blue-400">{fmt(rows.reduce((s: number, r: InventoryValuationSummary['rows'][number]) => s + r.totalCostValue, 0))}</td>
                  <td className="py-3 px-4 text-end text-sm text-green-600 dark:text-green-400">{fmt(rows.reduce((s: number, r: InventoryValuationSummary['rows'][number]) => s + r.totalSellingValue, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ReportsPage ──────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('pl')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pl',        label: t('reports.tabs.pl') },
    { key: 'sales',     label: t('reports.tabs.sales') },
    { key: 'inventory', label: t('reports.tabs.inventory') },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('reports.title')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t('reports.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === key
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'pl'        && <PLTab />}
      {tab === 'sales'     && <SalesTab />}
      {tab === 'inventory' && <InventoryTab />}
    </div>
  )
}
