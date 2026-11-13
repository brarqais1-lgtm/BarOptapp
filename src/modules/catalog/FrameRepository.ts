import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { Frame } from '../../database/schema'
import type { FrameFormValues } from './schema'

export interface FrameSearchParams {
  query?: string
  brand?: string
  gender?: string
  frameType?: string
  categoryId?: string
  includeArchived?: boolean
}

export async function searchFrames(
  params: FrameSearchParams = {},
  db: BarOptDB = globalDb,
): Promise<Frame[]> {
  let all = await db.frames
    .filter(f => params.includeArchived ? true : !f.deletedAt)
    .toArray()

  if (params.query) {
    const q = params.query.toLowerCase()
    all = all.filter(f =>
      (f.name ?? '').toLowerCase().includes(q) ||
      f.sku.toLowerCase().includes(q) ||
      f.brand.toLowerCase().includes(q) ||
      (f.model ?? '').toLowerCase().includes(q) ||
      (f.barcode ?? '').includes(q)
    )
  }
  if (params.brand) all = all.filter(f => f.brand === params.brand)
  if (params.gender) all = all.filter(f => f.gender === params.gender)
  if (params.frameType) all = all.filter(f => f.frameType === params.frameType)
  if (params.categoryId) all = all.filter(f => f.categoryId === params.categoryId)

  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getFrameById(id: string, db: BarOptDB = globalDb): Promise<Frame | undefined> {
  return db.frames.get(id)
}

export async function isSkuTaken(
  sku: string,
  excludeId?: string,
  db: BarOptDB = globalDb,
): Promise<boolean> {
  const existing = await db.frames
    .where('sku').equals(sku)
    .filter(f => !f.deletedAt && f.id !== excludeId)
    .first()
  return !!existing
}

export async function isBarcodeTaken(
  barcode: string,
  excludeId?: string,
  db: BarOptDB = globalDb,
): Promise<boolean> {
  if (!barcode) return false
  const existing = await db.frames
    .where('barcode').equals(barcode)
    .filter(f => !f.deletedAt && f.id !== excludeId)
    .first()
  return !!existing
}

export async function createFrame(
  data: FrameFormValues,
  db: BarOptDB = globalDb,
): Promise<Frame> {
  const sku = data.sku?.trim() || `F-${Date.now()}`
  if (await isSkuTaken(sku, undefined, db)) {
    throw new Error(`SKU "${sku}" is already in use`)
  }
  if (data.barcode && await isBarcodeTaken(data.barcode, undefined, db)) {
    throw new Error(`Barcode "${data.barcode}" is already in use`)
  }
  const now = new Date().toISOString()
  const frame: Frame = {
    id: uuidv4(),
    sku,
    name: data.name,
    brand: data.brand || data.name,
    model: data.model || undefined,
    barcode: data.barcode || undefined,
    gender: data.gender,
    frameShape: data.frameShape || undefined,
    material: data.material || undefined,
    color: data.color || undefined,
    size: data.size || undefined,
    frameType: data.frameType,
    supplierId: data.supplierId || undefined,
    categoryId: data.categoryId || undefined,
    imageUrl: data.imageUrl || undefined,
    notes: data.notes || undefined,
    sellingPrice: data.sellingPrice,
    quantity: data.quantity ?? 0,
    createdAt: now,
    updatedAt: now,
  }
  await db.frames.add(frame)
  return frame
}

export async function updateFrame(
  id: string,
  data: FrameFormValues,
  db: BarOptDB = globalDb,
): Promise<Frame> {
  const existing = await db.frames.get(id)
  const sku = data.sku?.trim() || existing?.sku || `F-${Date.now()}`
  if (await isSkuTaken(sku, id, db)) {
    throw new Error(`SKU "${sku}" is already in use`)
  }
  if (data.barcode && await isBarcodeTaken(data.barcode, id, db)) {
    throw new Error(`Barcode "${data.barcode}" is already in use`)
  }
  const now = new Date().toISOString()
  await db.frames.update(id, {
    sku,
    name: data.name,
    brand: data.brand || data.name,
    model: data.model || undefined,
    barcode: data.barcode || undefined,
    gender: data.gender,
    frameShape: data.frameShape || undefined,
    material: data.material || undefined,
    color: data.color || undefined,
    size: data.size || undefined,
    frameType: data.frameType,
    supplierId: data.supplierId || undefined,
    categoryId: data.categoryId || undefined,
    imageUrl: data.imageUrl || undefined,
    notes: data.notes || undefined,
    sellingPrice: data.sellingPrice,
    quantity: data.quantity ?? existing?.quantity ?? 0,
    updatedAt: now,
  })
  return (await db.frames.get(id))!
}

export async function archiveFrame(id: string, db: BarOptDB = globalDb): Promise<void> {
  await db.frames.update(id, { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
}

export async function restoreFrame(id: string, db: BarOptDB = globalDb): Promise<void> {
  await db.frames.update(id, { deletedAt: undefined, updatedAt: new Date().toISOString() })
}

export async function getFrameBrands(db: BarOptDB = globalDb): Promise<string[]> {
  const all = await db.frames.filter(f => !f.deletedAt).toArray()
  return [...new Set(all.map(f => f.brand))].sort()
}
