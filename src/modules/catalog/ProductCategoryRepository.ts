import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { ProductCategory } from '../../database/schema'
import type { ProductCategoryValues } from './schema'

export async function getCategories(
  type?: 'frame' | 'lens' | 'both',
  db: BarOptDB = globalDb,
): Promise<ProductCategory[]> {
  let query = db.productCategories.filter(c => !c.deletedAt)
  if (type) {
    const all = await db.productCategories.filter(c => !c.deletedAt).toArray()
    return all.filter(c => c.type === type || c.type === 'both').sort((a, b) => a.nameAr.localeCompare(b.nameAr))
  }
  return query.toArray().then(r => r.sort((a, b) => a.nameAr.localeCompare(b.nameAr)))
}

export async function createCategory(
  data: ProductCategoryValues,
  db: BarOptDB = globalDb,
): Promise<ProductCategory> {
  const now = new Date().toISOString()
  const record: ProductCategory = {
    id: uuidv4(),
    nameAr: data.nameAr,
    nameEn: data.nameEn,
    type: data.type,
    description: data.description || undefined,
    createdAt: now,
    updatedAt: now,
  }
  await db.productCategories.add(record)
  return record
}

export async function updateCategory(
  id: string,
  data: ProductCategoryValues,
  db: BarOptDB = globalDb,
): Promise<ProductCategory> {
  const now = new Date().toISOString()
  await db.productCategories.update(id, {
    nameAr: data.nameAr,
    nameEn: data.nameEn,
    type: data.type,
    description: data.description || undefined,
    updatedAt: now,
  })
  return (await db.productCategories.get(id))!
}

export async function archiveCategory(
  id: string,
  db: BarOptDB = globalDb,
): Promise<void> {
  await db.productCategories.update(id, {
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}
