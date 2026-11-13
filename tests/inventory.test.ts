/**
 * Phase 06 Tests — Inventory & Stock Management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BarOptDB } from '../src/database/db'
import {
  getCurrentStock,
  getStockFromMovements,
  createMovement,
  getMovements,
  getStockList,
  getLowStockProducts,
  getInventoryStats,
  updateProductPricing,
  getNextSessionNumber,
  createStocktakingSession,
  getStocktakingSessions,
  getStocktakingSession,
  addStocktakingItem,
  updateStocktakingCount,
  getStocktakingItems,
  confirmStocktakingSession,
  updateSessionStatus,
} from '../src/modules/inventory/InventoryRepository'
import { createFrame } from '../src/modules/catalog/FrameRepository'
import { createLens } from '../src/modules/catalog/LensRepository'
import { v4 as uuidv4 } from 'uuid'

function createTestDB() { return new BarOptDB() }

let db: BarOptDB

beforeEach(async () => {
  db = createTestDB()
  await db.open()
})

afterEach(async () => {
  await db.close()
  db.delete()
})

// ── Helpers ──────────────────────────────────────────────────────────────────

async function mkFrame(overrides: Record<string, unknown> = {}) {
  return createFrame({
    sku: `FRM-${uuidv4().slice(0, 8)}`,
    brand: 'TestBrand',
    frameType: 'full',
    gender: 'unisex',
    ...overrides,
  }, db)
}

async function mkLens(overrides: Record<string, unknown> = {}) {
  return createLens({
    sku: `LNS-${uuidv4().slice(0, 8)}`,
    brand: 'LensBrand',
    lensType: 'single_vision',
    coatings: [],
    ...overrides,
  }, db)
}

const TODAY = new Date().toISOString().slice(0, 10)

// ── getCurrentStock ───────────────────────────────────────────────────────────

describe('getCurrentStock', () => {
  it('returns 0 for a new frame', async () => {
    const f = await mkFrame()
    const qty = await getCurrentStock('frame', f.id, db)
    expect(qty).toBe(0)
  })

  it('returns 0 for a new lens', async () => {
    const l = await mkLens()
    const qty = await getCurrentStock('lens', l.id, db)
    expect(qty).toBe(0)
  })
})

// ── createMovement ────────────────────────────────────────────────────────────

describe('createMovement — in-movements', () => {
  it('creates opening stock movement and updates quantity', async () => {
    const f = await mkFrame()
    const mv = await createMovement({
      productType: 'frame',
      productId: f.id,
      movementType: 'opening',
      quantity: 10,
      movementDate: TODAY,
    }, db)
    expect(mv.quantity).toBe(10)
    expect(mv.quantityBefore).toBe(0)
    expect(mv.quantityAfter).toBe(10)
    expect(await getCurrentStock('frame', f.id, db)).toBe(10)
  })

  it('creates stock_in and accumulates', async () => {
    const f = await mkFrame()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 5, movementDate: TODAY }, db)
    const mv = await createMovement({ productType: 'frame', productId: f.id, movementType: 'stock_in', quantity: 3, movementDate: TODAY }, db)
    expect(mv.quantityBefore).toBe(5)
    expect(mv.quantityAfter).toBe(8)
    expect(await getCurrentStock('frame', f.id, db)).toBe(8)
  })

  it('creates adjustment_in movement', async () => {
    const l = await mkLens()
    const mv = await createMovement({ productType: 'lens', productId: l.id, movementType: 'adjustment_in', quantity: 7, movementDate: TODAY }, db)
    expect(mv.quantity).toBe(7)
    expect(await getCurrentStock('lens', l.id, db)).toBe(7)
  })

  it('creates returned movement', async () => {
    const f = await mkFrame()
    const mv = await createMovement({ productType: 'frame', productId: f.id, movementType: 'returned', quantity: 2, movementDate: TODAY }, db)
    expect(mv.quantity).toBe(2)
  })
})

describe('createMovement — out-movements', () => {
  it('creates stock_out and decrements', async () => {
    const f = await mkFrame()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 10, movementDate: TODAY }, db)
    const mv = await createMovement({ productType: 'frame', productId: f.id, movementType: 'stock_out', quantity: 3, movementDate: TODAY }, db)
    expect(mv.quantity).toBe(-3)
    expect(mv.quantityBefore).toBe(10)
    expect(mv.quantityAfter).toBe(7)
    expect(await getCurrentStock('frame', f.id, db)).toBe(7)
  })

  it('creates damaged movement', async () => {
    const f = await mkFrame()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 5, movementDate: TODAY }, db)
    const mv = await createMovement({ productType: 'frame', productId: f.id, movementType: 'damaged', quantity: 1, movementDate: TODAY }, db)
    expect(mv.quantity).toBe(-1)
    expect(await getCurrentStock('frame', f.id, db)).toBe(4)
  })

  it('creates adjustment_out movement', async () => {
    const l = await mkLens()
    await createMovement({ productType: 'lens', productId: l.id, movementType: 'opening', quantity: 20, movementDate: TODAY }, db)
    const mv = await createMovement({ productType: 'lens', productId: l.id, movementType: 'adjustment_out', quantity: 5, movementDate: TODAY }, db)
    expect(mv.quantity).toBe(-5)
    expect(await getCurrentStock('lens', l.id, db)).toBe(15)
  })
})

describe('createMovement — guards', () => {
  it('throws when product not found', async () => {
    await expect(createMovement({
      productType: 'frame', productId: 'nonexistent-id',
      movementType: 'stock_in', quantity: 5, movementDate: TODAY,
    }, db)).rejects.toThrow('Product not found')
  })

  it('throws when stock would go negative', async () => {
    const f = await mkFrame()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 2, movementDate: TODAY }, db)
    await expect(createMovement({
      productType: 'frame', productId: f.id, movementType: 'stock_out', quantity: 5, movementDate: TODAY,
    }, db)).rejects.toThrow('Insufficient stock')
  })

  it('throws for archived product', async () => {
    const f = await mkFrame()
    await db.frames.update(f.id, { deletedAt: new Date().toISOString() })
    await expect(createMovement({
      productType: 'frame', productId: f.id, movementType: 'stock_in', quantity: 5, movementDate: TODAY,
    }, db)).rejects.toThrow('archived')
  })
})

// ── getStockFromMovements ─────────────────────────────────────────────────────

describe('getStockFromMovements', () => {
  it('returns sum of signed quantities', async () => {
    const f = await mkFrame()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 10, movementDate: TODAY }, db)
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'stock_in', quantity: 5, movementDate: TODAY }, db)
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'stock_out', quantity: 3, movementDate: TODAY }, db)
    const qty = await getStockFromMovements('frame', f.id, db)
    expect(qty).toBe(12)
  })

  it('matches getCurrentStock (denormalized cache matches ledger)', async () => {
    const f = await mkFrame()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 20, movementDate: TODAY }, db)
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'damaged', quantity: 2, movementDate: TODAY }, db)
    const fromMoves = await getStockFromMovements('frame', f.id, db)
    const fromCache = await getCurrentStock('frame', f.id, db)
    expect(fromMoves).toBe(fromCache)
  })
})

// ── getMovements ──────────────────────────────────────────────────────────────

describe('getMovements', () => {
  it('returns all movements', async () => {
    const f = await mkFrame()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 5, movementDate: TODAY }, db)
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'stock_in', quantity: 3, movementDate: TODAY }, db)
    const all = await getMovements({}, db)
    expect(all.length).toBe(2)
  })

  it('filters by productType and productId', async () => {
    const f = await mkFrame()
    const l = await mkLens()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 5, movementDate: TODAY }, db)
    await createMovement({ productType: 'lens', productId: l.id, movementType: 'opening', quantity: 8, movementDate: TODAY }, db)
    const frameMoves = await getMovements({ productType: 'frame', productId: f.id }, db)
    expect(frameMoves.length).toBe(1)
    expect(frameMoves[0].itemType).toBe('frame')
  })

  it('filters by movementType', async () => {
    const f = await mkFrame()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 10, movementDate: TODAY }, db)
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'stock_out', quantity: 2, movementDate: TODAY }, db)
    const outs = await getMovements({ movementType: 'stock_out' }, db)
    expect(outs.length).toBe(1)
    expect(outs[0].movementType).toBe('stock_out')
  })

  it('respects limit', async () => {
    const f = await mkFrame()
    for (let i = 0; i < 5; i++) {
      await createMovement({ productType: 'frame', productId: f.id, movementType: 'stock_in', quantity: 1, movementDate: TODAY }, db)
    }
    const limited = await getMovements({ limit: 3 }, db)
    expect(limited.length).toBe(3)
  })
})

// ── getStockList ──────────────────────────────────────────────────────────────

describe('getStockList', () => {
  it('returns active products with stock status', async () => {
    const f = await mkFrame({ sku: 'SKU-A' })
    await updateProductPricing('frame', f.id, { reorderPoint: 5 }, db)
    const list = await getStockList({}, db)
    const item = list.find(p => p.id === f.id)
    expect(item).toBeDefined()
    expect(item!.status).toBe('out_of_stock')
  })

  it('marks product as low_stock when qty <= reorderPoint', async () => {
    const f = await mkFrame()
    await updateProductPricing('frame', f.id, { reorderPoint: 10 }, db)
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 5, movementDate: TODAY }, db)
    const list = await getStockList({ productType: 'frame' }, db)
    const item = list.find(p => p.id === f.id)!
    expect(item.status).toBe('low_stock')
  })

  it('marks product as in_stock when qty > reorderPoint', async () => {
    const f = await mkFrame()
    await updateProductPricing('frame', f.id, { reorderPoint: 3 }, db)
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 10, movementDate: TODAY }, db)
    const list = await getStockList({ productType: 'frame' }, db)
    const item = list.find(p => p.id === f.id)!
    expect(item.status).toBe('in_stock')
  })

  it('filters by productType', async () => {
    await mkFrame()
    await mkLens()
    const frames = await getStockList({ productType: 'frame' }, db)
    expect(frames.every(p => p.productType === 'frame')).toBe(true)
  })

  it('excludes archived products', async () => {
    const f = await mkFrame()
    await db.frames.update(f.id, { deletedAt: new Date().toISOString() })
    const list = await getStockList({}, db)
    expect(list.find(p => p.id === f.id)).toBeUndefined()
  })
})

// ── getLowStockProducts ───────────────────────────────────────────────────────

describe('getLowStockProducts', () => {
  it('returns only low_stock and out_of_stock products', async () => {
    const f1 = await mkFrame()  // out of stock
    const f2 = await mkFrame()
    await updateProductPricing('frame', f2.id, { reorderPoint: 5 }, db)
    await createMovement({ productType: 'frame', productId: f2.id, movementType: 'opening', quantity: 3, movementDate: TODAY }, db) // low stock
    const f3 = await mkFrame()
    await updateProductPricing('frame', f3.id, { reorderPoint: 5 }, db)
    await createMovement({ productType: 'frame', productId: f3.id, movementType: 'opening', quantity: 20, movementDate: TODAY }, db) // in stock

    const low = await getLowStockProducts(db)
    expect(low.find(p => p.id === f1.id)).toBeDefined()
    expect(low.find(p => p.id === f2.id)).toBeDefined()
    expect(low.find(p => p.id === f3.id)).toBeUndefined()
  })
})

// ── getInventoryStats ─────────────────────────────────────────────────────────

describe('getInventoryStats', () => {
  it('returns correct product counts', async () => {
    await mkFrame()
    await mkFrame()
    await mkLens()
    const stats = await getInventoryStats(db)
    expect(stats.totalFrameProducts).toBeGreaterThanOrEqual(2)
    expect(stats.totalLensProducts).toBeGreaterThanOrEqual(1)
  })

  it('counts out of stock correctly', async () => {
    await mkFrame() // out of stock (qty = 0)
    const stats = await getInventoryStats(db)
    expect(stats.outOfStockCount).toBeGreaterThanOrEqual(1)
  })

  it('includes recentMovements', async () => {
    const f = await mkFrame()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 10, movementDate: TODAY }, db)
    const stats = await getInventoryStats(db)
    expect(stats.recentMovements.length).toBeGreaterThan(0)
  })
})

// ── updateProductPricing ──────────────────────────────────────────────────────

describe('updateProductPricing', () => {
  it('updates reorderPoint on frame', async () => {
    const f = await mkFrame()
    await updateProductPricing('frame', f.id, { reorderPoint: 15 }, db)
    const updated = await db.frames.get(f.id)
    expect(updated!.reorderPoint).toBe(15)
  })

  it('updates costPrice and sellingPrice on lens', async () => {
    const l = await mkLens()
    await updateProductPricing('lens', l.id, { costPrice: 50, sellingPrice: 100 }, db)
    const updated = await db.lenses.get(l.id)
    expect(updated!.costPrice).toBe(50)
    expect(updated!.sellingPrice).toBe(100)
  })
})

// ── getNextSessionNumber ──────────────────────────────────────────────────────

describe('getNextSessionNumber', () => {
  it('returns ST-000001 for first session', async () => {
    const num = await getNextSessionNumber(db)
    expect(num).toBe('ST-000001')
  })

  it('increments sequentially', async () => {
    const a = await getNextSessionNumber(db)
    const b = await getNextSessionNumber(db)
    expect(a).toBe('ST-000001')
    expect(b).toBe('ST-000002')
  })
})

// ── createStocktakingSession ──────────────────────────────────────────────────

describe('createStocktakingSession', () => {
  it('creates a draft session with a unique number', async () => {
    const session = await createStocktakingSession({ sessionDate: TODAY }, db)
    expect(session.sessionNumber).toBe('ST-000001')
    expect(session.status).toBe('draft')
    expect(session.sessionDate).toBe(TODAY)
  })

  it('creates multiple sessions with sequential numbers', async () => {
    const a = await createStocktakingSession({ sessionDate: TODAY }, db)
    const b = await createStocktakingSession({ sessionDate: TODAY }, db)
    expect(a.sessionNumber).toBe('ST-000001')
    expect(b.sessionNumber).toBe('ST-000002')
  })
})

// ── getStocktakingSessions ────────────────────────────────────────────────────

describe('getStocktakingSessions', () => {
  it('returns all sessions in reverse chronological order', async () => {
    await createStocktakingSession({ sessionDate: TODAY }, db)
    await createStocktakingSession({ sessionDate: TODAY }, db)
    const sessions = await getStocktakingSessions(db)
    expect(sessions.length).toBe(2)
    expect(sessions[0].createdAt >= sessions[1].createdAt).toBe(true)
  })
})

// ── addStocktakingItem ────────────────────────────────────────────────────────

describe('addStocktakingItem', () => {
  it('adds a frame item with correct systemQty', async () => {
    const f = await mkFrame()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 12, movementDate: TODAY }, db)
    const session = await createStocktakingSession({ sessionDate: TODAY }, db)
    const item = await addStocktakingItem(session.id, 'frame', f.id, db)
    expect(item.systemQty).toBe(12)
    expect(item.productType).toBe('frame')
  })

  it('throws if product already in session', async () => {
    const f = await mkFrame()
    const session = await createStocktakingSession({ sessionDate: TODAY }, db)
    await addStocktakingItem(session.id, 'frame', f.id, db)
    await expect(addStocktakingItem(session.id, 'frame', f.id, db)).rejects.toThrow('already in this session')
  })

  it('throws if session is confirmed', async () => {
    const f = await mkFrame()
    const session = await createStocktakingSession({ sessionDate: TODAY }, db)
    await addStocktakingItem(session.id, 'frame', f.id, db)
    const items = await getStocktakingItems(session.id, db)
    await updateStocktakingCount(items[0].id, 5, db)
    await confirmStocktakingSession(session.id, db)

    const f2 = await mkFrame()
    await expect(addStocktakingItem(session.id, 'frame', f2.id, db)).rejects.toThrow()
  })
})

// ── updateStocktakingCount ────────────────────────────────────────────────────

describe('updateStocktakingCount', () => {
  it('sets countedQty on item', async () => {
    const f = await mkFrame()
    const session = await createStocktakingSession({ sessionDate: TODAY }, db)
    const item = await addStocktakingItem(session.id, 'frame', f.id, db)
    await updateStocktakingCount(item.id, 7, db)
    const items = await getStocktakingItems(session.id, db)
    expect(items[0].countedQty).toBe(7)
  })
})

// ── confirmStocktakingSession ─────────────────────────────────────────────────

describe('confirmStocktakingSession', () => {
  it('confirms session and creates adjustment movements', async () => {
    const f = await mkFrame()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 10, movementDate: TODAY }, db)
    const session = await createStocktakingSession({ sessionDate: TODAY }, db)
    const item = await addStocktakingItem(session.id, 'frame', f.id, db)
    await updateStocktakingCount(item.id, 8, db) // counted 8, system has 10 → diff = -2

    await confirmStocktakingSession(session.id, db)

    const confirmed = await getStocktakingSession(session.id, db)
    expect(confirmed!.status).toBe('confirmed')
    expect(confirmed!.confirmedAt).toBeDefined()
    expect(await getCurrentStock('frame', f.id, db)).toBe(8)

    const movements = await getMovements({ productType: 'frame', productId: f.id }, db)
    const adj = movements.find(m => m.movementType === 'adjustment_out')
    expect(adj).toBeDefined()
    expect(adj!.quantity).toBe(-2)
  })

  it('skips item with no countedQty', async () => {
    const f = await mkFrame()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 10, movementDate: TODAY }, db)
    const session = await createStocktakingSession({ sessionDate: TODAY }, db)
    await addStocktakingItem(session.id, 'frame', f.id, db) // no counted qty

    await confirmStocktakingSession(session.id, db)
    expect(await getCurrentStock('frame', f.id, db)).toBe(10) // unchanged
  })

  it('skips item with zero difference', async () => {
    const f = await mkFrame()
    await createMovement({ productType: 'frame', productId: f.id, movementType: 'opening', quantity: 10, movementDate: TODAY }, db)
    const session = await createStocktakingSession({ sessionDate: TODAY }, db)
    const item = await addStocktakingItem(session.id, 'frame', f.id, db)
    await updateStocktakingCount(item.id, 10, db) // same as system → no movement

    const movsBefore = (await getMovements({}, db)).length
    await confirmStocktakingSession(session.id, db)
    const movsAfter = (await getMovements({}, db)).length
    expect(movsAfter).toBe(movsBefore) // no new movement
  })

  it('throws if session already confirmed (prevents double-apply)', async () => {
    const session = await createStocktakingSession({ sessionDate: TODAY }, db)
    await confirmStocktakingSession(session.id, db)
    await expect(confirmStocktakingSession(session.id, db)).rejects.toThrow('already confirmed')
  })

  it('throws for cancelled session', async () => {
    const session = await createStocktakingSession({ sessionDate: TODAY }, db)
    await updateSessionStatus(session.id, 'cancelled', db)
    await expect(confirmStocktakingSession(session.id, db)).rejects.toThrow()
  })
})

// ── updateSessionStatus ───────────────────────────────────────────────────────

describe('updateSessionStatus', () => {
  it('updates status to in_progress', async () => {
    const session = await createStocktakingSession({ sessionDate: TODAY }, db)
    await updateSessionStatus(session.id, 'in_progress', db)
    const updated = await getStocktakingSession(session.id, db)
    expect(updated!.status).toBe('in_progress')
  })

  it('throws if session is confirmed', async () => {
    const session = await createStocktakingSession({ sessionDate: TODAY }, db)
    await confirmStocktakingSession(session.id, db)
    await expect(updateSessionStatus(session.id, 'in_progress', db)).rejects.toThrow('confirmed')
  })
})
