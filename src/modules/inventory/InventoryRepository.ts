import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { InventoryMovement, StocktakingSession, StocktakingItem } from '../../database/schema'
import type { MovementFormValues, StocktakingSessionValues } from './inventory.schema'

// ── Stock Balance ──────────────────────────────────────────────────────────────

export async function getCurrentStock(
  productType: 'frame' | 'lens',
  productId: string,
  db: BarOptDB = globalDb,
): Promise<number> {
  const product = productType === 'frame'
    ? await db.frames.get(productId)
    : await db.lenses.get(productId)
  return product?.quantity ?? 0
}

export async function getStockFromMovements(
  productType: 'frame' | 'lens',
  productId: string,
  db: BarOptDB = globalDb,
): Promise<number> {
  const movements = await db.inventoryMovements
    .where('[itemType+itemId]').equals([productType, productId])
    .toArray()
  return movements.reduce((sum, m) => sum + m.quantity, 0)
}

// ── Movement CRUD ──────────────────────────────────────────────────────────────

const IN_TYPES = new Set(['opening', 'stock_in', 'adjustment_in', 'returned'])

export async function createMovement(
  data: MovementFormValues,
  db: BarOptDB = globalDb,
): Promise<InventoryMovement> {
  const product = data.productType === 'frame'
    ? await db.frames.get(data.productId)
    : await db.lenses.get(data.productId)

  if (!product) throw new Error('Product not found')
  if (product.deletedAt) throw new Error('Cannot add movement to archived product')

  const isIn = IN_TYPES.has(data.movementType)
  const signedQty = isIn ? data.quantity : -data.quantity
  const quantityBefore = product.quantity ?? 0
  const quantityAfter = quantityBefore + signedQty

  if (quantityAfter < 0) {
    throw new Error(`Insufficient stock. Current: ${quantityBefore}, Requested: ${data.quantity}`)
  }

  const now = new Date().toISOString()

  return db.transaction('rw', [db.inventoryMovements, db.frames, db.lenses], async () => {
    const movement: InventoryMovement = {
      id: uuidv4(),
      itemType: data.productType,
      itemId: data.productId,
      movementType: data.movementType,
      quantity: signedQty,
      quantityBefore,
      quantityAfter,
      movementDate: data.movementDate,
      reason: data.reason || undefined,
      referenceNumber: data.referenceNumber || undefined,
      notes: data.notes || undefined,
      createdAt: now,
      updatedAt: now,
    }
    await db.inventoryMovements.add(movement)
    if (data.productType === 'frame') {
      await db.frames.update(data.productId, { quantity: quantityAfter, updatedAt: now })
    } else {
      await db.lenses.update(data.productId, { quantity: quantityAfter, updatedAt: now })
    }
    return movement
  })
}

export interface MovementFilters {
  productType?: 'frame' | 'lens'
  productId?: string
  movementType?: string
  fromDate?: string
  toDate?: string
  limit?: number
}

export async function getMovements(
  filters: MovementFilters = {},
  db: BarOptDB = globalDb,
): Promise<InventoryMovement[]> {
  let all: InventoryMovement[]

  if (filters.productId && filters.productType) {
    all = await db.inventoryMovements
      .where('[itemType+itemId]').equals([filters.productType, filters.productId])
      .toArray()
  } else if (filters.productType) {
    all = await db.inventoryMovements
      .where('itemType').equals(filters.productType)
      .toArray()
  } else {
    all = await db.inventoryMovements.toArray()
  }

  if (filters.movementType) all = all.filter(m => m.movementType === filters.movementType)
  if (filters.fromDate) all = all.filter(m => (m.movementDate ?? m.createdAt) >= filters.fromDate!)
  if (filters.toDate) all = all.filter(m => (m.movementDate ?? m.createdAt) <= filters.toDate!)

  all.sort((a, b) => {
    const dA = a.movementDate ?? a.createdAt
    const dB = b.movementDate ?? b.createdAt
    return dB.localeCompare(dA) || b.createdAt.localeCompare(a.createdAt)
  })

  if (filters.limit) all = all.slice(0, filters.limit)
  return all
}

// ── Stock List ─────────────────────────────────────────────────────────────────

export interface ProductStock {
  id: string
  productType: 'frame' | 'lens'
  sku: string
  name: string
  brand: string
  quantity: number
  reorderPoint: number
  costPrice?: number
  sellingPrice?: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
}

function stockStatus(qty: number, rp: number): ProductStock['status'] {
  if (qty <= 0) return 'out_of_stock'
  if (rp > 0 && qty <= rp) return 'low_stock'
  return 'in_stock'
}

