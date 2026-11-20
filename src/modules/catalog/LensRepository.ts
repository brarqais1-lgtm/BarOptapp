import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { Lens, LensVariant } from '../../database/schema'
import type { LensFormValues } from './schema'

export interface LensSearchParams {
  query?: string
  lensType?: string
  categoryId?: string
  includeArchived?: boolean
}

export interface LensWithStats extends Lens {
  variantCount: number
  totalQty: number
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
      l.name.toLowerCase().includes(q) ||
      (l.sku ?? '').toLowerCase().includes(q)
    )
  }
  if (params.lensType) all = all.filter(l => l.lensType === params.lensType)
  if (params.categoryId) all = all.filter(l => l.categoryId === params.categoryId)

  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function searchLensesWithStats(
  params: LensSearchParams = {},
  db: BarOptDB = globalDb,
): Promise<LensWithStats[]> {
  const lenses = await searchLenses(params, db)
  const allVariants = await db.lensVariants.toArray()

  const countMap: Record<string, number> = {}
  const qtyMap: Record<string, number> = {}
  for (const v of allVariants) {
    countMap[v.lensId] = (countMap[v.lensId] ?? 0) + 1
    qtyMap[v.lensId] = (qtyMap[v.lensId] ?? 0) + v.quantity
  }

  return lenses.map(l => ({
    ...l,
    variantCount: countMap[l.id] ?? 0,
    totalQty: qtyMap[l.id] ?? 0,
  }))
}

export async function getLensById(id: string, db: BarOptDB = globalDb): Promise<Lens | undefined> {
  return db.lenses.get(id)
}

export async function getVariantsByLensId(lensId: string, db: BarOptDB = globalDb): Promise<LensVariant[]> {
  return db.lensVariants.where('lensId').equals(lensId).toArray()
}

export async function getLensWithVariants(
  id: string,
  db: BarOptDB = globalDb,
): Promise<{ lens: Lens; variants: LensVariant[] } | null> {
  const lens = await db.lenses.get(id)
  if (!lens) return null
  const variants = await db.lensVariants.where('lensId').equals(id).toArray()
  return { lens, variants }
}

export async function createLens(
  data: LensFormValues,
  db: BarOptDB = globalDb,
): Promise<Lens> {
  const shortId = uuidv4().split('-')[0].toUpperCase()
  const now = new Date().toISOString()
  const lens: Lens = {
    id: uuidv4(),
    name: data.name,
    lensType: data.lensType,
    sku: `LNS-${shortId}`,
    brand: data.name,
    notes: data.notes || undefined,
    createdAt: now,
    updatedAt: now,
  }
  await db.lenses.add(lens)

  for (const v of data.variants) {
    await db.lensVariants.add({
      id: uuidv4(),
      lensId: lens.id,
      sph: v.sph as number,
      cyl: v.cyl as number,
      quantity: v.quantity as number,
      price: v.price as number,
      createdAt: now,
      updatedAt: now,
    })
  }

  return lens
}

export async function updateLens(
  id: string,
  data: LensFormValues,
  db: BarOptDB = globalDb,
): Promise<Lens> {
  const now = new Date().toISOString()
  await db.lenses.update(id, {
    name: data.name,
    brand: data.name,
    lensType: data.lensType,
    notes: data.notes || undefined,
    updatedAt: now,
  })

  // Replace all variants
  const old = await db.lensVariants.where('lensId').equals(id).toArray()
  if (old.length) await db.lensVariants.bulkDelete(old.map(v => v.id))

  for (const v of data.variants) {
    await db.lensVariants.add({
      id: uuidv4(),
      lensId: id,
      sph: v.sph as number,
      cyl: v.cyl as number,
      quantity: v.quantity as number,
      price: v.price as number,
      createdAt: now,
      updatedAt: now,
    })
  }

  return (await db.lenses.get(id))!
}

export async function archiveLens(id: string, db: BarOptDB = globalDb): Promise<void> {
  await db.lenses.update(id, { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
}

export async function restoreLens(id: string, db: BarOptDB = globalDb): Promise<void> {
  await db.lenses.update(id, { deletedAt: undefined, updatedAt: new Date().toISOString() })
}
