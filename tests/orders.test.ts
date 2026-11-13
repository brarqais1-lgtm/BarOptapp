/**
 * Phase 09 Tests — Glasses Order Management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import { BarOptDB } from '../src/database/db'
import { createFrame } from '../src/modules/catalog/FrameRepository'
import {
  createSale, confirmSale, cancelSale,
  markSaleReady, markSaleDelivered, getPendingOrders,
} from '../src/modules/sales/SalesRepository'
import type { SaleFormValues, SaleItemFormValues } from '../src/modules/sales/sales.schema'

function createTestDB() { return new BarOptDB() }
let db: BarOptDB

beforeEach(async () => { db = createTestDB(); await db.open() })
afterEach(async () => { await db.close(); db.delete() })

function today() { return new Date().toISOString().slice(0, 10) }

async function mkFrame(qty = 5, price = 100) {
  const frame = await createFrame({
    sku: `F-${uuidv4().slice(0, 8)}`,
    brand: 'TestBrand',
    model: 'M',
    gender: 'unisex',
    sellingPrice: price,
    quantity: qty,
  }, db)
  await db.frames.update(frame.id, { quantity: qty })
  return frame
}

function header(overrides: Partial<SaleFormValues> = {}): SaleFormValues {
  return {
    saleDate: today(),
    discountAmount: 0,
    discountPercent: 0,
    ...overrides,
  }
}

function item(overrides: Partial<SaleItemFormValues> = {}): SaleItemFormValues {
  return {
    itemType: 'service',
    description: 'Eye Test',
    quantity: 1,
    unitPrice: 50,
    discountAmount: 0,
    ...overrides,
  }
}

// ── 1. createSale persists readyDate and labNotes ─────────────────────────────

describe('createSale (Phase 09 fields)', () => {
  it('saves readyDate and labNotes on the sale', async () => {
    const sale = await createSale(
      header({ readyDate: '2026-11-20', labNotes: 'Blue-cut coating required' }),
      [item()],
      db,
    )
    expect(sale.readyDate).toBe('2026-11-20')
    expect(sale.labNotes).toBe('Blue-cut coating required')
  })

  it('creates sale with undefined readyDate when not provided', async () => {
    const sale = await createSale(header(), [item()], db)
    expect(sale.readyDate).toBeUndefined()
    expect(sale.labNotes).toBeUndefined()
  })
})

// ── 2. markSaleReady ──────────────────────────────────────────────────────────

describe('markSaleReady', () => {
  it('transitions confirmed sale to ready', async () => {
    const sale = await createSale(header(), [item()], db)
    await confirmSale(sale.id, db)
    await markSaleReady(sale.id, '2026-11-25', db)
    const updated = await db.sales.get(sale.id)
    expect(updated!.status).toBe('ready')
    expect(updated!.readyDate).toBe('2026-11-25')
  })

  it('uses existing readyDate if not provided', async () => {
    const sale = await createSale(header({ readyDate: '2026-11-18' }), [item()], db)
    await confirmSale(sale.id, db)
    await markSaleReady(sale.id, undefined, db)
    const updated = await db.sales.get(sale.id)
    expect(updated!.status).toBe('ready')
    expect(updated!.readyDate).toBe('2026-11-18')
  })

  it('throws if sale is not confirmed', async () => {
    const sale = await createSale(header(), [item()], db)
    await expect(markSaleReady(sale.id, undefined, db)).rejects.toThrow('Only confirmed')
  })

  it('throws if sale does not exist', async () => {
    await expect(markSaleReady('nonexistent', undefined, db)).rejects.toThrow('Sale not found')
  })
})

// ── 3. markSaleDelivered ──────────────────────────────────────────────────────

describe('markSaleDelivered', () => {
  it('transitions ready sale to delivered', async () => {
    const sale = await createSale(header(), [item()], db)
    await confirmSale(sale.id, db)
    await markSaleReady(sale.id, undefined, db)
    await markSaleDelivered(sale.id, db)
    const updated = await db.sales.get(sale.id)
    expect(updated!.status).toBe('delivered')
    expect(updated!.deliveryDate).toBe(today())
  })

  it('throws if sale is not ready', async () => {
    const sale = await createSale(header(), [item()], db)
    await confirmSale(sale.id, db)
    await expect(markSaleDelivered(sale.id, db)).rejects.toThrow('Only ready')
  })

  it('throws for a draft sale', async () => {
    const sale = await createSale(header(), [item()], db)
    await expect(markSaleDelivered(sale.id, db)).rejects.toThrow('Only ready')
  })
})

// ── 4. getPendingOrders ───────────────────────────────────────────────────────

describe('getPendingOrders', () => {
  it('returns empty list when no pending orders', async () => {
    const orders = await getPendingOrders(db)
    expect(orders).toHaveLength(0)
  })

  it('returns confirmed sales', async () => {
    const frame = await mkFrame()
    const sale = await createSale(
      header(),
      [item({ itemType: 'frame', itemId: frame.id, description: 'Frame', quantity: 1, unitPrice: 100 })],
      db,
    )
    await confirmSale(sale.id, db)
    const orders = await getPendingOrders(db)
    expect(orders).toHaveLength(1)
    expect(orders[0].saleNumber).toBe(sale.saleNumber)
  })

  it('returns ready sales', async () => {
    const sale = await createSale(header(), [item()], db)
    await confirmSale(sale.id, db)
    await markSaleReady(sale.id, undefined, db)
    const orders = await getPendingOrders(db)
    expect(orders).toHaveLength(1)
    expect(orders[0].status).toBe('ready')
  })

  it('excludes delivered and cancelled sales', async () => {
    const s1 = await createSale(header(), [item()], db)
    await confirmSale(s1.id, db)
    await markSaleReady(s1.id, undefined, db)
    await markSaleDelivered(s1.id, db)

    const s2 = await createSale(header(), [item()], db)
    await cancelSale(s2.id, db)

    const orders = await getPendingOrders(db)
    expect(orders).toHaveLength(0)
  })

  it('excludes draft sales', async () => {
    await createSale(header(), [item()], db)
    const orders = await getPendingOrders(db)
    expect(orders).toHaveLength(0)
  })

  it('sorts by readyDate ascending (soonest first)', async () => {
    const s1 = await createSale(header({ readyDate: '2026-11-20' }), [item()], db)
    await confirmSale(s1.id, db)
    const s2 = await createSale(header({ readyDate: '2026-11-15' }), [item()], db)
    await confirmSale(s2.id, db)
    const s3 = await createSale(header({ readyDate: '2026-11-25' }), [item()], db)
    await confirmSale(s3.id, db)

    const orders = await getPendingOrders(db)
    expect(orders.map(o => o.readyDate)).toEqual(['2026-11-15', '2026-11-20', '2026-11-25'])
  })

  it('places orders without readyDate after those with dates', async () => {
    const s1 = await createSale(header({ readyDate: '2026-11-15' }), [item()], db)
    await confirmSale(s1.id, db)
    const s2 = await createSale(header(), [item()], db) // no readyDate
    await confirmSale(s2.id, db)

    const orders = await getPendingOrders(db)
    expect(orders[0].saleNumber).toBe(s1.saleNumber) // dated first
    expect(orders[1].saleNumber).toBe(s2.saleNumber) // undated last
  })
})

// ── 5. Full order lifecycle ───────────────────────────────────────────────────

describe('Full order lifecycle', () => {
  it('draft → confirmed → ready → delivered', async () => {
    const sale = await createSale(header({ readyDate: '2026-11-20' }), [item()], db)
    expect(sale.status).toBe('draft')

    await confirmSale(sale.id, db)
    let s = await db.sales.get(sale.id)
    expect(s!.status).toBe('confirmed')

    await markSaleReady(sale.id, '2026-11-18', db)
    s = await db.sales.get(sale.id)
    expect(s!.status).toBe('ready')
    expect(s!.readyDate).toBe('2026-11-18')

    await markSaleDelivered(sale.id, db)
    s = await db.sales.get(sale.id)
    expect(s!.status).toBe('delivered')
    expect(s!.deliveryDate).toBe(today())

    // No longer in pending orders
    const pending = await getPendingOrders(db)
    expect(pending).toHaveLength(0)
  })
})
