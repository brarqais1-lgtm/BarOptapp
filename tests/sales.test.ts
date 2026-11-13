/**
 * Phase 08 Tests — Sales & Invoicing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import { BarOptDB } from '../src/database/db'
import { createFrame } from '../src/modules/catalog/FrameRepository'
import { createLens } from '../src/modules/catalog/LensRepository'
import {
  getNextSaleNumber, createSale, updateSaleDraft,
  confirmSale, cancelSale, getSaleById, getSaleItems,
  searchSales, getSalesDashboardStats,
} from '../src/modules/sales/SalesRepository'
import { addPayment, getPayments, deletePayment } from '../src/modules/sales/PaymentsRepository'
import {
  processReturn, getSaleReturns, getSaleReturnItems,
  getNextReturnNumber,
} from '../src/modules/sales/ReturnsService'
import type { SaleFormValues, SaleItemFormValues, PaymentFormValues } from '../src/modules/sales/sales.schema'

function createTestDB() { return new BarOptDB() }
let db: BarOptDB

beforeEach(async () => { db = createTestDB(); await db.open() })
afterEach(async () => { await db.close(); db.delete() })

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10) }

async function mkFrame(qty = 10, price = 100) {
  const frame = await createFrame({
    sku: `FRM-${uuidv4().slice(0, 8)}`,
    brand: 'TestBrand',
    model: 'Model-A',
    gender: 'unisex',
    sellingPrice: price,
    quantity: qty,
  }, db)
  await db.frames.update(frame.id, { quantity: qty })
  return frame
}

async function mkLens(qty = 20, price = 200) {
  const lens = await createLens({
    sku: `LNS-${uuidv4().slice(0, 8)}`,
    brand: 'LensCo',
    lensType: 'single_vision',
    coatings: [],
    sellingPrice: price,
    quantity: qty,
  }, db)
  await db.lenses.update(lens.id, { quantity: qty })
  return lens
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

function paymentData(amount: number, overrides: Partial<PaymentFormValues> = {}): PaymentFormValues {
  return { amount, method: 'cash', paidAt: today(), ...overrides }
}

// ── 1. Sequence numbers ───────────────────────────────────────────────────────

describe('Sale sequence numbers', () => {
  it('generates INV-000001 on first call', async () => {
    const num = await getNextSaleNumber(db)
    expect(num).toBe('INV-000001')
  })

  it('increments on subsequent calls', async () => {
    await getNextSaleNumber(db)
    const num2 = await getNextSaleNumber(db)
    expect(num2).toBe('INV-000002')
  })

  it('generates RT-000001 for returns', async () => {
    const num = await getNextReturnNumber(db)
    expect(num).toBe('RT-000001')
  })
})

// ── 2. Create sale ────────────────────────────────────────────────────────────

describe('createSale', () => {
  it('creates a draft sale with correct totals', async () => {
    const sale = await createSale(header(), [item()], db)
    expect(sale.status).toBe('draft')
    expect(sale.saleNumber).toBe('INV-000001')
    expect(sale.total).toBe(50)
    expect(sale.paidAmount).toBe(0)
    expect(sale.balanceDue).toBe(50)
    expect(sale.paymentStatus).toBe('unpaid')
  })

  it('stores sale items', async () => {
    const sale = await createSale(header(), [item(), item({ description: 'Exam', unitPrice: 30 })], db)
    const items = await getSaleItems(sale.id, db)
    expect(items).toHaveLength(2)
    expect(items.map(i => i.total).sort()).toEqual([30, 50])
  })

  it('applies item discount', async () => {
    const sale = await createSale(header(), [item({ unitPrice: 100, discountAmount: 20 })], db)
    expect(sale.total).toBe(80)
  })

  it('applies order discount amount', async () => {
    const sale = await createSale(header({ discountAmount: 10 }), [item({ unitPrice: 100 })], db)
    expect(sale.total).toBe(90)
  })

  it('applies order discount percent', async () => {
    const sale = await createSale(header({ discountPercent: 20 }), [item({ unitPrice: 100 })], db)
    expect(sale.total).toBe(80)
  })

  it('combines both discounts', async () => {
    const sale = await createSale(
      header({ discountAmount: 10, discountPercent: 10 }),
      [item({ unitPrice: 200 })],
      db
    )
    // subtotal=200, pct=20, fixed=10, total=170
    expect(sale.total).toBe(170)
  })

  it('sets walkInName for walk-in customer', async () => {
    const sale = await createSale(header({ walkInName: 'Walk-In Customer' }), [item()], db)
    expect(sale.walkInName).toBe('Walk-In Customer')
    expect(sale.patientId).toBeUndefined()
  })

  it('sets initializes returnedQty=0 on each item', async () => {
    const sale = await createSale(header(), [item()], db)
    const items = await getSaleItems(sale.id, db)
    items.forEach(i => expect(i.returnedQty).toBe(0))
  })
})

// ── 3. Update draft ───────────────────────────────────────────────────────────

describe('updateSaleDraft', () => {
  it('replaces items and recalculates totals', async () => {
    const sale = await createSale(header(), [item({ unitPrice: 50 })], db)
    const updated = await updateSaleDraft(
      sale.id,
      header({ discountAmount: 5 }),
      [item({ unitPrice: 100 }), item({ description: 'B', unitPrice: 60 })],
      db
    )
    // subtotal=160, discount=5, total=155
    expect(updated.total).toBe(155)
    const items = await getSaleItems(sale.id, db)
    expect(items).toHaveLength(2)
  })

  it('throws if sale is not draft', async () => {
    const sale = await createSale(header(), [item()], db)
    await confirmSale(sale.id, db)
    await expect(updateSaleDraft(sale.id, header(), [item()], db)).rejects.toThrow()
  })
})

// ── 4. Confirm sale (inventory deduction) ─────────────────────────────────────

describe('confirmSale', () => {
  it('confirms a draft sale with no inventory items', async () => {
    const sale = await createSale(header(), [item()], db)
    await confirmSale(sale.id, db)
    const updated = await getSaleById(sale.id, db)
    expect(updated?.status).toBe('confirmed')
  })

  it('deducts frame quantity on confirm', async () => {
    const frame = await mkFrame(10, 100)
    const sale = await createSale(
      header(),
      [item({ itemType: 'frame', itemId: frame.id, description: 'Frame', quantity: 3, unitPrice: 100 })],
      db
    )
    await confirmSale(sale.id, db)
    const updated = await db.frames.get(frame.id)
    expect(updated?.quantity).toBe(7)
  })

  it('deducts lens quantity on confirm', async () => {
    const lens = await mkLens(15, 200)
    const sale = await createSale(
      header(),
      [item({ itemType: 'lens', itemId: lens.id, description: 'Lens', quantity: 2, unitPrice: 200 })],
      db
    )
    await confirmSale(sale.id, db)
    const updated = await db.lenses.get(lens.id)
    expect(updated?.quantity).toBe(13)
  })

  it('records stock_out inventory movement on confirm', async () => {
    const frame = await mkFrame(10, 100)
    const sale = await createSale(
      header(),
      [item({ itemType: 'frame', itemId: frame.id, description: 'Frame', quantity: 2, unitPrice: 100 })],
      db
    )
    await confirmSale(sale.id, db)
    const movements = await db.inventoryMovements
      .where('itemId').equals(frame.id)
      .filter(m => m.movementType === 'stock_out')
      .toArray()
    expect(movements).toHaveLength(1)
    expect(movements[0].quantity).toBe(-2)
    expect(movements[0].referenceType).toBe('sale')
  })

  it('throws on insufficient stock', async () => {
    const frame = await mkFrame(2, 100)
    const sale = await createSale(
      header(),
      [item({ itemType: 'frame', itemId: frame.id, description: 'Frame', quantity: 5, unitPrice: 100 })],
      db
    )
    await expect(confirmSale(sale.id, db)).rejects.toThrow(/insufficient stock/i)
  })

  it('throws if already confirmed', async () => {
    const sale = await createSale(header(), [item()], db)
    await confirmSale(sale.id, db)
    await expect(confirmSale(sale.id, db)).rejects.toThrow()
  })

  it('throws for empty sale', async () => {
    const sale = await createSale(header(), [item()], db)
    await db.saleItems.where('saleId').equals(sale.id).delete()
    await expect(confirmSale(sale.id, db)).rejects.toThrow()
  })
})

// ── 5. Cancel sale ────────────────────────────────────────────────────────────

describe('cancelSale', () => {
  it('cancels a draft without restoring inventory', async () => {
    const frame = await mkFrame(10, 100)
    const sale = await createSale(
      header(),
      [item({ itemType: 'frame', itemId: frame.id, description: 'Frame', quantity: 2, unitPrice: 100 })],
      db
    )
    await cancelSale(sale.id, db)
    const updated = await db.frames.get(frame.id)
    expect(updated?.quantity).toBe(10) // unchanged (never deducted)
    const s = await getSaleById(sale.id, db)
    expect(s?.status).toBe('cancelled')
  })

  it('restores inventory when cancelling a confirmed sale', async () => {
    const frame = await mkFrame(10, 100)
    const sale = await createSale(
      header(),
      [item({ itemType: 'frame', itemId: frame.id, description: 'Frame', quantity: 3, unitPrice: 100 })],
      db
    )
    await confirmSale(sale.id, db)
    await cancelSale(sale.id, db)
    const updated = await db.frames.get(frame.id)
    expect(updated?.quantity).toBe(10) // restored
  })

  it('throws if already cancelled', async () => {
    const sale = await createSale(header(), [item()], db)
    await cancelSale(sale.id, db)
    await expect(cancelSale(sale.id, db)).rejects.toThrow()
  })
})

// ── 6. Payments ───────────────────────────────────────────────────────────────

describe('addPayment', () => {
  async function confirmedSale() {
    const sale = await createSale(header(), [item({ unitPrice: 200 })], db)
    await confirmSale(sale.id, db)
    return db.sales.get(sale.id).then(s => s!)
  }

  it('records a payment and updates paidAmount', async () => {
    const sale = await confirmedSale()
    await addPayment(sale.id, paymentData(50), db)
    const updated = await db.sales.get(sale.id)
    expect(updated?.paidAmount).toBe(50)
    expect(updated?.balanceDue).toBe(150)
    expect(updated?.paymentStatus).toBe('partial')
  })

  it('marks paid when full amount paid', async () => {
    const sale = await confirmedSale()
    await addPayment(sale.id, paymentData(200), db)
    const updated = await db.sales.get(sale.id)
    expect(updated?.paymentStatus).toBe('paid')
    expect(updated?.balanceDue).toBe(0)
  })

  it('allows multiple partial payments summing to full', async () => {
    const sale = await confirmedSale()
    await addPayment(sale.id, paymentData(100), db)
    await addPayment(sale.id, paymentData(100), db)
    const updated = await db.sales.get(sale.id)
    expect(updated?.paymentStatus).toBe('paid')
  })

  it('throws when exceeding remaining balance', async () => {
    const sale = await confirmedSale()
    await expect(addPayment(sale.id, paymentData(300), db)).rejects.toThrow(/exceeds/)
  })

  it('throws for draft sale', async () => {
    const sale = await createSale(header(), [item()], db)
    await expect(addPayment(sale.id, paymentData(10), db)).rejects.toThrow()
  })

  it('retrieves payments for a sale', async () => {
    const sale = await confirmedSale()
    await addPayment(sale.id, paymentData(50), db)
    await addPayment(sale.id, paymentData(30), db)
    const payments = await getPayments(sale.id, db)
    expect(payments).toHaveLength(2)
    expect(payments.reduce((s, p) => s + p.amount, 0)).toBe(80)
  })
})

describe('deletePayment', () => {
  it('removes payment and reduces paidAmount', async () => {
    const sale = await createSale(header(), [item({ unitPrice: 200 })], db)
    await confirmSale(sale.id, db)
    const payment = await addPayment(sale.id, paymentData(100), db)
    await deletePayment(payment.id, db)
    const updated = await db.sales.get(sale.id)
    expect(updated?.paidAmount).toBe(0)
    expect(updated?.paymentStatus).toBe('unpaid')
  })
})

// ── 7. Returns ────────────────────────────────────────────────────────────────

describe('processReturn', () => {
  async function confirmedSaleWithFrame() {
    const frame = await mkFrame(10, 100)
    const sale = await createSale(
      header(),
      [item({ itemType: 'frame', itemId: frame.id, description: 'Frame', quantity: 3, unitPrice: 100 })],
      db
    )
    await confirmSale(sale.id, db)
    const items = await getSaleItems(sale.id, db)
    return { sale: (await db.sales.get(sale.id))!, frame, saleItem: items[0] }
  }

  it('creates a return and updates returnedQty', async () => {
    const { sale, saleItem } = await confirmedSaleWithFrame()
    await processReturn(sale.id, [{ saleItemId: saleItem.id, quantity: 1, restockItem: false }], today(), undefined, undefined, db)
    const updated = await db.saleItems.get(saleItem.id)
    expect(updated?.returnedQty).toBe(1)
  })

  it('restocks frame when restockItem=true', async () => {
    const { sale, frame, saleItem } = await confirmedSaleWithFrame()
    // frame qty should be 7 after confirm
    await processReturn(sale.id, [{ saleItemId: saleItem.id, quantity: 2, restockItem: true }], today(), undefined, undefined, db)
    const updatedFrame = await db.frames.get(frame.id)
    expect(updatedFrame?.quantity).toBe(9) // 7 + 2
  })

  it('does NOT restock frame when restockItem=false', async () => {
    const { sale, frame, saleItem } = await confirmedSaleWithFrame()
    await processReturn(sale.id, [{ saleItemId: saleItem.id, quantity: 1, restockItem: false }], today(), undefined, undefined, db)
    const updatedFrame = await db.frames.get(frame.id)
    expect(updatedFrame?.quantity).toBe(7) // unchanged
  })

  it('records returned inventory movement', async () => {
    const { sale, frame, saleItem } = await confirmedSaleWithFrame()
    await processReturn(sale.id, [{ saleItemId: saleItem.id, quantity: 1, restockItem: true }], today(), undefined, undefined, db)
    const movements = await db.inventoryMovements
      .where('itemId').equals(frame.id)
      .filter(m => m.movementType === 'returned')
      .toArray()
    expect(movements).toHaveLength(1)
    expect(movements[0].referenceType).toBe('sale_return')
  })

  it('throws when exceeding returnable quantity', async () => {
    const { sale, saleItem } = await confirmedSaleWithFrame()
    await expect(
      processReturn(sale.id, [{ saleItemId: saleItem.id, quantity: 5, restockItem: false }], today(), undefined, undefined, db)
    ).rejects.toThrow(/returnable/)
  })

  it('allows partial returns across multiple calls', async () => {
    const { sale, saleItem } = await confirmedSaleWithFrame()
    await processReturn(sale.id, [{ saleItemId: saleItem.id, quantity: 1, restockItem: false }], today(), undefined, undefined, db)
    await processReturn(sale.id, [{ saleItemId: saleItem.id, quantity: 1, restockItem: false }], today(), undefined, undefined, db)
    const updated = await db.saleItems.get(saleItem.id)
    expect(updated?.returnedQty).toBe(2)
  })

  it('throws for draft sale', async () => {
    const sale = await createSale(header(), [item()], db)
    const items = await getSaleItems(sale.id, db)
    await expect(
      processReturn(sale.id, [{ saleItemId: items[0].id, quantity: 1, restockItem: false }], today(), undefined, undefined, db)
    ).rejects.toThrow()
  })

  it('throws when no items have quantity > 0', async () => {
    const { sale, saleItem } = await confirmedSaleWithFrame()
    await expect(
      processReturn(sale.id, [{ saleItemId: saleItem.id, quantity: 0, restockItem: false }], today(), undefined, undefined, db)
    ).rejects.toThrow(/no items/i)
  })

  it('stores SaleReturn and SaleReturnItems', async () => {
    const { sale, saleItem } = await confirmedSaleWithFrame()
    const ret = await processReturn(sale.id, [{ saleItemId: saleItem.id, quantity: 2, restockItem: false }], today(), 'defect', undefined, db)
    expect(ret.reason).toBe('defect')
    expect(ret.totalRefund).toBe(200) // 2 * 100
    const retItems = await getSaleReturnItems(ret.id, db)
    expect(retItems).toHaveLength(1)
    expect(retItems[0].quantity).toBe(2)
  })

  it('retrieves returns for a sale', async () => {
    const { sale, saleItem } = await confirmedSaleWithFrame()
    await processReturn(sale.id, [{ saleItemId: saleItem.id, quantity: 1, restockItem: false }], today(), undefined, undefined, db)
    const returns = await getSaleReturns(sale.id, db)
    expect(returns).toHaveLength(1)
    expect(returns[0].returnNumber).toMatch(/^RT-/)
  })
})

// ── 8. Search & filters ───────────────────────────────────────────────────────

describe('searchSales', () => {
  it('returns empty array when no sales', async () => {
    const result = await searchSales({}, db)
    expect(result).toEqual([])
  })

  it('filters by status', async () => {
    const s1 = await createSale(header(), [item()], db)
    await confirmSale(s1.id, db)
    await createSale(header(), [item()], db) // draft
    const confirmed = await searchSales({ status: 'confirmed' }, db)
    expect(confirmed).toHaveLength(1)
    expect(confirmed[0].status).toBe('confirmed')
  })

  it('filters by paymentStatus', async () => {
    const s = await createSale(header(), [item({ unitPrice: 100 })], db)
    await confirmSale(s.id, db)
    await addPayment(s.id, paymentData(100), db)
    const paid = await searchSales({ paymentStatus: 'paid' }, db)
    expect(paid.length).toBeGreaterThanOrEqual(1)
    expect(paid[0].paymentStatus).toBe('paid')
  })

  it('filters by query matching invoiceNumber', async () => {
    const s = await createSale(header(), [item()], db)
    const result = await searchSales({ query: s.saleNumber }, db)
    expect(result).toHaveLength(1)
  })

  it('filters by date range', async () => {
    await createSale(header({ saleDate: '2024-01-10' }), [item()], db)
    await createSale(header({ saleDate: '2024-03-10' }), [item()], db)
    const result = await searchSales({ fromDate: '2024-02-01', toDate: '2024-12-31' }, db)
    expect(result).toHaveLength(1)
    expect(result[0].saleDate).toBe('2024-03-10')
  })
})

// ── 9. Dashboard stats ────────────────────────────────────────────────────────

describe('getSalesDashboardStats', () => {
  it('returns zero stats for empty DB', async () => {
    const stats = await getSalesDashboardStats(db)
    expect(stats.totalInvoices).toBe(0)
    expect(stats.todaySales).toBe(0)
    expect(stats.totalCollected).toBe(0)
  })

  it('counts today sales correctly', async () => {
    await createSale(header({ saleDate: today() }), [item({ unitPrice: 100 })], db)
    await createSale(header({ saleDate: today() }), [item({ unitPrice: 50 })], db)
    const stats = await getSalesDashboardStats(db)
    expect(stats.todaySales).toBe(2)
    expect(stats.todayRevenue).toBe(150)
  })

  it('excludes cancelled sales from stats', async () => {
    const s = await createSale(header(), [item({ unitPrice: 100 })], db)
    await cancelSale(s.id, db)
    const stats = await getSalesDashboardStats(db)
    expect(stats.totalInvoices).toBe(0) // excluded
  })

  it('counts returns', async () => {
    const frame = await mkFrame(5, 100)
    const sale = await createSale(
      header(),
      [item({ itemType: 'frame', itemId: frame.id, description: 'Frame', quantity: 2, unitPrice: 100 })],
      db
    )
    await confirmSale(sale.id, db)
    const items = await getSaleItems(sale.id, db)
    await processReturn(sale.id, [{ saleItemId: items[0].id, quantity: 1, restockItem: false }], today(), undefined, undefined, db)
    const stats = await getSalesDashboardStats(db)
    expect(stats.totalReturns).toBe(1)
  })
})

// ── 10. Audit-fix: getPayments returns voided payments ────────────────────────

describe('getPayments (audit: includes voided)', () => {
  it('includes voided payments in result', async () => {
    const sale = await createSale(header(), [item({ unitPrice: 200 })], db)
    await confirmSale(sale.id, db)
    const p = await addPayment(sale.id, paymentData(100), db)
    await deletePayment(p.id, db)
    const payments = await getPayments(sale.id, db)
    expect(payments).toHaveLength(1)
    expect(payments[0].deletedAt).toBeDefined()
    expect(payments[0].amount).toBe(100)
  })

  it('sorts payments by paidAt ascending', async () => {
    const sale = await createSale(header(), [item({ unitPrice: 300 })], db)
    await confirmSale(sale.id, db)
    await addPayment(sale.id, paymentData(100, { paidAt: '2024-01-10' }), db)
    await addPayment(sale.id, paymentData(100, { paidAt: '2024-01-05' }), db)
    const payments = await getPayments(sale.id, db)
    expect(payments[0].paidAt).toBe('2024-01-05')
    expect(payments[1].paidAt).toBe('2024-01-10')
  })
})

// ── 11. Audit-fix: cancelSale restores net qty only ───────────────────────────

describe('cancelSale (audit: net qty after partial return)', () => {
  it('restores only unreturned qty when partial return preceded cancel', async () => {
    const frame = await mkFrame(10, 100)
    const sale = await createSale(
      header(),
      [item({ itemType: 'frame', itemId: frame.id, description: 'Frame', quantity: 3, unitPrice: 100 })],
      db
    )
    await confirmSale(sale.id, db)

    const beforeReturn = await db.frames.get(frame.id)
    expect(beforeReturn!.quantity).toBe(7) // 10 - 3 sold

    const saleItems = await getSaleItems(sale.id, db)
    // Return 1 of the 3 → restock 1
    await processReturn(sale.id, [{ saleItemId: saleItems[0].id, quantity: 1, restockItem: true }], today(), undefined, undefined, db)

    const afterReturn = await db.frames.get(frame.id)
    expect(afterReturn!.quantity).toBe(8) // 7 + 1 restocked

    // Cancel: should restore only the remaining 2 (not 3)
    await cancelSale(sale.id, db)
    const afterCancel = await db.frames.get(frame.id)
    expect(afterCancel!.quantity).toBe(10) // 8 + 2 = 10 (back to full)
  })

  it('skips items fully returned before cancel', async () => {
    const frame = await mkFrame(5, 100)
    const sale = await createSale(
      header(),
      [item({ itemType: 'frame', itemId: frame.id, description: 'Frame', quantity: 2, unitPrice: 100 })],
      db
    )
    await confirmSale(sale.id, db)
    const saleItems = await getSaleItems(sale.id, db)
    // Return all 2
    await processReturn(sale.id, [{ saleItemId: saleItems[0].id, quantity: 2, restockItem: true }], today(), undefined, undefined, db)
    const afterReturn = await db.frames.get(frame.id)
    expect(afterReturn!.quantity).toBe(5) // fully restocked

    // Cancel: netQty = 0, nothing to restore
    await cancelSale(sale.id, db)
    const afterCancel = await db.frames.get(frame.id)
    expect(afterCancel!.quantity).toBe(5) // unchanged
  })
})

// ── 12. Audit-fix: getSalesReport includes returnedAmount & netRevenue ─────────

import { getSalesReport } from '../src/modules/sales/SalesRepository'

describe('getSalesReport (audit: net revenue)', () => {
  it('shows returnedAmount and netRevenue per sale', async () => {
    const frame = await mkFrame(5, 100)
    const sale = await createSale(
      header(),
      [item({ itemType: 'frame', itemId: frame.id, description: 'Frame', quantity: 2, unitPrice: 100 })],
      db
    )
    await confirmSale(sale.id, db)
    const saleItems = await getSaleItems(sale.id, db)
    await processReturn(sale.id, [{ saleItemId: saleItems[0].id, quantity: 1, restockItem: false }], today(), undefined, undefined, db)

    const rows = await getSalesReport({}, db)
    const row = rows.find(r => r.saleId === sale.id)!
    expect(row.total).toBe(200)
    expect(row.returnedAmount).toBe(100) // 1 × 100
    expect(row.netRevenue).toBe(100)     // 200 - 100
  })

  it('reports zero returnedAmount when no returns exist', async () => {
    await createSale(header(), [item({ unitPrice: 150 })], db)
    const rows = await getSalesReport({}, db)
    expect(rows[0].returnedAmount).toBe(0)
    expect(rows[0].netRevenue).toBe(150)
  })
})
