import { z } from 'zod'

const optStr = () => z.string().optional().or(z.literal(''))
const optNum = (min: number, max: number) =>
  z.preprocess(
    v => (v === '' || v == null ? undefined : (Number.isNaN(Number(v)) ? undefined : Number(v))),
    z.number().min(min).max(max).optional(),
  )

// ── Frame ─────────────────────────────────────────────────────────────────────
export const FrameFormSchema = z.object({
  name:         z.string().min(1, 'اسم المنتج مطلوب').max(120),
  sellingPrice: z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number({ required_error: 'السعر مطلوب' }).min(0, 'السعر يجب أن يكون 0 أو أكثر'),
  ),
  quantity:     z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number({ required_error: 'الكمية مطلوبة' }).int().min(0, 'الكمية يجب أن تكون 0 أو أكثر'),
  ),
  // kept optional for backwards compat (edit existing frames)
  sku:         optStr(),
  brand:       optStr(),
  model:       optStr(),
  barcode:     optStr(),
  gender:      z.enum(['male', 'female', 'unisex', 'kids']).optional(),
  frameShape:  optStr(),
  material:    optStr(),
  color:       optStr(),
  size:        optStr(),
  frameType:   z.enum(['full', 'half', 'rimless']).optional(),
  supplierId:  optStr(),
  categoryId:  optStr(),
  imageUrl:    optStr(),
  notes:       optStr(),
})

export type FrameFormValues = z.infer<typeof FrameFormSchema>

// ── Lens ──────────────────────────────────────────────────────────────────────
export const LensFormSchema = z.object({
  sku:         z.string().min(1, 'SKU مطلوب / SKU required').max(60),
  name:        z.string().min(1, 'اسم المنتج مطلوب / Name required').max(120),
  brand:       z.string().min(1, 'العلامة التجارية مطلوبة / Brand required').max(80),
  model:       optStr(),
  barcode:     optStr(),
  lensType:    z.enum(['single_vision', 'bifocal', 'progressive']),
  material:    optStr(),
  coatings:    z.array(z.enum(['ar', 'blue_cut', 'uv', 'photochromic'])).default([]),
  index:       optNum(1.0, 2.0),
  sphereMin:   optNum(-30, 0),
  sphereMax:   optNum(0, 30),
  cylinderMin: optNum(-10, 0),
  cylinderMax: optNum(0, 10),
  addMin:      optNum(0, 4),
  addMax:      optNum(0, 4),
  supplierId:  optStr(),
  categoryId:  optStr(),
  imageUrl:    optStr(),
  notes:       optStr(),
})

export type LensFormValues = z.infer<typeof LensFormSchema>

// ── Product Category ──────────────────────────────────────────────────────────
export const ProductCategorySchema = z.object({
  nameAr:      z.string().min(1, 'الاسم بالعربية مطلوب').max(80),
  nameEn:      z.string().min(1, 'English name required').max(80),
  type:        z.enum(['frame', 'lens', 'both']),
  description: optStr(),
})

export type ProductCategoryValues = z.infer<typeof ProductCategorySchema>
