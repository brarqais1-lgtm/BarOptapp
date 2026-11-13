import { z } from 'zod'

export const IN_MOVEMENT_TYPES = ['opening', 'stock_in', 'adjustment_in', 'returned'] as const
export const OUT_MOVEMENT_TYPES = ['stock_out', 'adjustment_out', 'damaged'] as const
export type UserMovementType = typeof IN_MOVEMENT_TYPES[number] | typeof OUT_MOVEMENT_TYPES[number]

export const MovementFormSchema = z.object({
  productType: z.enum(['frame', 'lens']),
  productId: z.string().min(1, 'Product required'),
  movementType: z.enum(['opening', 'stock_in', 'stock_out', 'adjustment_in', 'adjustment_out', 'damaged', 'returned']),
  quantity: z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number().positive('Must be positive').int('Whole number only'),
  ),
  movementDate: z.string().min(1, 'Date required'),
  reason: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
})

export type MovementFormValues = z.infer<typeof MovementFormSchema>

export const StocktakingSessionSchema = z.object({
  sessionDate: z.string().min(1, 'Date required'),
  notes: z.string().optional(),
})

export type StocktakingSessionValues = z.infer<typeof StocktakingSessionSchema>

export const PricingSchema = z.object({
  reorderPoint: z.preprocess(
    v => (v === '' || v == null ? 0 : Number(v)),
    z.number().min(0).int(),
  ),
  costPrice: z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number().min(0).optional(),
  ),
  sellingPrice: z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number().min(0).optional(),
  ),
})

export type PricingValues = z.infer<typeof PricingSchema>
