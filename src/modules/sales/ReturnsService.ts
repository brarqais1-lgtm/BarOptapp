import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { SaleReturn, SaleReturnItem, InventoryMovement } from '../../database/schema'

function r2(n: number): number { return Math.round(n * 100) / 100 }

export async function getNextReturnNumber(db: BarOptDB = globalDb): Promise<string> {
  return db.transaction('rw', [db.settings], async () => {
    const key = 'return_sequence'
    const setting = await db.settings.where('key').equals(key).first()
    const seq = setting ? (JSON.parse(setting.value) as number) + 1 : 1
    const now = new Date().toISOString()
    if (setting) {
      await db.settings.update(setting.id, { value: JSON.stringify(seq), updatedAt: now })
    } else {
      await db.settings.add({ id: uuidv4(), key, value: JSON.stringify(seq), createdAt: now, updatedAt: now })
    }
    return `RT-${String(seq).padStart(6, '0')}`
  })
}

export interface ReturnItemInput {
  saleItemId: string
  quantity: number
  restockItem: boolean
}

export async function processReturn(
  saleId: string,
  returnItems: ReturnItemInput[],
  returnDate: string,
  reason?: string,
  notes?: string,
  db: BarOptDB = globalDb,
): Promise<SaleReturn> {
  const itemsToProcess = returnItems.filter(i => i.quantity > 0)
  if (itemsToProcess.length === 0) throw new Error('No items to return')

  const returnNumber = await getNextReturnNumber(db)

  return db.transaction('rw', [
    db.sales, db.saleItems, db.saleReturns, db.saleReturnItems, db.inventoryMovements, db.frames, db.lenses,
  ], async () => {
    const sale = await db.sales.get(saleId)
    if (!sale) throw new Error('Sale not found')
    if (sale.status !== 'confirmed') {
      throw new Error('Can only return items from a confirmed sale')
    }

    const now = new Date().toISOString()
    let totalRefund = 0

    const saleReturn: SaleReturn = {
      id: uuidv4(),
      saleId,
      returnNumber,
      returnDate,
      reason: reason || undefined,
      notes: notes || undefined,
      totalRefund: 0, // updated below
      createdAt: now,
      updatedAt: now,
    }
    await db.saleReturns.add(saleReturn)

    for (const { saleItemId, quantity, restockItem } of itemsToProcess) {
      const saleItem = await db.saleItems.get(saleItemId)
      if (!saleItem) throw new Error(`Sale item not found: ${saleItemId}`)
      if (saleItem.saleId !== saleId) throw new Error('Item does not belong to this sale')

      const maxReturnable = saleItem.quantity - saleItem.returnedQty
      if (quantity > maxReturnable) {
        throw new Error(
          `Cannot return ${quantity} of "${saleItem.description}" — only ${maxReturnable} returnable`
        )
      }

      const unitRefund = r2(saleItem.total / saleItem.quantity)
      const refundAmount = r2(unitRefund * quantity)
      totalRefund = r2(totalRefund + refundAmount)

      const returnItem: SaleReturnItem = {
        id: uuidv4(),
        returnId: saleReturn.id,
        saleItemId,
        quantity,
        unitPrice: saleItem.unitPrice,
        refundAmount,
        restockItem,
        createdAt: now,
        updatedAt: now,
      }
      await db.saleReturnItems.add(returnItem)

      await db.saleItems.update(saleItemId, {
        returnedQty: saleItem.returnedQty + quantity,
        updatedAt: now,
      })

      // Restock inventory
      if (restockItem && saleItem.itemId && saleItem.itemType !== 'service') {
        const product = saleItem.itemType === 'frame'
          ? await db.frames.get(saleItem.itemId)
          : await db.lenses.get(saleItem.itemId)

        if (product) {
          const qtyBefore = product.quantity ?? 0
          const qtyAfter = qtyBefore + quantity

          const movement: InventoryMovement = {
            id: uuidv4(),
            itemType: saleItem.itemType as 'frame' | 'lens',
            itemId: saleItem.itemId,
            movementType: 'returned',
            quantity,
            quantityBefore: qtyBefore,
            quantityAfter: qtyAfter,
            movementDate: returnDate,
            reason: `Return ${returnNumber} — ${sale.saleNumber}`,
            referenceType: 'sale_return',
            referenceId: saleReturn.id,
            referenceNumber: returnNumber,
            createdAt: now,
            updatedAt: now,
          }
          await db.inventoryMovements.add(movement)

          if (saleItem.itemType === 'frame') {
            await db.frames.update(saleItem.itemId, { quantity: qtyAfter, updatedAt: now })
          } else {
            await db.lenses.update(saleItem.itemId, { quantity: qtyAfter, updatedAt: now })
          }
        }
      }
    }

    await db.saleReturns.update(saleReturn.id, { totalRefund, updatedAt: now })

    return { ...saleReturn, totalRefund }
  })
}

export async function getSaleReturns(saleId: string, db: BarOptDB = globalDb): Promise<SaleReturn[]> {
  return db.saleReturns.where('saleId').equals(saleId).toArray()
}

export async function getSaleReturnItems(returnId: string, db: BarOptDB = globalDb): Promise<SaleReturnItem[]> {
  return db.saleReturnItems.where('returnId').equals(returnId).toArray()
}
