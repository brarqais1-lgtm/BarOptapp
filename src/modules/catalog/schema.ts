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
    z.number().min(0, 'السعر يجب أن يكون 0 أو أكثر'),
  ),
  quantity:     z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number().int().min(0, 'الكمية يجب أن تكون 0 أو أكثر'),
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
const optNumVariant = (min: number, max: number) =>
  z.preprocess(
    v => (v === '' || v == null ? undefined : (Number.isNaN(Number(v)) ? undefined : Number(v))),
    z.number({ required_error: 'مطلوب' }).min(min).max(max),
  )

export const LensVariantRowSchema = z.object({
  id:       z.string().optional(),
  sph:      optNumVariant(-30, 30),
  cyl:      optNumVariant(-10, 10),
  quantity: z.preprocess(
    v => (v === '' || v == null ? undefined : Math.round(Number(v))),
    z.number({ required_error: 'مطلوب' }).int().min(0),
  ),
  price: z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number({ required_error: 'مطلوب' }).min(0),
  ),
})

export type LensVariantRow = z.infer<typeof LensVariantRowSchema>

export const LensFormSchema = z.object({
  name:     z.string().min(1, 'اسم العدسة مطلوب').max(120),
  lensType: z.enum(['single_vision', 'bifocal', 'progressive']),
  notes:    optStr(),
  variants: z.array(LensVariantRowSchema).min(1, 'أضف درجة واحدة على الأقل'),
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
