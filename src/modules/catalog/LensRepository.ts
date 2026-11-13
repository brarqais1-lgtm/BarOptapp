import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { Lens } from '../../database/schema'
import type { LensFormValues } from './schema'

export interface LensSearchParams {
  query?: string
  brand?: string
  lensType?: string
  categoryId?: string
  includeArchived?: boolean
}

export async function searchLenses(
  params: LensSearchParams = {},
  db: BarOptDB = globalDb,
): Promise<Lens[]> {
  let all = await db.lenses
    .filter(l => params.includeArchived ? true : !l.deletedAt)
    .toArray()

  if (params.query) {
    const q = params.query.toLowerCase()
    all = all.filter(l =>
      (l.name ?? '').toLowerCase().includes(q) ||
      l.sku.toLowerCase().includes(q) ||
      l.brand.toLowerCase().includes(q) ||
      (l.model ?? '').toLowerCase().includes(q) ||
      (l.barcode ?? '').includes(q)
    )
  }
  if (params.brand) all = all.filter(l => l.brand === params.brand)
  if (params.lensType) all = all.filter(l => l.lensType === params.lensType)
  if (params.categoryId) all = all.filter(l => l.categoryId === params.categoryId)

  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getLensById(id: string, db: BarOptDB = globalDb): Promise<Lens | undefined> {
  return db.lenses.get(id)
}

export async function isSkuTaken(
  sku: string,
  excludeId?: string,
  db: BarOptDB = globalDb,
): Promise<boolean> {
  const existing = await db.lenses
    .where('sku').equals(sku)
    .filter(l => !l.deletedAt && l.id !== excludeId)
    .first()
  return !!existing
}

export async function isBarcodeTaken(
  barcode: string,
  excludeId?: string,
  db: BarOptDB = globalDb,
): Promise<boolean> {
  if (!barcode) return false
  const existing = await db.lenses
    .where('barcode').equals(barcode)
    .filter(l => !l.deletedAt && l.id !== excludeId)
    .first()
  return !!existing
}

export async function createLens(
  data: LensFormValues,
  db: BarOptDB = globalDb,
): Promise<Lens> {
  if (await isSkuTaken(data.sku, undefined, db)) {
    throw new Error(`SKU "${data.sku}" is already in use`)
  }
  if (data.barcode && await isBarcodeTaken(data.barcode, undefined, db)) {
    throw new Error(`Barcode "${data.barcode}" is already in use`)
  }
  const now = new Date().toISOString()
  const lens: Lens = {
    id: uuidv4(),
    sku: data.sku,
    name: data.name,
    brand: data.brand,
    model: data.model || undefined,
    barcode: data.barcode || undefined,
    lensType: data.lensType,
    material: data.material || undefined,
    coatings: data.coatings.length ? data.coatings : undefined,
    index: data.index,
    sphereMin: data.sphereMin,
    sphereMax: data.sphereMax,
    cylinderMin: data.cylinderMin,
    cylinderMax: data.cylinderMax,
    addMin: data.addMin,
    addMax: data.addMax,
    supplierId: data.supplierId || undefined,
    categoryId: data.categoryId || undefined,
    imageUrl: data.imageUrl || undefined,
    notes: data.notes || undefined,
    createdAt: now,
    updatedAt: now,
  }
  await db.lenses.add(lens)
  return lens
}

export async function updateLens(
  id: string,
  data: LensFormValues,
  db: BarOptDB = globalDb,
): Promise<Lens> {
  if (await isSkuTaken(data.sku, id, db)) {
    throw new Error(`SKU "${data.sku}" is already in use`)
  }
  if (data.barcode && await isBarcodeTaken(data.barcode, id, db)) {
    throw new Error(`Barcode "${data.barcode}" is already in use`)
  }
  const now = new Date().toISOString()
  await db.lenses.update(id, {
    sku: data.sku,
    name: data.name,
    brand: data.brand,
    model: data.model || undefined,
    barcode: data.barcode || undefined,
    lensType: data.lensType,
    material: data.material || undefined,
    coatings: data.coatings.length ? data.coatings : undefined,
    index: data.index,
    sphereMin: data.sphereMin,
    sphereMax: data.sphereMax,
    cylinderMin: data.cylinderMin,
    cylinderMax: data.cylinderMax,
    addMin: data.addMin,
    addMax: data.addMax,
    supplierId: data.supplierId || undefined,
    categoryId: data.categoryId || undefined,
    imageUrl: data.imageUrl || undefined,
    notes: data.notes || undefined,
    updatedAt: now,
  })
  return (await db.lenses.get(id))!
}

export async function archiveLens(id: string, db: BarOptDB = globalDb): Promise<void> {
  await db.lenses.update(id, { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
}

export async function restoreLens(id: string, db: BarOptDB = globalDb): Promise<void> {
  await db.lenses.update(id, { deletedAt: undefined, updatedAt: new Date().toISOString() })
}

export async function getLensBrands(db: BarOptDB = globalDb): Promise<string[]> {
  const all = await db.lenses.filter(l => !l.deletedAt).toArray()
  return [...new Set(all.map(l => l.brand))].sort()
}