export async function getStockList(
  filters: { productType?: 'frame' | 'lens'; query?: string; status?: string } = {},
  db: BarOptDB = globalDb,
): Promise<ProductStock[]> {
  const results: ProductStock[] = []

  if (!filters.productType || filters.productType === 'frame') {
    const frames = await db.frames.filter(f => !f.deletedAt).toArray()
    for (const f of frames) {
      const qty = f.quantity ?? 0
      const rp = f.reorderPoint ?? 0
      results.push({ id: f.id, productType: 'frame', sku: f.sku, name: f.name ?? f.brand, brand: f.brand, quantity: qty, reorderPoint: rp, costPrice: f.costPrice, sellingPrice: f.sellingPrice, status: stockStatus(qty, rp) })
    }
  }

  if (!filters.productType || filters.productType === 'lens') {
    const lenses = await db.lenses.filter(l => !l.deletedAt).toArray()
    for (const l of lenses) {
      const qty = l.quantity ?? 0
      const rp = l.reorderPoint ?? 0
      results.push({ id: l.id, productType: 'lens', sku: l.sku, name: l.name ?? l.brand, brand: l.brand, quantity: qty, reorderPoint: rp, costPrice: l.costPrice, sellingPrice: l.sellingPrice, status: stockStatus(qty, rp) })
    }
  }

  let list = results
  if (filters.query) {
    const q = filters.query.toLowerCase()
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
  }
  if (filters.status === 'low_stock') list = list.filter(p => p.status === 'low_stock')
  else if (filters.status === 'out_of_stock') list = list.filter(p => p.status === 'out_of_stock')
  else if (filters.status === 'in_stock') list = list.filter(p => p.status === 'in_stock')

  return list.sort((a, b) => a.name.localeCompare(b.name))
}

export async function getLowStockProducts(db: BarOptDB = globalDb): Promise<ProductStock[]> {
  const all = await getStockList({}, db)
  return all.filter(p => p.status === 'low_stock' || p.status === 'out_of_stock')
}

// ── Pricing & Reorder Point ────────────────────────────────────────────────────

export async function updateProductPricing(
  productType: 'frame' | 'lens',
  productId: string,
  data: { reorderPoint?: number; costPrice?: number; sellingPrice?: number },
  db: BarOptDB = globalDb,
): Promise<void> {
  const now = new Date().toISOString()
  if (productType === 'frame') {
    await db.frames.update(productId, { ...data, updatedAt: now })
  } else {
    await db.lenses.update(productId, { ...data, updatedAt: now })
  }
}

// ── Dashboard Stats ────────────────────────────────────────────────────────────

export interface InventoryStats {
  totalFrameProducts: number
  totalLensProducts: number
  totalFrameUnits: number
  totalLensUnits: number
  lowStockCount: number
  outOfStockCount: number
  recentMovements: InventoryMovement[]
}

export async function getInventoryStats(db: BarOptDB = globalDb): Promise<InventoryStats> {
  const [frames, lenses, recentMovements] = await Promise.all([
    db.frames.filter(f => !f.deletedAt).toArray(),
    db.lenses.filter(l => !l.deletedAt).toArray(),
    getMovements({ limit: 10 }, db),
  ])
  const all = [
    ...frames.map(f => ({ qty: f.quantity ?? 0, rp: f.reorderPoint ?? 0 })),
    ...lenses.map(l => ({ qty: l.quantity ?? 0, rp: l.reorderPoint ?? 0 })),
  ]
  return {
    totalFrameProducts: frames.length,
    totalLensProducts: lenses.length,
    totalFrameUnits: frames.reduce((s, f) => s + (f.quantity ?? 0), 0),
    totalLensUnits: lenses.reduce((s, l) => s + (l.quantity ?? 0), 0),
    lowStockCount: all.filter(p => p.qty > 0 && p.rp > 0 && p.qty <= p.rp).length,
    outOfStockCount: all.filter(p => p.qty <= 0).length,
    recentMovements,
  }
}

// ── Stocktaking Session Numbering ──────────────────────────────────────────────

export async function getNextSessionNumber(db: BarOptDB = globalDb): Promise<string> {
  return db.transaction('rw', [db.settings], async () => {
    const key = 'stocktaking_sequence'
    const setting = await db.settings.where('key').equals(key).first()
    const seq = setting ? (JSON.parse(setting.value) as number) + 1 : 1
    const now = new Date().toISOString()
    if (setting) {
      await db.settings.update(setting.id, { value: JSON.stringify(seq), updatedAt: now })
    } else {
      await db.settings.add({ id: uuidv4(), key, value: JSON.stringify(seq), createdAt: now, updatedAt: now })
    }
    return `ST-${String(seq).padStart(6, '0')}`
  })
}

// ── Stocktaking CRUD ───────────────────────────────────────────────────────────

