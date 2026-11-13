import { z } from 'zod'

const toNum = (v: unknown) => (v === '' || v == null ? undefined : Number(v))
const toNumOrZero = (v: unknown) => (v === '' || v == null ? 0 : Number(v))

// ── Sale item ─────────────────────────────────────────────────────────────────

export const SaleItemFormSchema = z.object({
  itemType: z.enum(['frame', 'lens', 'service']),
  itemId: z.string().optional(),
  description: z.string().min(1, 'Description required'),
  quantity: z.preprocess(toNum, z.number().positive('Must be positive').int('Whole number')),
  unitPrice: z.preprocess(toNum, z.number().min(0, 'Must be ≥ 0')),
  discountAmount: z.preprocess(toNumOrZero, z.number().min(0)).default(0),
})
export type SaleItemFormValues = z.infer<typeof SaleItemFormSchema>

// ── Sale header ───────────────────────────────────────────────────────────────

export const SaleFormSchema = z.object({
  patientId: z.string().optional(),
  walkInName: z.string().optional(),
  prescriptionId: z.string().optional(),
  saleDate: z.string().min(1, 'Date required'),
  readyDate: z.string().optional(),
  labNotes: z.string().optional(),
  discountAmount: z.preprocess(toNumOrZero, z.number().min(0)).default(0),
  discountPercent: z.preprocess(toNumOrZero, z.number().min(0).max(100)).default(0),
  notes: z.string().optional(),
})
export type SaleFormValues = z.infer<typeof SaleFormSchema>

// ── Payment ───────────────────────────────────────────────────────────────────

export const PaymentFormSchema = z.object({
  amount: z.preprocess(toNum, z.number().positive('Amount must be positive')),
  method: z.enum(['cash', 'card', 'transfer', 'cheque', 'other']),
  reference: z.string().optional(),
  paidAt: z.string().min(1, 'Date required'),
  notes: z.string().optional(),
})
export type PaymentFormValues = z.infer<typeof PaymentFormSchema>

// ── Return ────────────────────────────────────────────────────────────────────

export const ReturnItemSchema = z.object({
  saleItemId: z.string().min(1),
  quantity: z.preprocess(toNumOrZero, z.number().nonnegative().int()),
  restockItem: z.boolean().default(true),
})

export const ReturnFormSchema = z.object({
  returnDate: z.string().min(1, 'Date required'),
  reason: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(ReturnItemSchema),
})
export type ReturnFormValues = z.infer<typeof ReturnFormSchema>
