/**
 * Phase 11 Tests — Dashboard Repository
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import { BarOptDB } from '../src/database/db'
import { createPatient } from '../src/modules/patients/PatientRepository'
import { createFrame } from '../src/modules/catalog/FrameRepository'
import {
  createSale, confirmSale, markSaleReady,
} from '../src/modules/sales/SalesRepository'
import { getDashboardSummary, getLast7DaysRevenue } from '../src/modules/dashboard/DashboardRepository'
import type { SaleFormValues, SaleItemFormValues } from '../src/modules/sales/sales.schema'

function createTestDB() { return new BarOptDB() }
let db: BarOptDB

beforeEach(async () => { db = createTestDB(); await db.open() })
afterEach(async () => { await db.close(); db.delete() })

function today() { return new Date().toISOString().slice(0, 10) }

function header(overrides: Partial<SaleFormValues> = {}): SaleFormValues {
  return { saleDate: today(), discountAmount: 0, discountPercent: 0, ...overrides }
}

function item(overrides: Partial<SaleItemFormValues> = {}): SaleItemFormValues {
  return { itemType: 'service', description: 'Service', quantity: 1, unitPrice: 100, discountAmount: 0, ...overrides }
}

async function mkPatient() {
  return createPatient({
    fullName: `Patient ${uuidv4().slice(0, 6)}`,
    gender: 'male',
  }, db)
}

// ── 1. getDashboardSummary ────────────────────────────────────────────────────

describe('getDashboardSummary', () => {
  it('returns zero counts when database is empty', async () => {
    const summary = await getDashboardSummary(db)
    expect(summary.sales.todaySales).toBe(0)
    expect(summary.sales.todayRevenue).toBe(0)
    expect(summary.patientsToday).toBe(0)
    expect(summary.pendingOrdersCount).toBe(0)
    expect(summary.pendingOrders).toHaveLength(0)
    expect(summary.recentPatients).toHaveLength(0)
    expect(summary.lowStockCount).toBe(0)
    expect(summary.outOfStockCount).toBe(0)
  })

  it('counts today sales correctly', async () => {
    await createSale(header(), [item()], db)
    await createSale(header(), [item({ unitPrice: 200 })], db)
    const summary = await getDashboardSummary(db)
    expect(summary.sales.todaySales).toBe(2)
    expect(summary.sales.todayRevenue).toBe(300)
  })

  it('counts pending orders (confirmed + ready)', async () => {
    const s1 = await createSale(header(), [item()], db)
    await confirmSale(s1.id, db)

    const s2 = await createSale(header(), [item()], db)
    await confirmSale(s2.id, db)
    await markSaleReady(s2.id, undefined, db)

    // draft — excluded
    await createSale(header(), [item()], db)

    const summary = await getDashboardSummary(db)
    expect(summary.pendingOrdersCount).toBe(2)
  })

  it('counts today patients', async () => {
    await mkPatient()
    await mkPatient()
    const summary = await getDashboardSummary(db)
    expect(summary.patientsToday).toBe(2)
  })

  it('reports low stock products', async () => {
    // Create a frame with quantity below reorder point
    const frame = await createFrame({
      sku: `F-${uuidv4().slice(0, 8)}`,
      brand: 'B', model: 'M', gender: 'unisex',
      sellingPrice: 100, quantity: 2,
    }, db)
    await db.frames.update(frame.id, { quantity: 2, reorderPoint: 5 })
    const summary = await getDashboardSummary(db)
    expect(summary.lowStockCount).toBeGreaterThanOrEqual(1)
  })

  it('limits pending orders to 6 in summary', async () => {
    for (let i = 0; i < 8; i++) {
      const s = await createSale(header(), [item()], db)
      await confirmSale(s.id, db)
    }
    const summary = await getDashboardSummary(db)
    expect(summary.pendingOrders.length).toBeLessThanOrEqual(6)
    expect(summary.pendingOrdersCount).toBe(8)
  })
})

// ── 2. getLast7DaysRevenue ────────────────────────────────────────────────────

describe('getLast7DaysRevenue', () => {
  it('returns exactly 7 entries', async () => {
    const data = await getLast7DaysRevenue(db)
    expect(data).toHaveLength(7)
  })

  it('last entry is today', async () => {
    const data = await getLast7DaysRevenue(db)
    expect(data[6].date).toBe(today())
  })

  it('all revenues are 0 when no sales', async () => {
    const data = await getLast7DaysRevenue(db)
    expect(data.every(d => d.revenue === 0)).toBe(true)
  })

  it('counts today revenue in the last slot', async () => {
    await createSale(header({ saleDate: today() }), [item({ unitPrice: 150 })], db)
    const data = await getLast7DaysRevenue(db)
    expect(data[6].revenue).toBe(150)
  })

  it('dates are in ascending order', async () => {
    const data = await getLast7DaysRevenue(db)
    for (let i = 1; i < data.length; i++) {
      expect(data[i].date > data[i - 1].date).toBe(true)
    }
  })
})