export async function createStocktakingSession(
  data: StocktakingSessionValues,
  db: BarOptDB = globalDb,
): Promise<StocktakingSession> {
  const now = new Date().toISOString()
  const sessionNumber = await getNextSessionNumber(db)
  const session: StocktakingSession = {
    id: uuidv4(),
    sessionNumber,
    sessionDate: data.sessionDate,
    status: 'draft',
    notes: data.notes || undefined,
    createdAt: now,
    updatedAt: now,
  }
  await db.stocktakingSessions.add(session)
  return session
}

export async function getStocktakingSessions(db: BarOptDB = globalDb): Promise<StocktakingSession[]> {
  const list = await db.stocktakingSessions.toArray()
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getStocktakingSession(
  sessionId: string,
  db: BarOptDB = globalDb,
): Promise<StocktakingSession | undefined> {
  return db.stocktakingSessions.get(sessionId)
}

export async function updateSessionStatus(
  sessionId: string,
  status: 'in_progress' | 'cancelled',
  db: BarOptDB = globalDb,
): Promise<void> {
  const session = await db.stocktakingSessions.get(sessionId)
  if (!session) throw new Error('Session not found')
  if (session.confirmedAt) throw new Error('Cannot modify a confirmed session')
  await db.stocktakingSessions.update(sessionId, { status, updatedAt: new Date().toISOString() })
}

export async function addStocktakingItem(
  sessionId: string,
  productType: 'frame' | 'lens',
  productId: string,
  db: BarOptDB = globalDb,
): Promise<StocktakingItem> {
  const session = await db.stocktakingSessions.get(sessionId)
  if (!session) throw new Error('Session not found')
  if (session.status === 'confirmed' || session.status === 'cancelled') {
    throw new Error('Cannot modify a confirmed or cancelled session')
  }
  const existing = await db.stocktakingItems
    .where('[sessionId+productId]').equals([sessionId, productId])
    .first()
  if (existing) throw new Error('Product already in this session')

  const stock = await getCurrentStock(productType, productId, db)
  const now = new Date().toISOString()
  const item: StocktakingItem = {
    id: uuidv4(),
    sessionId,
    productType,
    productId,
    systemQty: stock,
    createdAt: now,
    updatedAt: now,
  }
  await db.stocktakingItems.add(item)
  return item
}

export async function updateStocktakingCount(
  itemId: string,
  countedQty: number,
  db: BarOptDB = globalDb,
): Promise<void> {
  await db.stocktakingItems.update(itemId, { countedQty, updatedAt: new Date().toISOString() })
}

export async function getStocktakingItems(
  sessionId: string,
  db: BarOptDB = globalDb,
): Promise<StocktakingItem[]> {
  return db.stocktakingItems.where('sessionId').equals(sessionId).toArray()
}

export async function confirmStocktakingSession(
  sessionId: string,
  db: BarOptDB = globalDb,
): Promise<void> {
  const session = await db.stocktakingSessions.get(sessionId)
  if (!session) throw new Error('Session not found')
  if (session.confirmedAt) throw new Error('Session already confirmed — cannot apply twice')
  if (session.status === 'cancelled') throw new Error('Cannot confirm a cancelled session')

  const items = await getStocktakingItems(sessionId, db)

  await db.transaction('rw', [
    db.stocktakingSessions, db.stocktakingItems,
    db.inventoryMovements, db.frames, db.lenses,
  ], async () => {
    const now = new Date().toISOString()

    for (const item of items) {
      if (item.countedQty == null) continue

      const currentStock = item.productType === 'frame'
        ? (await db.frames.get(item.productId))?.quantity ?? 0
        : (await db.lenses.get(item.productId))?.quantity ?? 0

      const difference = item.countedQty - currentStock
      if (difference === 0) continue

      const movementType = difference > 0 ? 'adjustment_in' as const : 'adjustment_out' as const
      const movement: InventoryMovement = {
        id: uuidv4(),
        itemType: item.productType,
        itemId: item.productId,
        movementType,
        quantity: difference,
        quantityBefore: currentStock,
        quantityAfter: currentStock + difference,
        movementDate: session.sessionDate,
        sessionId,
        reason: `Stocktaking ${session.sessionNumber}`,
        createdAt: now,
        updatedAt: now,
      }
      await db.inventoryMovements.add(movement)

      const newQty = currentStock + difference
      if (item.productType === 'frame') {
        await db.frames.update(item.productId, { quantity: newQty, updatedAt: now })
      } else {
        await db.lenses.update(item.productId, { quantity: newQty, updatedAt: now })
      }
    }

    await db.stocktakingSessions.update(sessionId, {
      status: 'confirmed',
      confirmedAt: now,
      updatedAt: now,
    })
  })
}
