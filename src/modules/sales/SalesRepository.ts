import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { Sale, SaleItem, InventoryMovement, PaymentStatus } from '../../database/schema'
import type { SaleFormValues, SaleItemFormValues } from './sales.schema'

// ── Utility ───────────────────────────────────────────────────────────────────

function r2(n: number): number { return Math.round(n * 100) / 100 }

function derivePaymentStatus(paidAmount: number, total: number): PaymentStatus {
  if (paidAmount <= 0) return 'unpaid'
  if (paidAmount >= total) return 'paid'
  return 'partial'
}

function computeTotals(
  items: Array<{ quantity: number; unitPrice: number; discountAmount: number }>,
  orderDiscount: number,
  discountPercent: number,
): { subtotal: number; discountAmount: number; total: number } {
  const itemsSubtotal = r2(items.reduce((s, i) =>
    s + r2(i.quantity * i.unitPrice - i.discountAmount), 0))
  const pctDiscount = r2(itemsSubtotal * (discountPercent / 100))
  const totalDiscount = r2(orderDiscount + pctDiscount)
  const total = r2(Math.max(0, itemsSubtotal - totalDiscount))
  return { subtotal: itemsSubtotal, discountAmount: totalDiscount, total }
}

// ── Sequence ──────────────────────────────────────────────────────────────────

