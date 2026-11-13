/**
 * Phase 05 Tests — Optical Products & Lens Catalog Management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BarOptDB } from '../src/database/db'
import {
  searchFrames,
  getFrameById,
  createFrame,
  updateFrame,
  archiveFrame,
  restoreFrame,
  getFrameBrands,
  isSkuTaken as isFrameSkuTaken,
  isBarcodeTaken as isFrameBarcodeTaken,
} from '../src/modules/catalog/FrameRepository'
import {
  searchLenses,
  getLensById,
  createLens,
  updateLens,
  archiveLens,
  restoreLens,
  getLensBrands,
  isSkuTaken as isLensSkuTaken,
  isBarcodeTaken as isLensBarcodeTaken,
} from '../src/modules/catalog/LensRepository'
import {
  getCategories,
  createCategory,
  updateCategory,
  archiveCategory,
} from '../src/modules/catalog/ProductCategoryRepository'
import { FrameFormSchema, LensFormSchema, ProductCategorySchema } from '../src/modules/catalog/schema'

function createTestDB() { return new BarOptDB() }

const baseFrame = {
  sku: 'FRM-001', name: 'Ray-Ban Classic', brand: 'Ray-Ban',
  model: 'RB3025', barcode: '1234567890',
  gender: 'unisex' as const, frameType: 'full' as const,
  frameShape: 'Aviator', material: 'Metal', color: 'Gold', size: '55-14-135',
  supplierId: '', categoryId: '', imageUrl: '', notes: '',
}

const baseLens = {
  sku: 'LNS-001', name: 'Essilor Single', brand: 'Essilor',
  model: 'Orma', barcode: '9876543210',
  lensType: 'single_vision' as const, material: 'CR-39',
  coatings: ['ar' as const], index: 1.56,
  sphereMin: -6, sphereMax: 4, cylinderMin: -2, cylinderMax: 2,
  addMin: undefined, addMax: undefined,
  supplierId: '', categoryId: '', imageUrl: '', notes: '',
}

const baseCategory = {
  nameAr: 'إطارات رياضية', nameEn: 'Sports Frames',
  type: 'frame' as const, description: 'Frames for sports use',
}

// ── Frame Schema Validation ────────────────────────────────────────────────────

describe('FrameFormSchema', () => {
  it('validates a valid frame', () => {
    const result = FrameFormSchema.safeParse(baseFrame)
    expect(result.success).toBe(true)
  })

  it('rejects missing SKU', () => {
    const result = FrameFormSchema.safeParse({ ...baseFrame, sku: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = FrameFormSchema.safeParse({ ...baseFrame, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing brand', () => {
    const result = FrameFormSchema.safeParse({ ...baseFrame, brand: '' })
    expect(result.success).toBe(false)
  })

  it('allows optional fields to be empty', () => {
    const result = FrameFormSchema.safeParse({ ...baseFrame, model: '', color: '', notes: '' })
    expect(result.success).toBe(true)
  })
})

// ── Lens Schema Validation ─────────────────────────────────────────────────────

describe('LensFormSchema', () => {
  it('validates a valid lens', () => {
    const result = LensFormSchema.safeParse(baseLens)
    expect(result.success).toBe(true)
  })

  it('rejects missing lensType', () => {
    const result = LensFormSchema.safeParse({ ...baseLens, lensType: '' })
    expect(result.success).toBe(false)
  })

  it('coerces empty string index to undefined', () => {
    const result = LensFormSchema.safeParse({ ...baseLens, index: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.index).toBeUndefined()
  })

  it('rejects index out of range', () => {
    const result = LensFormSchema.safeParse({ ...baseLens, index: 3.0 })
    expect(result.success).toBe(false)
  })

  it('defaults coatings to empty array', () => {
    const result = LensFormSchema.safeParse({ ...baseLens, coatings: undefined })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.coatings).toEqual([])
  })
})

// ── ProductCategorySchema Validation ──────────────────────────────────────────

describe('ProductCategorySchema', () => {
  it('validates a valid category', () => {
    const result = ProductCategorySchema.safeParse(baseCategory)
    expect(result.success).toBe(true)
  })

  it('rejects missing Arabic name', () => {
    const result = ProductCategorySchema.safeParse({ ...baseCategory, nameAr: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid type', () => {
    const result = ProductCategorySchema.safeParse({ ...baseCategory, type: 'invalid' })
    expect(result.success).toBe(false)
  })
})

// ── Frame CRUD ─────────────────────────────────────────────────────────────────

describe('Frame CRUD', () => {
  let db: BarOptDB

  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('creates a frame and retrieves it', async () => {
    const frame = await createFrame(baseFrame, db)
    expect(frame.id).toBeTruthy()
    expect(frame.sku).toBe('FRM-001')
    expect(frame.brand).toBe('Ray-Ban')
    const found = await getFrameById(frame.id, db)
    expect(found).toBeDefined()
    expect(found!.name).toBe('Ray-Ban Classic')
  })

  it('updates a frame', async () => {
    const frame = await createFrame(baseFrame, db)
    const updated = await updateFrame(frame.id, { ...baseFrame, name: 'Updated Name' }, db)
    expect(updated.name).toBe('Updated Name')
  })

  it('archives a frame (soft delete)', async () => {
    const frame = await createFrame(baseFrame, db)
    await archiveFrame(frame.id, db)
    const all = await searchFrames({ includeArchived: false }, db)
    expect(all.find(f => f.id === frame.id)).toBeUndefined()
    const withArchived = await searchFrames({ includeArchived: true }, db)
    expect(withArchived.find(f => f.id === frame.id)).toBeDefined()
  })

  it('restores an archived frame', async () => {
    const frame = await createFrame(baseFrame, db)
    await archiveFrame(frame.id, db)
    await restoreFrame(frame.id, db)
    const all = await searchFrames({}, db)
    expect(all.find(f => f.id === frame.id)).toBeDefined()
  })

  it('searches frames by query', async () => {
    await createFrame(baseFrame, db)
    await createFrame({ ...baseFrame, sku: 'FRM-002', name: 'Oakley Sport', brand: 'Oakley', barcode: 'OAK001' }, db)
    const results = await searchFrames({ query: 'oakley' }, db)
    expect(results.length).toBe(1)
    expect(results[0].brand).toBe('Oakley')
  })

  it('filters frames by brand', async () => {
    await createFrame(baseFrame, db)
    await createFrame({ ...baseFrame, sku: 'FRM-002', name: 'Oakley Sport', brand: 'Oakley', barcode: 'OAK001' }, db)
    const results = await searchFrames({ brand: 'Ray-Ban' }, db)
    expect(results.every(f => f.brand === 'Ray-Ban')).toBe(true)
  })

  it('filters frames by gender', async () => {
    await createFrame(baseFrame, db)
    await createFrame({ ...baseFrame, sku: 'FRM-003', barcode: 'BAR003', gender: 'female' }, db)
    const results = await searchFrames({ gender: 'female' }, db)
    expect(results.length).toBe(1)
  })

  it('filters frames by frameType', async () => {
    await createFrame(baseFrame, db)
    await createFrame({ ...baseFrame, sku: 'FRM-004', barcode: 'BAR004', frameType: 'rimless' }, db)
    const results = await searchFrames({ frameType: 'rimless' }, db)
    expect(results.length).toBe(1)
  })

  it('returns unique brands', async () => {
    await createFrame(baseFrame, db)
    await createFrame({ ...baseFrame, sku: 'FRM-002', barcode: 'BAR002', brand: 'Oakley' }, db)
    await createFrame({ ...baseFrame, sku: 'FRM-003', barcode: 'BAR003', brand: 'Ray-Ban' }, db)
    const brands = await getFrameBrands(db)
    expect(brands).toContain('Ray-Ban')
    expect(brands).toContain('Oakley')
    expect(brands.length).toBe(2)
  })
})

// ── Frame SKU/Barcode Uniqueness ──────────────────────────────────────────────

describe('Frame SKU/Barcode uniqueness', () => {
  let db: BarOptDB

  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('rejects duplicate active SKU', async () => {
    await createFrame(baseFrame, db)
    await expect(createFrame({ ...baseFrame, barcode: 'NEWBAR' }, db)).rejects.toThrow('SKU')
  })

  it('allows reuse of archived SKU', async () => {
    const f = await createFrame(baseFrame, db)
    await archiveFrame(f.id, db)
    const f2 = await createFrame({ ...baseFrame, barcode: 'NEWBAR2' }, db)
    expect(f2.sku).toBe('FRM-001')
  })

  it('rejects duplicate active barcode', async () => {
    await createFrame(baseFrame, db)
    await expect(createFrame({ ...baseFrame, sku: 'FRM-999' }, db)).rejects.toThrow('Barcode')
  })

  it('isSkuTaken returns false for excluded id', async () => {
    const f = await createFrame(baseFrame, db)
    const taken = await isFrameSkuTaken('FRM-001', f.id, db)
    expect(taken).toBe(false)
  })
})

// ── Lens CRUD ─────────────────────────────────────────────────────────────────

describe('Lens CRUD', () => {
  let db: BarOptDB

  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('creates a lens and retrieves it', async () => {
    const lens = await createLens(baseLens, db)
    expect(lens.id).toBeTruthy()
    expect(lens.sku).toBe('LNS-001')
    const found = await getLensById(lens.id, db)
    expect(found?.lensType).toBe('single_vision')
  })

  it('updates a lens', async () => {
    const lens = await createLens(baseLens, db)
    const updated = await updateLens(lens.id, { ...baseLens, name: 'Updated Lens' }, db)
    expect(updated.name).toBe('Updated Lens')
  })

  it('archives and restores a lens', async () => {
    const lens = await createLens(baseLens, db)
    await archiveLens(lens.id, db)
    const active = await searchLenses({ includeArchived: false }, db)
    expect(active.find(l => l.id === lens.id)).toBeUndefined()
    await restoreLens(lens.id, db)
    const restored = await searchLenses({ includeArchived: false }, db)
    expect(restored.find(l => l.id === lens.id)).toBeDefined()
  })

  it('searches lenses by query', async () => {
    await createLens(baseLens, db)
    await createLens({ ...baseLens, sku: 'LNS-002', name: 'Hoya Progressive', brand: 'Hoya', barcode: 'HOY001' }, db)
    const results = await searchLenses({ query: 'hoya' }, db)
    expect(results.length).toBe(1)
  })

  it('filters by lensType', async () => {
    await createLens(baseLens, db)
    await createLens({ ...baseLens, sku: 'LNS-003', barcode: 'BAR003', lensType: 'progressive' }, db)
    const results = await searchLenses({ lensType: 'progressive' }, db)
    expect(results.length).toBe(1)
  })

  it('returns unique lens brands', async () => {
    await createLens(baseLens, db)
    await createLens({ ...baseLens, sku: 'LNS-004', barcode: 'BAR004', brand: 'Hoya' }, db)
    const brands = await getLensBrands(db)
    expect(brands).toContain('Essilor')
    expect(brands).toContain('Hoya')
  })
})

// ── Lens SKU/Barcode Uniqueness ───────────────────────────────────────────────

describe('Lens SKU/Barcode uniqueness', () => {
  let db: BarOptDB

  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('rejects duplicate active SKU', async () => {
    await createLens(baseLens, db)
    await expect(createLens({ ...baseLens, barcode: 'NEWBAR' }, db)).rejects.toThrow('SKU')
  })

  it('allows reuse of archived lens SKU', async () => {
    const l = await createLens(baseLens, db)
    await archiveLens(l.id, db)
    const l2 = await createLens({ ...baseLens, barcode: 'NEWBAR3' }, db)
    expect(l2.sku).toBe('LNS-001')
  })

  it('isBarcodeTaken returns false for empty string', async () => {
    const taken = await isLensBarcodeTaken('', undefined, db)
    expect(taken).toBe(false)
  })
})

// ── Product Categories CRUD ───────────────────────────────────────────────────

describe('ProductCategory CRUD', () => {
  let db: BarOptDB

  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('creates and retrieves a category', async () => {
    const cat = await createCategory(baseCategory, db)
    expect(cat.id).toBeTruthy()
    const all = await getCategories(undefined, db)
    expect(all.length).toBe(1)
    expect(all[0].nameEn).toBe('Sports Frames')
  })

  it('filters categories by type', async () => {
    await createCategory(baseCategory, db)
    await createCategory({ nameAr: 'عدسات رياضية', nameEn: 'Sports Lenses', type: 'lens', description: '' }, db)
    const frames = await getCategories('frame', db)
    expect(frames.length).toBe(1)
    expect(frames[0].nameEn).toBe('Sports Frames')
  })

  it('type=both appears in both frame and lens queries', async () => {
    await createCategory({ ...baseCategory, type: 'both', nameEn: 'General' }, db)
    const frames = await getCategories('frame', db)
    const lenses = await getCategories('lens', db)
    expect(frames.length).toBe(1)
    expect(lenses.length).toBe(1)
  })

  it('updates a category', async () => {
    const cat = await createCategory(baseCategory, db)
    await updateCategory(cat.id, { ...baseCategory, nameEn: 'Updated Name' }, db)
    const all = await getCategories(undefined, db)
    expect(all[0].nameEn).toBe('Updated Name')
  })

  it('archives a category', async () => {
    const cat = await createCategory(baseCategory, db)
    await archiveCategory(cat.id, db)
    const all = await getCategories(undefined, db)
    expect(all.length).toBe(0)
  })
})

// ── DB Migration v5 regression ────────────────────────────────────────────────

describe('DB v5 migration', () => {
  it('productCategories table exists', async () => {
    const db = createTestDB()
    const tables = db.tables.map(t => t.name)
    expect(tables).toContain('productCategories')
  })

  it('frames table has categoryId index', async () => {
    const db = createTestDB()
    const schema = db.frames.schema
    const idxNames = schema.indexes.map(i => i.name)
    expect(idxNames).toContain('categoryId')
  })

  it('lenses table has lensType index', async () => {
    const db = createTestDB()
    const schema = db.lenses.schema
    const idxNames = schema.indexes.map(i => i.name)
    expect(idxNames).toContain('lensType')
  })
})
