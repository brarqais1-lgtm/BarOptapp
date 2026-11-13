import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'
import {
  searchExpenses, getExpenseStats, deleteExpense,
  EXPENSE_CATEGORIES, type ExpenseFilters,
} from './ExpenseRepository'
import type { Expense } from '../../database/schema'

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Category badge ────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  rent:        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  salary:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  utilities:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  maintenance: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  supplies:    'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  marketing:   'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  transport:   'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  other:       'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

function CategoryBadge({ category }: { category: string }) {
  const { t } = useTranslation()
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other}`}>
      {t(`expenses.categories.${category}`, { defaultValue: category })}
    </span>
  )
}

// ── Stats tiles ───────────────────────────────────────────────────────────────

function StatsTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-2xl p-4 ${color}`}>
      <p className="text-xs font-medium opacity-80 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

// ── Expense Row ───────────────────────────────────────────────────────────────

function ExpenseRow({ expense, onDelete }: { expense: Expense; onDelete: (e: Expense) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
      <td className="py-3 px-4 text-sm font-mono text-slate-400">{expense.expenseNumber}</td>
      <td className="py-3 px-4 text-sm text-slate-500">{expense.paidAt}</td>
      <td className="py-3 px-4">
        <CategoryBadge category={expense.category} />
      </td>
      <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">{expense.description}</td>
      <td className="py-3 px-4 text-sm font-semibold text-red-600 dark:text-red-400 text-end">
        {fmt(expense.amount)}
      </td>
      <td className="py-3 px-4 text-sm text-slate-400">
        {expense.paymentMethod ? t(`sales.payment.methods.${expense.paymentMethod}`) : '—'}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
          <button
            onClick={() => navigate(`/expenses/${expense.id}/edit`)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('common.edit')}
          </button>
          <button
            onClick={() => onDelete(expense)}
            className="text-xs text-red-500 hover:underline"
          >
            {t('common.delete')}
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [filters, setFilters] = useState<ExpenseFilters>({})
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)

  const thisMonth = new Date().toISOString().slice(0, 7)
  const [fromDate, setFromDate] = useState(thisMonth + '-01')
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [categoryFilter, setCategoryFilter] = useState('')

  function applyFilters() {
    setFilters({
      category: categoryFilter || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    })
  }

  function clearFilters() {
    setFromDate(thisMonth + '-01')
    setToDate(new Date().toISOString().slice(0, 10))
    setCategoryFilter('')
    setFilters({})
  }

  const expenses = useLiveQuery(() => searchExpenses(filters, db), [filters], [])
  const stats = useLiveQuery(() => getExpenseStats(db), [], null)

  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    await deleteExpense(confirmDelete.id, db)
    setDeleting(false)
    setConfirmDelete(null)
  }

  const total = (expenses ?? []).reduce((s, e) => s + e.amount, 0)

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('expenses.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('expenses.subtitle')}</p>
        </div>
        <button
          onClick={() => navigate('/expenses/new')}
          className="px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 transition-colors"
        >
          + {t('expenses.new')}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatsTile
            label={t('expenses.stats.thisMonth')}
            value={fmt(stats.totalThisMonth)}
            color="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
          />
          <StatsTile
            label={t('expenses.stats.thisYear')}
            value={fmt(stats.totalThisYear)}
            color="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
          />
          <StatsTile
            label={t('expenses.stats.allTime')}
            value={fmt(stats.totalAllTime)}
            color="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          />
        </div>
      )}

      {/* Category breakdown */}
      {stats && Object.keys(stats.byCategory).length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">{t('expenses.byCategory')}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amt]) => (
                <div key={cat} className="flex items-center gap-2">
                  <CategoryBadge category={cat} />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmt(amt)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('expenses.fromDate')}</label>
            <input type="date" className="form-input text-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('expenses.toDate')}</label>
            <input type="date" className="form-input text-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('expenses.category')}</label>
            <select className="form-input text-sm" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">{t('common.select')}</option>
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{t(`expenses.categories.${cat}`)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={applyFilters}
            className="px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 transition-colors"
          >
            {t('common.search')}
          </button>
          <button
            onClick={clearFilters}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {expenses && expenses.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-3 opacity-30">📉</div>
            <p className="text-sm font-medium">{t('expenses.empty')}</p>
            <p className="text-xs mt-1">{t('expenses.emptyHint')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-start">
                <thead className="border-b border-slate-100 dark:border-slate-800">
                  <tr className="text-xs text-slate-400">
                    <th className="py-3 px-4 text-start font-medium">#</th>
                    <th className="py-3 px-4 text-start font-medium">{t('expenses.date')}</th>
                    <th className="py-3 px-4 text-start font-medium">{t('expenses.category')}</th>
                    <th className="py-3 px-4 text-start font-medium">{t('expenses.description')}</th>
                    <th className="py-3 px-4 text-end font-medium">{t('expenses.amount')}</th>
                    <th className="py-3 px-4 text-start font-medium">{t('expenses.paymentMethod')}</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {(expenses ?? []).map(e => (
                    <ExpenseRow key={e.id} expense={e} onDelete={setConfirmDelete} />
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <td colSpan={4} className="py-3 px-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {t('common.total')} ({(expenses ?? []).length})
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-red-600 dark:text-red-400 text-end">
                      {fmt(total)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{t('expenses.deleteConfirm')}</h3>
            <p className="text-sm text-slate-500 mb-4">
              {confirmDelete.description} — <span className="font-semibold text-red-600">{fmt(confirmDelete.amount)}</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {t('common.delete')}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
