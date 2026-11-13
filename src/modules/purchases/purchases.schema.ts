import { z } from 'zod'

const toNum = (v: unknown) => (v === '' || v == null ? undefined : Number(v))
const toNumOrZero = (v: unknown) => (v === '' || v == null ? 0 : Number(v))

// ── Supplier ──────────────────────────────────────────────────────────────────

export const SupplierFormSchema = z.object({
  name: z.string().min(1, 'Business name required'),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  taxNumber: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
})
export type SupplierFormValues = z.infer<typeof SupplierFormSchema>

// ── Purchase items ────────────────────────────────────────────────────────────

export const PurchaseItemFormSchema = z.object({
  productType: z.enum(['frame', 'lens']),
  productId: z.string().min(1, 'Product required'),
  orderedQty: z.preprocess(toNum, z.number().positive('Must be positive').int('Whole number')),
  unitCost: z.preprocess(toNum, z.number().min(0, 'Must be ≥ 0')),
  discountAmount: z.preprocess(toNumOrZero, z.number().min(0)).default(0),
  taxAmount: z.preprocess(toNumOrZero, z.number().min(0)).default(0),
})
export type PurchaseItemFormValues = z.infer<typeof PurchaseItemFormSchema>

// ── Purchase header ───────────────────────────────────────────────────────────

export const PurchaseFormSchema = z.object({
  supplierId: z.string().min(1, 'Supplier required'),
  purchaseDate: z.string().min(1, 'Date required'),
  expectedDeliveryDate: z.string().optional(),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
  discountAmount: z.preprocess(toNumOrZero, z.number().min(0)).default(0),
  taxAmount: z.preprocess(toNumOrZero, z.number().min(0)).default(0),
})
export type PurchaseFormValues = z.infer<typeof PurchaseFormSchema>

// ── Receiving ─────────────────────────────────────────────────────────────────

export const ReceivingItemSchema = z.object({
  itemId: z.string().min(1),
  qty: z.preprocess(toNumOrZero, z.number().nonnegative().int()),
})

export const ReceivingFormSchema = z.object({
  receivedDate: z.string().min(1, 'Date required'),
  items: z.array(ReceivingItemSchema),
})
export type ReceivingFormValues = z.infer<typeof ReceivingFormSchema>
