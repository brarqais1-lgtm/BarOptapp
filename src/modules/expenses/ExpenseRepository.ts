import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { Expense, PaymentMethod } from '../../database/schema'

// ── Predefined categories ─────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  'rent',
  'salary',
  'utilities',
  'maintenance',
  'supplies',
  'marketing',
  'transport',
  'other',
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

// ── Sequence ──────────────────────────────────────────────────────────────────

async function getNextExpenseNumber(db: BarOptDB): Promise<string> {
  return db.transaction('rw', [db.settings], async () => {
    const key = 'expense_sequence'
    const setting = await db.settings.where('key').equals(key).first()
    const seq = (setting ? JSON.parse(setting.value) as number : 0) + 1
    const now = new Date().toISOString()
    if (setting) {
      await db.settings.update(setting.id, { value: JSON.stringify(seq), updatedAt: now })
    } else {
      await db.settings.add({
        id: uuidv4(), key, value: JSON.stringify(seq),
        group: 'sequences', createdAt: now, updatedAt: now,
      })
    }
    return `EX-${String(seq).padStart(6, '0')}`
  })
}

// ── Zod-free form values ──────────────────────────────────────────────────────

export interface ExpenseFormValues {
  category: string
  description: string
  amount: number
  paidAt: string
  paymentMethod?: PaymentMethod
  receiptNumber?: string
  notes?: string
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createExpense(
  values: ExpenseFormValues,
  db: BarOptDB = globalDb,
): Promise<Expense> {
  const expenseNumber = await getNextExpenseNumber(db)
  const now = new Date().toISOString()
  const expense: Expense = {
    id: uuidv4(),
    expenseNumber,
    category: values.category,
    description: values.description,
    amount: Math.round(values.amount * 100) / 100,
    paidAt: values.paidAt,
    paymentMethod: values.paymentMethod,
    receiptNumber: values.receiptNumber,
    notes: values.notes,
    createdAt: now,
    updatedAt: now,
  }
  await db.expenses.add(expense)
  return expense
}

export async function updateExpense(
  id: string,
  values: ExpenseFormValues,
  db: BarOptDB = globalDb,
): Promise<void> {
  const now = new Date().toISOString()
  await db.expenses.update(id, {
    category: values.category,
    description: values.description,
    amount: Math.round(values.amount * 100) / 100,
    paidAt: values.paidAt,
    paymentMethod: values.paymentMethod,
    receiptNumber: values.receiptNumber,
    notes: values.notes,
    updatedAt: now,
  })
}

export async function deleteExpense(id: string, db: BarOptDB = globalDb): Promise<void> {
  await db.expenses.update(id, { deletedAt: new Date().toISOString() })
}

export async function getExpenseById(id: string, db: BarOptDB = globalDb): Promise<Expense | undefined> {
  return db.expenses.get(id)
}

// ── Filters & search ──────────────────────────────────────────────────────────

export interface ExpenseFilters {
  category?: string
  fromDate?: string
  toDate?: string
}

export async function searchExpenses(
  filters: ExpenseFilters = {},
  db: BarOptDB = globalDb,
): Promise<Expense[]> {
  let all = await db.expenses.filter(e => !e.deletedAt).toArray()

  if (filters.category) all = all.filter(e => e.category === filters.category)
  if (filters.fromDate) all = all.filter(e => e.paidAt >= filters.fromDate!)
  if (filters.toDate)   all = all.filter(e => e.paidAt <= filters.toDate!)

  return all.sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.createdAt.localeCompare(a.createdAt))
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface ExpenseStats {
  totalThisMonth: number
  totalThisYear: number
  totalAllTime: number
  byCategory: Record<string, number>
  recentCount: number
}

export async function getExpenseStats(db: BarOptDB = globalDb): Promise<ExpenseStats> {
  const all = await db.expenses.filter(e => !e.deletedAt).toArray()
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'
  const yearStart = today.slice(0, 4) + '-01-01'

  const r2 = (n: number) => Math.round(n * 100) / 100

  const thisMonth = all.filter(e => e.paidAt >= monthStart && e.paidAt <= today)
  const thisYear  = all.filter(e => e.paidAt >= yearStart  && e.paidAt <= today)

  const byCategory: Record<string, number> = {}
  for (const e of all) {
    byCategory[e.category] = r2((byCategory[e.category] ?? 0) + e.amount)
  }

  return {
    totalThisMonth: r2(thisMonth.reduce((s, e) => s + e.amount, 0)),
    totalThisYear:  r2(thisYear.reduce((s, e) => s + e.amount, 0)),
    totalAllTime:   r2(all.reduce((s, e) => s + e.amount, 0)),
    byCategory,
    recentCount: all.length,
  }
}