export async function getNextSaleNumber(db: BarOptDB = globalDb): Promise<string> {
  return db.transaction('rw', [db.settings], async () => {
    const key = 'sale_sequence'
    const setting = await db.settings.where('key').equals(key).first()
    const seq = setting ? (JSON.parse(setting.value) as number) + 1 : 1
    const now = new Date().toISOString()
    if (setting) {
      await db.settings.update(setting.id, { value: JSON.stringify(seq), updatedAt: now })
    } else {
      await db.settings.add({ id: uuidv4(), key, value: JSON.stringify(seq), createdAt: now, updatedAt: now })
    }
    return `INV-${String(seq).padStart(6, '0')}`
  })
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createSale(
  header: SaleFormValues,
  items: SaleItemFormValues[],
  db: BarOptDB = globalDb,
): Promise<Sale> {
  const saleNumber = await getNextSaleNumber(db)
  const totals = computeTotals(items, header.discountAmount ?? 0, header.discountPercent ?? 0)
  const now = new Date().toISOString()

  return db.transaction('rw', [db.sales, db.saleItems, db.frames, db.lenses], async () => {
    const sale: Sale = {
      id: uuidv4(),
      saleNumber,
      patientId: header.patientId || undefined,
      walkInName: header.walkInName || undefined,
      prescriptionId: header.prescriptionId || undefined,
      status: 'draft',
      saleDate: header.saleDate,
      readyDate: header.readyDate || undefined,
      labNotes: header.labNotes || undefined,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      discountPercent: header.discountPercent ?? 0,
      taxAmount: 0,
      total: totals.total,
      paidAmount: 0,
      balanceDue: totals.total,
      paymentStatus: 'unpaid',
      notes: header.notes || undefined,
      createdAt: now,
      updatedAt: now,
    }
    await db.sales.add(sale)

    for (const item of items) {
      const product = item.itemId
        ? (item.itemType === 'frame' ? await db.frames.get(item.itemId) : await db.lenses.get(item.itemId))
        : undefined
      const saleItem: SaleItem = {
        id: uuidv4(),
        saleId: sale.id,
        itemType: item.itemType,
        itemId: item.itemId || undefined,
        description: item.description,
        sku: product?.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        total: r2(item.quantity * item.unitPrice - item.discountAmount),
        returnedQty: 0,
        createdAt: now,
        updatedAt: now,
      }
      await db.saleItems.add(saleItem)
    }
    return sale
  })
}

// ── Update draft ──────────────────────────────────────────────────────────────

export async function updateSaleDraft(
  saleId: string,
  header: SaleFormValues,
  items: SaleItemFormValues[],
  db: BarOptDB = globalDb,
): Promise<Sale> {
  const existing = await db.sales.get(saleId)
  if (!existing) throw new Error('Sale not found')
  if (existing.status !== 'draft') throw new Error('Only draft sales can be edited')

  const totals = computeTotals(items, header.discountAmount ?? 0, header.discountPercent ?? 0)
  const now = new Date().toISOString()

  return db.transaction('rw', [db.sales, db.saleItems, db.frames, db.lenses], async () => {
    // Replace all items
    await db.saleItems.where('saleId').equals(saleId).delete()

    for (const item of items) {
      const product = item.itemId
        ? (item.itemType === 'frame' ? await db.frames.get(item.itemId) : await db.lenses.get(item.itemId))
        : undefined
      const saleItem: SaleItem = {
        id: uuidv4(),
        saleId,
        itemType: item.itemType,
        itemId: item.itemId || undefined,
        description: item.description,
        sku: product?.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        total: r2(item.quantity * item.unitPrice - item.discountAmount),
        returnedQty: 0,
        createdAt: now,
        updatedAt: now,
      }
      await db.saleItems.add(saleItem)
    }

    const patch: Partial<Sale> = {
      patientId: header.patientId || undefined,
      walkInName: header.walkInName || undefined,
      prescriptionId: header.prescriptionId || undefined,
      saleDate: header.saleDate,
      readyDate: header.readyDate || undefined,
      labNotes: header.labNotes || undefined,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      discountPercent: header.discountPercent ?? 0,
      total: totals.total,
      balanceDue: r2(totals.total - existing.paidAmount),
      paymentStatus: derivePaymentStatus(existing.paidAmount, totals.total),
      notes: header.notes || undefined,
      updatedAt: now,
    }
    await db.sales.update(saleId, patch)
    const updated = await db.sales.get(saleId)
    return updated!
  })
}

// ── Confirm sale (deducts inventory) ─────────────────────────────────────────

export async function confirmSale(saleId: string, db: BarOptDB = globalDb): Promise<void> {
  const sale = await db.sales.get(saleId)
  if (!sale) throw new Error('Sale not found')
  if (sale.status !== 'draft') throw new Error('Only draft sales can be confirmed')

  const items = await db.saleItems.where('saleId').equals(saleId).toArray()
  if (items.length === 0) throw new Error('Cannot confirm a sale with no items')

  await db.transaction('rw', [db.sales, db.saleItems, db.inventoryMovements, db.frames, db.lenses], async () => {
    const now = new Date().toISOString()

    for (const item of items) {
      if (item.itemType === 'service' || !item.itemId) continue

      const product = item.itemType === 'frame'
        ? await db.frames.get(item.itemId)
        : await db.lenses.get(item.itemId)
      if (!product) throw new Error(`Product not found: ${item.description}`)

      const qtyBefore = product.quantity ?? 0
      if (item.quantity > qtyBefore) {
        throw new Error(
          `Insufficient stock for "${item.description}" — available: ${qtyBefore}, requested: ${item.quantity}`
        )
      }
      const qtyAfter = qtyBefore - item.quantity

      const movement: InventoryMovement = {
        id: uuidv4(),
        itemType: item.itemType,
        itemId: item.itemId,
        movementType: 'stock_out',
        quantity: -item.quantity,
        quantityBefore: qtyBefore,
        quantityAfter: qtyAfter,
        movementDate: sale.saleDate,
        reason: `Sale ${sale.saleNumber}`,
        referenceType: 'sale',
        referenceId: saleId,
        referenceNumber: sale.saleNumber,
        createdAt: now,
        updatedAt: now,
      }
      await db.inventoryMovements.add(movement)

      if (item.itemType === 'frame') {
        await db.frames.update(item.itemId, { quantity: qtyAfter, updatedAt: now })
      } else {
        await db.lenses.update(item.itemId, { quantity: qtyAfter, updatedAt: now })
      }
    }

    await db.sales.update(saleId, { status: 'confirmed', updatedAt: now })
  })
}

// ── Cancel sale (restores inventory if confirmed) ─────────────────────────────

export async function cancelSale(saleId: string, db: BarOptDB = globalDb): Promise<void> {
  const sale = await db.sales.get(saleId)
  if (!sale) throw new Error('Sale not found')
  if (sale.status === 'cancelled') throw new Error('Sale is already cancelled')

  await db.transaction('rw', [db.sales, db.saleItems, db.inventoryMovements, db.frames, db.lenses], async () => {
    const now = new Date().toISOString()

    // Only restore inventory if the sale was confirmed (stock was deducted)
    if (sale.status !== 'draft') {
      const items = await db.saleItems.where('saleId').equals(saleId).toArray()
      for (const item of items) {
        if (item.itemType === 'service' || !item.itemId) continue

        const product = item.itemType === 'frame'
          ? await db.frames.get(item.itemId)
          : await db.lenses.get(item.itemId)
        if (!product) continue

        const qtyBefore = product.quantity ?? 0
        // Only restore net quantity still held by the customer (total sold minus already returned)
        const netQty = item.quantity - item.returnedQty
        if (netQty <= 0) continue
        const qtyAfter = qtyBefore + netQty

        const movement: InventoryMovement = {
          id: uuidv4(),
          itemType: item.itemType,
          itemId: item.itemId,
          movementType: 'adjustment_in',
          quantity: netQty,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
          movementDate: now,
          reason: `Cancelled sale ${sale.saleNumber}`,
          referenceType: 'sale_cancel',
          referenceId: saleId,
          referenceNumber: sale.saleNumber,
          createdAt: now,
          updatedAt: now,
        }
        await db.inventoryMovements.add(movement)

        if (item.itemType === 'frame') {
          await db.frames.update(item.itemId, { quantity: qtyAfter, updatedAt: now })
        } else {
          await db.lenses.update(item.itemId, { quantity: qtyAfter, updatedAt: now })
        }
      }
    }

    await db.sales.update(saleId, { status: 'cancelled', updatedAt: now })
  })
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getSaleById(id: string, db: BarOptDB = globalDb): Promise<Sale | undefined> {
  return db.sales.get(id)
}

export async function getSaleItems(saleId: string, db: BarOptDB = globalDb): Promise<SaleItem[]> {
  return db.saleItems.where('saleId').equals(saleId).toArray()
}

export interface SaleFilters {
  patientId?: string
  status?: string
  paymentStatus?: string
  query?: string
  fromDate?: string
  toDate?: string
}

export async function searchSales(
  filters: SaleFilters = {},
  db: BarOptDB = globalDb,
): Promise<Sale[]> {
  let all = await db.sales.filter(s => !s.deletedAt).toArray()

  if (filters.patientId) all = all.filter(s => s.patientId === filters.patientId)
  if (filters.status) all = all.filter(s => s.status === filters.status)
  if (filters.paymentStatus) all = all.filter(s => s.paymentStatus === filters.paymentStatus)
  if (filters.fromDate) all = all.filter(s => s.saleDate >= filters.fromDate!)
  if (filters.toDate) all = all.filter(s => s.saleDate <= filters.toDate!)
  if (filters.query) {
    const q = filters.query.toLowerCase()
    all = all.filter(s =>
      s.saleNumber.toLowerCase().includes(q) ||
      (s.walkInName ?? '').toLowerCase().includes(q)
    )
  }
  return all.sort((a, b) => b.saleDate.localeCompare(a.saleDate))
}

// ── Stats / Dashboard ─────────────────────────────────────────────────────────

export interface SalesDashboardStats {
  todaySales: number
  todayRevenue: number
  monthSales: number
  monthRevenue: number
  totalCollected: number
  totalOutstanding: number
  totalRefundsIssued: number  // sum of all SaleReturn.totalRefund
  totalInvoices: number
  totalReturns: number
}

export async function getSalesDashboardStats(db: BarOptDB = globalDb): Promise<SalesDashboardStats> {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  const all = await db.sales.filter(s => !s.deletedAt && s.status !== 'cancelled').toArray()

  const todaySales = all.filter(s => s.saleDate === today)
  const monthSales = all.filter(s => s.saleDate >= monthStart && s.saleDate <= today)

  const totalCollected = r2(all.reduce((sum, s) => sum + (s.paidAmount ?? 0), 0))
  const totalOutstanding = r2(all.reduce((sum, s) => sum + (s.balanceDue ?? 0), 0))

  const returns = await db.saleReturns.toArray()
  const totalRefundsIssued = r2(returns.reduce((sum, r) => sum + r.totalRefund, 0))

  return {
    todaySales: todaySales.length,
    todayRevenue: r2(todaySales.reduce((s, x) => s + x.total, 0)),
    monthSales: monthSales.length,
    monthRevenue: r2(monthSales.reduce((s, x) => s + x.total, 0)),
    totalCollected,
    totalOutstanding,
    totalRefundsIssued,
    totalInvoices: all.length,
    totalReturns: returns.length,
  }
}

export interface SalesReportRow {
  saleId: string
  saleNumber: string
  saleDate: string
  patientId?: string
  walkInName?: string
  status: string
  total: number
  returnedAmount: number  // sum of SaleReturn.totalRefund for this sale
  netRevenue: number      // total - returnedAmount
  paidAmount: number
  balanceDue: number
  paymentStatus: string
}

export async function getSalesReport(
  filters: SaleFilters = {},
  db: BarOptDB = globalDb,
): Promise<SalesReportRow[]> {
  const sales = await searchSales(filters, db)

  // Batch-load returns for all sales in result set
  const saleIds = new Set(sales.map(s => s.id))
  const allReturns = await db.saleReturns.toArray()
  const returnsBySale = new Map<string, number>()
  for (const ret of allReturns) {
    if (saleIds.has(ret.saleId)) {
      returnsBySale.set(ret.saleId, r2((returnsBySale.get(ret.saleId) ?? 0) + ret.totalRefund))
    }
  }

  return sales.map(s => {
    const returnedAmount = returnsBySale.get(s.id) ?? 0
    return {
      saleId: s.id,
      saleNumber: s.saleNumber,
      saleDate: s.saleDate,
      patientId: s.patientId,
      walkInName: s.walkInName,
      status: s.status,
      total: s.total,
      returnedAmount,
      netRevenue: r2(s.total - returnedAmount),
      paidAmount: s.paidAmount,
      balanceDue: s.balanceDue,
      paymentStatus: s.paymentStatus,
    }
  })
}

// ── Phase 09: Order status transitions ───────────────────────────────────────

export async function markSaleReady(
  saleId: string,
  readyDate?: string,
  db: BarOptDB = globalDb,
): Promise<void> {
  const sale = await db.sales.get(saleId)
  if (!sale) throw new Error('Sale not found')
  if (sale.status !== 'confirmed') throw new Error('Only confirmed sales can be marked as ready')
  const now = new Date().toISOString()
  await db.sales.update(saleId, {
    status: 'ready',
    readyDate: readyDate || sale.readyDate || now.slice(0, 10),
    updatedAt: now,
  })
}

export async function markSaleDelivered(
  saleId: string,
  db: BarOptDB = globalDb,
): Promise<void> {
  const sale = await db.sales.get(saleId)
  if (!sale) throw new Error('Sale not found')
  if (sale.status !== 'ready') throw new Error('Only ready orders can be marked as delivered')
  const now = new Date().toISOString()
  await db.sales.update(saleId, {
    status: 'delivered',
    deliveryDate: now.slice(0, 10),
    updatedAt: now,
  })
}

export async function getPendingOrders(db: BarOptDB = globalDb): Promise<Sale[]> {
  const all = await db.sales
    .filter(s => !s.deletedAt && (s.status === 'confirmed' || s.status === 'ready'))
    .toArray()
  return all.sort((a, b) => {
    // Sort: orders with readyDate first (soonest first), then orders without
    if (a.readyDate && b.readyDate) return a.readyDate.localeCompare(b.readyDate)
    if (a.readyDate) return -1
    if (b.readyDate) return 1
    return b.createdAt.localeCompare(a.createdAt)
  })
}
