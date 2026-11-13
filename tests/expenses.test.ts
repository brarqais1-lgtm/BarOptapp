/**
 * Phase 12 Tests — Expenses Repository
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BarOptDB } from '../src/database/db'
import {
  createExpense, updateExpense, deleteExpense,
  searchExpenses, getExpenseStats,
  type ExpenseFormValues,
} from '../src/modules/expenses/ExpenseRepository'

function createTestDB() { return new BarOptDB() }
let db: BarOptDB

beforeEach(async () => { db = createTestDB(); await db.open() })
afterEach(async () => { await db.close(); db.delete() })

function today() { return new Date().toISOString().slice(0, 10) }
function monthStart() { return today().slice(0, 7) + '-01' }

function expenseData(overrides: Partial<ExpenseFormValues> = {}): ExpenseFormValues {
  return {
    category: 'rent',
    description: 'Monthly rent',
    amount: 1500,
    paidAt: today(),
    ...overrides,
  }
}

// ── 1. createExpense ──────────────────────────────────────────────────────────

describe('createExpense', () => {
  it('creates an expense with auto expenseNumber EX-000001', async () => {
    const e = await createExpense(expenseData(), db)
    expect(e.expenseNumber).toBe('EX-000001')
    expect(e.category).toBe('rent')
    expect(e.amount).toBe(1500)
    expect(e.paidAt).toBe(today())
  })

  it('increments sequence: EX-000001, EX-000002', async () => {
    const e1 = await createExpense(expenseData(), db)
    const e2 = await createExpense(expenseData({ description: 'Electricity' }), db)
    expect(e1.expenseNumber).toBe('EX-000001')
    expect(e2.expenseNumber).toBe('EX-000002')
  })

  it('rounds amount to 2 decimal places', async () => {
    const e = await createExpense(expenseData({ amount: 100.555 }), db)
    expect(e.amount).toBe(100.56)
  })

  it('stores optional fields', async () => {
    const e = await createExpense(expenseData({
      paymentMethod: 'cash',
      receiptNumber: 'R-001',
      notes: 'Paid in cash',
    }), db)
    expect(e.paymentMethod).toBe('cash')
    expect(e.receiptNumber).toBe('R-001')
    expect(e.notes).toBe('Paid in cash')
  })
})

// ── 2. updateExpense ──────────────────────────────────────────────────────────

describe('updateExpense', () => {
  it('updates fields on an existing expense', async () => {
    const e = await createExpense(expenseData(), db)
    await updateExpense(e.id, expenseData({ description: 'Updated rent', amount: 2000 }), db)
    const updated = await db.expenses.get(e.id)
    expect(updated!.description).toBe('Updated rent')
    expect(updated!.amount).toBe(2000)
    expect(updated!.expenseNumber).toBe('EX-000001') // unchanged
  })
})

// ── 3. deleteExpense (soft delete) ────────────────────────────────────────────

describe('deleteExpense', () => {
  it('soft-deletes an expense', async () => {
    const e = await createExpense(expenseData(), db)
    await deleteExpense(e.id, db)
    const deleted = await db.expenses.get(e.id)
    expect(deleted!.deletedAt).toBeDefined()
  })

  it('soft-deleted expense is excluded from searchExpenses', async () => {
    const e = await createExpense(expenseData(), db)
    await deleteExpense(e.id, db)
    const results = await searchExpenses({}, db)
    expect(results).toHaveLength(0)
  })
})

// ── 4. searchExpenses ─────────────────────────────────────────────────────────

describe('searchExpenses', () => {
  it('returns all active expenses sorted by date desc', async () => {
    await createExpense(expenseData({ paidAt: '2026-11-01' }), db)
    await createExpense(expenseData({ paidAt: '2026-11-05' }), db)
    await createExpense(expenseData({ paidAt: '2026-11-03' }), db)
    const results = await searchExpenses({}, db)
    expect(results).toHaveLength(3)
    expect(results[0].paidAt).toBe('2026-11-05')
    expect(results[2].paidAt).toBe('2026-11-01')
  })

  it('filters by category', async () => {
    await createExpense(expenseData({ category: 'rent' }), db)
    await createExpense(expenseData({ category: 'salary' }), db)
    const results = await searchExpenses({ category: 'rent' }, db)
    expect(results).toHaveLength(1)
    expect(results[0].category).toBe('rent')
  })

  it('filters by date range', async () => {
    await createExpense(expenseData({ paidAt: '2026-10-15' }), db)
    await createExpense(expenseData({ paidAt: '2026-11-01' }), db)
    await createExpense(expenseData({ paidAt: '2026-11-30' }), db)
    const results = await searchExpenses({ fromDate: '2026-11-01', toDate: '2026-11-30' }, db)
    expect(results).toHaveLength(2)
  })
})

// ── 5. getExpenseStats ────────────────────────────────────────────────────────

describe('getExpenseStats', () => {
  it('returns zeros for empty database', async () => {
    const stats = await getExpenseStats(db)
    expect(stats.totalThisMonth).toBe(0)
    expect(stats.totalThisYear).toBe(0)
    expect(stats.totalAllTime).toBe(0)
    expect(stats.byCategory).toEqual({})
  })

  it('counts this month expenses', async () => {
    await createExpense(expenseData({ amount: 1000, paidAt: monthStart() }), db)
    await createExpense(expenseData({ amount: 500, paidAt: today() }), db)
    const stats = await getExpenseStats(db)
    expect(stats.totalThisMonth).toBe(1500)
    expect(stats.totalAllTime).toBe(1500)
  })

  it('breaks down by category', async () => {
    await createExpense(expenseData({ category: 'rent', amount: 1000 }), db)
    await createExpense(expenseData({ category: 'salary', amount: 3000 }), db)
    await createExpense(expenseData({ category: 'rent', amount: 500 }), db)
    const stats = await getExpenseStats(db)
    expect(stats.byCategory['rent']).toBe(1500)
    expect(stats.byCategory['salary']).toBe(3000)
  })

  it('excludes soft-deleted expenses from stats', async () => {
    const e = await createExpense(expenseData({ amount: 999 }), db)
    await deleteExpense(e.id, db)
    const stats = await getExpenseStats(db)
    expect(stats.totalAllTime).toBe(0)
  })
})

// ── 6. DB version ─────────────────────────────────────────────────────────────

describe('database version', () => {
  it('CURRENT_DB_VERSION is 10', async () => {
    const { CURRENT_DB_VERSION } = await import('../src/database/migrations/index')
    expect(CURRENT_DB_VERSION).toBe(10)
  })
})
