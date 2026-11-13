import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { Purchase, PurchaseItem } from '../../database/schema'
import type { PurchaseFormValues, PurchaseItemFormValues } from './purchases.schema'

// ── Utility ───────────────────────────────────────────────────────────────────

function r2(n: number): number { return Math.round(n * 100) / 100 }

export interface PurchaseTotals {
  itemsSubtotal: number
  subtotal: number
  total: number
}

export function calculateTotals(
  items: Array<{ orderedQty: number; unitCost: number; discountAmount: number; taxAmount: number }>,
  orderDiscount: number,
  orderTax: number,
): PurchaseTotals {
  const itemsSubtotal = r2(items.reduce((s, i) => s + r2(i.orderedQty * i.unitCost - i.discountAmount + i.taxAmount), 0))
  const subtotal = itemsSubtotal
  const total = r2(subtotal - orderDiscount + orderTax)
  return { itemsSubtotal, subtotal, total }
}

// ── Sequence ──────────────────────────────────────────────────────────────────

export async function getNextPurchaseNumber(db: BarOptDB = globalDb): Promise<string> {
  return db.transaction('rw', [db.settings], async () => {
    const key = 'purchase_sequence'
    const setting = await db.settings.where('key').equals(key).first()
    const seq = setting ? (JSON.parse(setting.value) as number) + 1 : 1
    const now = new Date().toISOString()
    if (setting) {
      await db.settings.update(setting.id, { value: JSON.stringify(seq), updatedAt: now })
    } else {
      await db.settings.add({ id: uuidv4(), key, value: JSON.stringify(seq), createdAt: now, updatedAt: now })
    }
    return `PO-${String(seq).padStart(6, '0')}`
  })
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createPurchase(
  header: PurchaseFormValues,
  items: PurchaseItemFormValues[],
  db: BarOptDB = globalDb,
): Promise<Purchase> {
  const purchaseNumber = await getNextPurchaseNumber(db)
  const totals = calculateTotals(items, header.discountAmount ?? 0, header.taxAmount ?? 0)
  const now = new Date().toISOString()

  return db.transaction('rw', [db.purchases, db.purchaseItems, db.frames, db.lenses], async () => {
    const purchase: Purchase = {
      id: uuidv4(),
      purchaseNumber,
      supplierId: header.supplierId,
      status: 'draft',
      purchaseDate: header.purchaseDate,
      expectedDeliveryDate: header.expectedDeliveryDate || undefined,
      invoiceNumber: header.invoiceNumber || undefined,
      notes: header.notes || undefined,
      subtotal: totals.subtotal,
      discountAmount: header.discountAmount ?? 0,
      taxAmount: header.taxAmount ?? 0,
      total: totals.total,
      paidAmount: 0,
      balanceDue: totals.total,
      createdAt: now,
      updatedAt: now,
    }
    await db.purchases.add(purchase)

    for (const item of items) {
      const product = item.productType === 'frame'
        ? await db.frames.get(item.productId)
        : await db.lenses.get(item.productId)
      const description = product
        ? `${product.brand}${(product as { model?: string }).model ? ' ' + (product as { model?: string }).model : ''} (${product.sku})`
        : item.productId
      const lineTotal = r2(item.orderedQty * item.unitCost - item.discountAmount + item.taxAmount)
      const pi: PurchaseItem = {
        id: uuidv4(),
        purchaseId: purchase.id,
        productType: item.productType,
        productId: item.productId,
        description,
        sku: product?.sku ?? '',
        orderedQty: item.orderedQty,
        receivedQty: 0,
        unitCost: item.unitCost,
        discountAmount: item.discountAmount,
        taxAmount: item.taxAmount,
        lineTotal,
        createdAt: now,
        updatedAt: now,
      }
      await db.purchaseItems.add(pi)
    }
    return purchase
  })
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getPurchaseById(id: string, db: BarOptDB = globalDb): Promise<Purchase | undefined> {
  return db.purchases.get(id)
}

export async function getPurchaseItems(purchaseId: string, db: BarOptDB = globalDb): Promise<PurchaseItem[]> {
  return db.purchaseItems.where('purchaseId').equals(purchaseId).toArray()
}

export interface PurchaseFilters {
  supplierId?: string
  status?: string
  query?: string
  fromDate?: string
  toDate?: string
}

export async function searchPurchases(
  filters: PurchaseFilters = {},
  db: BarOptDB = globalDb,
): Promise<Purchase[]> {
  let all = await db.purchases.filter(p => !p.deletedAt).toArray()

  if (filters.supplierId) all = all.filter(p => p.supplierId === filters.supplierId)
  if (filters.status) all = all.filter(p => p.status === filters.status)
  if (filters.fromDate) all = all.filter(p => (p.purchaseDate ?? p.createdAt) >= filters.fromDate!)
  if (filters.toDate) all = all.filter(p => (p.purchaseDate ?? p.createdAt) <= filters.toDate!)
  if (filters.query) {
    const q = filters.query.toLowerCase()
    all = all.filter(p =>
      p.purchaseNumber.toLowerCase().includes(q) ||
      (p.invoiceNumber ?? '').toLowerCase().includes(q)
    )
  }
  return all.sort((a, b) => (b.purchaseDate ?? b.createdAt).localeCompare(a.purchaseDate ?? a.createdAt))
}

export async function getPurchasesBySupplier(supplierId: string, db: BarOptDB = globalDb): Promise<Purchase[]> {
  return searchPurchases({ supplierId }, db)
}

// ── Draft item management ─────────────────────────────────────────────────────

export async function addItemToDraft(
  purchaseId: string,
  item: PurchaseItemFormValues,
  db: BarOptDB = globalDb,
): Promise<PurchaseItem> {
  const purchase = await db.purchases.get(purchaseId)
  if (!purchase) throw new Error('Purchase not found')
  if (purchase.status !== 'draft') throw new Error('Can only add items to a draft purchase')

  const product = item.productType === 'frame'
    ? await db.frames.get(item.productId)
    : await db.lenses.get(item.productId)
  const description = product
    ? `${product.brand}${(product as { model?: string }).model ? ' ' + (product as { model?: string }).model : ''} (${product.sku})`
    : item.productId
  const lineTotal = r2(item.orderedQty * item.unitCost - item.discountAmount + item.taxAmount)
  const now = new Date().toISOString()

  const pi: PurchaseItem = {
    id: uuidv4(),
    purchaseId,
    productType: item.productType,
    productId: item.productId,
    description,
    sku: product?.sku ?? '',
    orderedQty: item.orderedQty,
    receivedQty: 0,
    unitCost: item.unitCost,
    discountAmount: item.discountAmount,
    taxAmount: item.taxAmount,
    lineTotal,
    createdAt: now,
    updatedAt: now,
  }
  await db.purchaseItems.add(pi)
  await recalcPurchaseTotals(purchaseId, db)
  return pi
}

export async function removeItemFromDraft(itemId: string, db: BarOptDB = globalDb): Promise<void> {
  const item = await db.purchaseItems.get(itemId)
  if (!item) throw new Error('Item not found')
  const purchase = await db.purchases.get(item.purchaseId)
  if (purchase?.status !== 'draft') throw new Error('Can only remove items from a draft purchase')
  await db.purchaseItems.delete(itemId)
  await recalcPurchaseTotals(item.purchaseId, db)
}

// ── Recalculate purchase totals ───────────────────────────────────────────────

export async function recalcPurchaseTotals(purchaseId: string, db: BarOptDB = globalDb): Promise<void> {
  const [purchase, items] = await Promise.all([
    db.purchases.get(purchaseId),
    db.purchaseItems.where('purchaseId').equals(purchaseId).toArray(),
  ])
  if (!purchase) return
  const itemsSubtotal = r2(items.reduce((s, i) => s + i.lineTotal, 0))
  const total = r2(itemsSubtotal - purchase.discountAmount + purchase.taxAmount)
  await db.purchases.update(purchaseId, {
    subtotal: itemsSubtotal,
    total,
    balanceDue: r2(total - purchase.paidAmount),
    updatedAt: new Date().toISOString(),
  })
}
