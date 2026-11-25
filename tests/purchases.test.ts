/**
 * Phase 07 Tests — Suppliers & Purchase Management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import { BarOptDB } from '../src/database/db'
import {
  createSupplier, updateSupplier, getSupplierById,
  searchSuppliers, archiveSupplier, restoreSupplier, getSupplierStats,
} from '../src/modules/purchases/SupplierRepository'
import {
  createPurchase, getPurchaseById, getPurchaseItems, searchPurchases,
  getPurchasesBySupplier, addItemToDraft, removeItemFromDraft,
  recalcPurchaseTotals, getNextPurchaseNumber, calculateTotals,
} from '../src/modules/purchases/PurchaseRepository'
import {
  markAsOrdered, cancelPurchase, receivePurchaseItems, getPurchaseMovements,
} from '../src/modules/purchases/PurchaseService'
import { createFrame } from '../src/modules/catalog/FrameRepository'
import { createLens } from '../src/modules/catalog/LensRepository'

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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function mkSupplier(overrides: Record<string, unknown> = {}) {
  return createSupplier({ name: 'Acme Optics', ...overrides } as Parameters<typeof createSupplier>[0], db)
}

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
    name: `Lens-${uuidv4().slice(0, 8)}`,
    lensType: 'single_vision',
    notes: '',
    variants: [{ sph: 0, cyl: 0, quantity: 0, price: 50 }],
    ...overrides,
  } as Parameters<typeof createLens>[0], db)
}

async function mkPurchase(supplierId: string, overrides: Record<string, unknown> = {}) {
  return createPurchase({
    supplierId,
    purchaseDate: '2026-01-15',
    discountAmount: 0,
    taxAmount: 0,
    ...overrides,
  } as Parameters<typeof createPurchase>[0], [], db)
}

// ── 1. Supplier CRUD ──────────────────────────────────────────────────────────

describe('Supplier CRUD', () => {
  it('creates a supplier', async () => {
    const s = await mkSupplier({ name: 'VisionPro', phone: '0501111111' })
    expect(s.id).toBeTruthy()
    expect(s.name).toBe('VisionPro')
    expect(s.phone).toBe('0501111111')
    expect(s.deletedAt).toBeUndefined()
  })

  it('reads supplier by id', async () => {
    const s = await mkSupplier()
    const fetched = await getSupplierById(s.id, db)
    expect(fetched?.id).toBe(s.id)
  })

  it('updates supplier fields', async () => {
    const s = await mkSupplier()
    const updated = await updateSupplier(s.id, {
      name: 'New Name',
      contactName: 'John',
      phone: '0509999999',
      email: 'john@example.com',
      address: '123 Main St',
      taxNumber: 'TX-999',
      paymentTerms: 'Net 30',
      notes: 'Preferred supplier',
    }, db)
    expect(updated.name).toBe('New Name')
    expect(updated.contactName).toBe('John')
    expect(updated.paymentTerms).toBe('Net 30')
  })

  it('searches suppliers by name', async () => {
    await mkSupplier({ name: 'VisionPro' })
    await mkSupplier({ name: 'OptiWorld' })
    const results = await searchSuppliers('vision', false, db)
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('VisionPro')
  })

  it('archives and restores a supplier', async () => {
    const s = await mkSupplier()
    await archiveSupplier(s.id, db)
    const archived = await getSupplierById(s.id, db)
    expect(archived?.deletedAt).toBeDefined()

    const active = await searchSuppliers(undefined, false, db)
    expect(active.find(x => x.id === s.id)).toBeUndefined()

    await restoreSupplier(s.id, db)
    const restored = await getSupplierById(s.id, db)
    expect(restored?.deletedAt).toBeUndefined()
  })

  it('includes archived when showArchived=true', async () => {
    const s = await mkSupplier({ name: 'ArchivedCo' })
    await archiveSupplier(s.id, db)
    const all = await searchSuppliers(undefined, true, db)
    expect(all.find(x => x.id === s.id)).toBeDefined()
  })
})

// ── 2. PO Number Sequence ─────────────────────────────────────────────────────

describe('PO Number Sequence', () => {
  it('generates PO-000001 for first purchase', async () => {
    const num = await getNextPurchaseNumber(db)
    expect(num).toBe('PO-000001')
  })

  it('increments sequence for each purchase', async () => {
    const a = await getNextPurchaseNumber(db)
    const b = await getNextPurchaseNumber(db)
    expect(a).toBe('PO-000001')
    expect(b).toBe('PO-000002')
  })

  it('purchase numbers are unique across creates', async () => {
    const s = await mkSupplier()
    const p1 = await mkPurchase(s.id)
    const p2 = await mkPurchase(s.id)
    expect(p1.purchaseNumber).not.toBe(p2.purchaseNumber)
  })
})

// ── 3. Purchase creation ──────────────────────────────────────────────────────

describe('Purchase creation', () => {
  it('creates a draft purchase with no items', async () => {
    const s = await mkSupplier()
    const p = await mkPurchase(s.id)
    expect(p.status).toBe('draft')
    expect(p.paidAmount).toBe(0)
    expect(p.purchaseNumber).toMatch(/^PO-\d{6}$/)
  })

  it('creates purchase with items and calculates totals', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const purchase = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 5, unitCost: 100, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    expect(purchase.subtotal).toBe(500)
    expect(purchase.total).toBe(500)
    const items = await getPurchaseItems(purchase.id, db)
    expect(items.length).toBe(1)
    expect(items[0].orderedQty).toBe(5)
    expect(items[0].receivedQty).toBe(0)
    expect(items[0].lineTotal).toBe(500)
  })

  it('applies order-level discount and tax in total', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const purchase = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 50, taxAmount: 25 },
      [{ productType: 'frame', productId: f.id, orderedQty: 2, unitCost: 200, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    expect(purchase.subtotal).toBe(400)
    expect(purchase.total).toBe(375) // 400 - 50 + 25
  })
})

// ── 4. calculateTotals helper ─────────────────────────────────────────────────

describe('calculateTotals', () => {
  it('computes correct line and order totals', () => {
    const result = calculateTotals(
      [
        { orderedQty: 3, unitCost: 100, discountAmount: 10, taxAmount: 5 },
        { orderedQty: 2, unitCost: 50, discountAmount: 0, taxAmount: 0 },
      ],
      20, // order discount
      10, // order tax
    )
    // items: (300-10+5) + (100) = 395
    expect(result.itemsSubtotal).toBe(395)
    expect(result.total).toBe(385) // 395 - 20 + 10
  })
})

// ── 5. Draft item management ──────────────────────────────────────────────────

describe('Draft item management', () => {
  it('adds item to draft and recalcs totals', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await mkPurchase(s.id)
    await addItemToDraft(p.id, { productType: 'frame', productId: f.id, orderedQty: 3, unitCost: 100, discountAmount: 0, taxAmount: 0 }, db)
    const updated = await getPurchaseById(p.id, db)
    expect(updated?.subtotal).toBe(300)
  })

  it('removes item from draft and recalcs totals', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await mkPurchase(s.id)
    const item = await addItemToDraft(p.id, { productType: 'frame', productId: f.id, orderedQty: 2, unitCost: 50, discountAmount: 0, taxAmount: 0 }, db)
    await removeItemFromDraft(item.id, db)
    const items = await getPurchaseItems(p.id, db)
    expect(items.length).toBe(0)
    const updated = await getPurchaseById(p.id, db)
    expect(updated?.subtotal).toBe(0)
  })

  it('rejects adding items to ordered purchase', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 1, unitCost: 10, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    await expect(
      addItemToDraft(p.id, { productType: 'frame', productId: f.id, orderedQty: 1, unitCost: 10, discountAmount: 0, taxAmount: 0 }, db)
    ).rejects.toThrow()
  })
})

// ── 6. Status transitions ─────────────────────────────────────────────────────

describe('Status transitions', () => {
  it('marks draft as ordered', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 1, unitCost: 10, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    const updated = await getPurchaseById(p.id, db)
    expect(updated?.status).toBe('ordered')
    expect(updated?.orderedAt).toBeDefined()
  })

  it('rejects ordering a draft with no items', async () => {
    const s = await mkSupplier()
    const p = await mkPurchase(s.id)
    await expect(markAsOrdered(p.id, db)).rejects.toThrow()
  })

  it('cancels an ordered purchase', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 1, unitCost: 10, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    await cancelPurchase(p.id, db)
    const updated = await getPurchaseById(p.id, db)
    expect(updated?.status).toBe('cancelled')
  })

  it('rejects cancelling a received purchase', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 1, unitCost: 10, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    const items = await getPurchaseItems(p.id, db)
    await receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 1 }], '2026-01-20', db)
    await expect(cancelPurchase(p.id, db)).rejects.toThrow()
  })
})

// ── 7. Receiving — full receive ───────────────────────────────────────────────

describe('Receiving — full', () => {
  it('receives all items and transitions to received', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 5, unitCost: 100, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    const items = await getPurchaseItems(p.id, db)
    await receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 5 }], '2026-01-20', db)

    const updated = await getPurchaseById(p.id, db)
    expect(updated?.status).toBe('received')
    expect(updated?.receivedAt).toBe('2026-01-20')

    const updatedItem = await db.purchaseItems.get(items[0].id)
    expect(updatedItem?.receivedQty).toBe(5)

    const updatedFrame = await db.frames.get(f.id)
    expect(updatedFrame?.quantity).toBe(5)
  })

  it('creates a stock_in movement with purchase reference', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 3, unitCost: 50, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    const items = await getPurchaseItems(p.id, db)
    await receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 3 }], '2026-01-20', db)

    const movements = await getPurchaseMovements(p.id, db)
    expect(movements.length).toBe(1)
    expect(movements[0].movementType).toBe('stock_in')
    expect(movements[0].quantity).toBe(3)
    expect(movements[0].referenceId).toBe(p.id)
    expect(movements[0].referenceNumber).toBe(p.purchaseNumber)
  })
})

// ── 8. Receiving — partial ────────────────────────────────────────────────────

describe('Receiving — partial', () => {
  it('partial receive transitions to partial status', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 10, unitCost: 20, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    const items = await getPurchaseItems(p.id, db)
    await receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 4 }], '2026-01-20', db)

    const updated = await getPurchaseById(p.id, db)
    expect(updated?.status).toBe('partial')

    const updatedFrame = await db.frames.get(f.id)
    expect(updatedFrame?.quantity).toBe(4)
  })

  it('receives rest and transitions to received', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 6, unitCost: 10, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    const items = await getPurchaseItems(p.id, db)
    await receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 4 }], '2026-01-20', db)
    await receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 2 }], '2026-01-21', db)

    const updated = await getPurchaseById(p.id, db)
    expect(updated?.status).toBe('received')

    const updatedFrame = await db.frames.get(f.id)
    expect(updatedFrame?.quantity).toBe(6)
  })
})

// ── 9. Over-receiving prevention ─────────────────────────────────────────────

describe('Over-receiving prevention', () => {
  it('rejects receiving more than outstanding', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 5, unitCost: 10, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    const items = await getPurchaseItems(p.id, db)
    await expect(
      receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 6 }], '2026-01-20', db)
    ).rejects.toThrow()
  })

  it('rejects receiving already-fully-received item', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 2, unitCost: 10, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    const items = await getPurchaseItems(p.id, db)
    await receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 2 }], '2026-01-20', db)
    await expect(
      receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 1 }], '2026-01-21', db)
    ).rejects.toThrow()
  })
})

// ── 10. Duplicate receiving prevention ───────────────────────────────────────

describe('Duplicate receiving prevention', () => {
  it('rejects receiving against an already-fully-received purchase', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 1, unitCost: 10, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    const items = await getPurchaseItems(p.id, db)
    await receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 1 }], '2026-01-20', db)
    await expect(
      receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 1 }], '2026-01-20', db)
    ).rejects.toThrow()
  })

  it('rejects receiving against a cancelled purchase', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 1, unitCost: 10, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    await cancelPurchase(p.id, db)
    const items = await getPurchaseItems(p.id, db)
    await expect(
      receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 1 }], '2026-01-20', db)
    ).rejects.toThrow()
  })
})

// ── 11. Atomic inventory integration ─────────────────────────────────────────

describe('Atomic inventory integration', () => {
  it('receiving lens updates lens quantity', async () => {
    const s = await mkSupplier()
    const l = await mkLens()
    expect((await db.lenses.get(l.id))?.quantity ?? 0).toBe(0)

    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'lens', productId: l.id, orderedQty: 8, unitCost: 25, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    const items = await getPurchaseItems(p.id, db)
    await receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 8 }], '2026-01-20', db)

    const updatedLens = await db.lenses.get(l.id)
    expect(updatedLens?.quantity).toBe(8)
  })

  it('quantityBefore and quantityAfter on movement are correct', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    // Manually set an initial quantity
    await db.frames.update(f.id, { quantity: 10 })

    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 5, unitCost: 10, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    const items = await getPurchaseItems(p.id, db)
    await receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 5 }], '2026-01-20', db)

    const movements = await getPurchaseMovements(p.id, db)
    expect(movements[0].quantityBefore).toBe(10)
    expect(movements[0].quantityAfter).toBe(15)
  })

  it('receiving zero items throws', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 5, unitCost: 10, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p.id, db)
    const items = await getPurchaseItems(p.id, db)
    await expect(
      receivePurchaseItems(p.id, [{ itemId: items[0].id, qty: 0 }], '2026-01-20', db)
    ).rejects.toThrow('No items to receive')
  })
})

// ── 12. Supplier stats ────────────────────────────────────────────────────────

describe('Supplier stats', () => {
  it('counts orders and received purchases', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()

    // draft order (not received)
    await mkPurchase(s.id)

    // ordered + received
    const p2 = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-10', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 2, unitCost: 100, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p2.id, db)
    const items = await getPurchaseItems(p2.id, db)
    await receivePurchaseItems(p2.id, [{ itemId: items[0].id, qty: 2 }], '2026-01-15', db)

    const stats = await getSupplierStats(s.id, db)
    expect(stats.totalOrders).toBe(2)
    expect(stats.totalReceived).toBe(1)
    expect(stats.totalValue).toBe(200)
  })
})

// ── 13. Search & filter ───────────────────────────────────────────────────────

describe('Search & filter', () => {
  it('filters purchases by supplier', async () => {
    const s1 = await mkSupplier({ name: 'Supplier A' })
    const s2 = await mkSupplier({ name: 'Supplier B' })
    await mkPurchase(s1.id)
    await mkPurchase(s2.id)
    await mkPurchase(s1.id)
    const results = await getPurchasesBySupplier(s1.id, db)
    expect(results.length).toBe(2)
    results.forEach(p => expect(p.supplierId).toBe(s1.id))
  })

  it('filters purchases by status', async () => {
    const s = await mkSupplier()
    const f = await mkFrame()
    const p1 = await createPurchase(
      { supplierId: s.id, purchaseDate: '2026-01-15', discountAmount: 0, taxAmount: 0 },
      [{ productType: 'frame', productId: f.id, orderedQty: 1, unitCost: 10, discountAmount: 0, taxAmount: 0 }],
      db,
    )
    await markAsOrdered(p1.id, db)
    await mkPurchase(s.id) // draft

    const ordered = await searchPurchases({ status: 'ordered' }, db)
    expect(ordered.every(p => p.status === 'ordered')).toBe(true)
  })

  it('searches purchases by PO number', async () => {
    const s = await mkSupplier()
    const p = await mkPurchase(s.id)
    const results = await searchPurchases({ query: p.purchaseNumber }, db)
    expect(results.length).toBe(1)
    expect(results[0].id).toBe(p.id)
  })
})
