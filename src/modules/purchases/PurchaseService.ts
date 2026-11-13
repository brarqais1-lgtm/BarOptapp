import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { InventoryMovement } from '../../database/schema'

// ── Status transitions ────────────────────────────────────────────────────────

export async function markAsOrdered(purchaseId: string, db: BarOptDB = globalDb): Promise<void> {
  const purchase = await db.purchases.get(purchaseId)
  if (!purchase) throw new Error('Purchase not found')
  if (purchase.status !== 'draft') throw new Error('Only draft purchases can be marked as ordered')

  const items = await db.purchaseItems.where('purchaseId').equals(purchaseId).toArray()
  if (items.length === 0) throw new Error('Cannot order a purchase with no items')

  const now = new Date().toISOString()
  await db.purchases.update(purchaseId, { status: 'ordered', orderedAt: now, updatedAt: now })
}

export async function cancelPurchase(purchaseId: string, db: BarOptDB = globalDb): Promise<void> {
  const purchase = await db.purchases.get(purchaseId)
  if (!purchase) throw new Error('Purchase not found')
  if (purchase.status === 'received' || purchase.status === 'partial') {
    throw new Error('Cannot cancel a purchase that has already received stock')
  }
  if (purchase.status === 'cancelled') throw new Error('Purchase is already cancelled')
  await db.purchases.update(purchaseId, { status: 'cancelled', updatedAt: new Date().toISOString() })
}

// ── Receiving ─────────────────────────────────────────────────────────────────

export interface ReceivingItem {
  itemId: string
  qty: number
}

export async function receivePurchaseItems(
  purchaseId: string,
  receivingItems: ReceivingItem[],
  receivedDate: string,
  db: BarOptDB = globalDb,
): Promise<void> {
  // Deduplicate and filter zero-qty items
  const itemMap = new Map<string, number>()
  for (const { itemId, qty } of receivingItems) {
    if (qty > 0) itemMap.set(itemId, (itemMap.get(itemId) ?? 0) + qty)
  }
  if (itemMap.size === 0) throw new Error('No items to receive')

  await db.transaction('rw', [
    db.purchases, db.purchaseItems, db.inventoryMovements, db.frames, db.lenses,
  ], async () => {
    const purchase = await db.purchases.get(purchaseId)
    if (!purchase) throw new Error('Purchase not found')
    if (purchase.status === 'cancelled') throw new Error('Cannot receive a cancelled purchase')
    if (purchase.status === 'received') throw new Error('Purchase is already fully received')
    if (purchase.status === 'draft') throw new Error('Mark the purchase as ordered before receiving')

    const now = new Date().toISOString()

    for (const [itemId, qty] of itemMap) {
      const item = await db.purchaseItems.get(itemId)
      if (!item) throw new Error(`Purchase item not found: ${itemId}`)
      if (item.purchaseId !== purchaseId) throw new Error('Item does not belong to this purchase')

      const outstanding = item.orderedQty - item.receivedQty
      if (qty > outstanding) {
        throw new Error(
          `Cannot receive ${qty} — only ${outstanding} outstanding for "${item.description}"`
        )
      }

      const product = item.productType === 'frame'
        ? await db.frames.get(item.productId)
        : await db.lenses.get(item.productId)
      if (!product) throw new Error(`Product not found for item "${item.description}"`)

      const quantityBefore = product.quantity ?? 0
      const quantityAfter = quantityBefore + qty

      const movement: InventoryMovement = {
        id: uuidv4(),
        itemType: item.productType,
        itemId: item.productId,
        movementType: 'stock_in',
        quantity: qty,
        quantityBefore,
        quantityAfter,
        movementDate: receivedDate,
        reason: `Purchase ${purchase.purchaseNumber}`,
        referenceType: 'purchase',
        referenceId: purchaseId,
        referenceNumber: purchase.purchaseNumber,
        createdAt: now,
        updatedAt: now,
      }
      await db.inventoryMovements.add(movement)

      if (item.productType === 'frame') {
        await db.frames.update(item.productId, { quantity: quantityAfter, updatedAt: now })
      } else {
        await db.lenses.update(item.productId, { quantity: quantityAfter, updatedAt: now })
      }

      await db.purchaseItems.update(itemId, {
        receivedQty: item.receivedQty + qty,
        updatedAt: now,
      })
    }

    // Re-read all items to check if fully received (reads-your-writes within transaction)
    const allItems = await db.purchaseItems.where('purchaseId').equals(purchaseId).toArray()
    const allFullyReceived = allItems.every(i => i.receivedQty >= i.orderedQty)

    if (allFullyReceived) {
      await db.purchases.update(purchaseId, {
        status: 'received',
        receivedAt: receivedDate,
        updatedAt: now,
      })
    } else {
      await db.purchases.update(purchaseId, { status: 'partial', updatedAt: now })
    }
  })
}

// ── Linked movements ──────────────────────────────────────────────────────────

export async function getPurchaseMovements(purchaseId: string, db: BarOptDB = globalDb) {
  const all = await db.inventoryMovements.toArray()
  return all
    .filter(m => m.referenceId === purchaseId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
