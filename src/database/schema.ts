/**
 * BarOpt Database Schema
 * IndexedDB via Dexie.js — version-controlled, soft-delete enabled
 */

export interface BaseRecord {
  id: string            // UUID v4
  createdAt: string     // ISO-8601
  updatedAt: string     // ISO-8601
  deletedAt?: string    // ISO-8601 — null = active, set = soft-deleted
}

// ── Patients ─────────────────────────────────────────────────────────────────
export interface Patient extends BaseRecord {
  fileNumber: string        // e.g. P-000001 — unique, auto-generated, immutable
  fullName: string
  fullNameNormalized: string // lowercase for search
  phone?: string
  phoneNormalized?: string   // normalized phone for search
  phone2?: string
  email?: string
  dateOfBirth?: string
  gender?: 'male' | 'female'
  address?: string
  notes?: string
}

// ── Eye Examinations ──────────────────────────────────────────────────────────
export type ExamType = 'distance' | 'near' | 'comprehensive' | 'recheck'

export interface EyeExamination extends BaseRecord {
  patientId: string
  examinationNumber: string   // E-000001, auto-generated, immutable
  examType: ExamType
  examinedBy?: string
  examinationDate: string
  // Right eye (OD)
  reSphere?: number; reCylinder?: number; reAxis?: number; reAdd?: number
  rePrismPower?: number; rePrismBase?: string
  rePd?: number               // monocular PD right (mm)
  visualAcuityRight?: string  // aided VA (with correction)
  // Left eye (OS)
  leSphere?: number; leCylinder?: number; leAxis?: number; leAdd?: number
  lePrismPower?: number; lePrismBase?: string
  lePd?: number               // monocular PD left (mm)
  visualAcuityLeft?: string   // aided VA (with correction)
  // Binocular PD
  pdDistance?: number; pdNear?: number
  // Additional visual acuity
  unaidedVARight?: string; unaidedVALeft?: string   // without any correction
  bcvaRight?: string; bcvaLeft?: string              // best corrected VA
  // IOP (kept for future phases)
  intraocularPressureRight?: number; intraocularPressureLeft?: number
  notes?: string
}

// ── Prescriptions ─────────────────────────────────────────────────────────────
export interface Prescription extends BaseRecord {
  patientId: string
  examinationId?: string
  prescriptionNumber: string  // Rx-000001, auto-generated, immutable
  prescriptionDate: string
  examinedBy?: string
  validUntil?: string
  // Right eye (OD)
  reSphere?: number; reCylinder?: number; reAxis?: number; reAdd?: number
  rePrismPower?: number; rePrismBase?: string
  reVA?: string
  // Left eye (OS)
  leSphere?: number; leCylinder?: number; leAxis?: number; leAdd?: number
  lePrismPower?: number; lePrismBase?: string
  leVA?: string
  // PD
  pdDistance?: number; pdNear?: number
  rePd?: number; lePd?: number
  lensType?: string
  notes?: string
}

// ── Product Categories ────────────────────────────────────────────────────────
export type CategoryType = 'frame' | 'lens' | 'both'
export interface ProductCategory extends BaseRecord {
  nameAr: string
  nameEn: string
  type: CategoryType
  description?: string
}

// ── Frames ────────────────────────────────────────────────────────────────────
export interface Frame extends BaseRecord {
  sku: string
  name?: string            // product display name (added Phase 05)
  brand: string
  model?: string
  barcode?: string
  gender?: 'male' | 'female' | 'unisex' | 'kids'
  frameShape?: string      // e.g. round, square, aviator, cat-eye
  material?: string
  color?: string
  size?: string            // e.g. "54-18-140"
  frameType?: 'full' | 'half' | 'rimless'
  supplierId?: string
  categoryId?: string
  imageUrl?: string
  notes?: string
  // inventory fields (Phase 06+)
  costPrice?: number
  sellingPrice?: number
  quantity?: number
  reorderPoint?: number
}

// ── Lenses ────────────────────────────────────────────────────────────────────
export type LensType = 'single_vision' | 'bifocal' | 'progressive'
export interface Lens extends BaseRecord {
  name: string             // product display name e.g. "Essilor Varilux"
  lensType: LensType
  // legacy / optional fields
  sku?: string
  brand?: string
  model?: string
  barcode?: string
  material?: string
  coating?: string
  coatings?: string[]
  index?: number
  sphereMin?: number; sphereMax?: number
  cylinderMin?: number; cylinderMax?: number
  addMin?: number; addMax?: number
  supplierId?: string
  categoryId?: string
  imageUrl?: string
  notes?: string
  costPrice?: number
  sellingPrice?: number
  quantity?: number
  reorderPoint?: number
}

// ── Lens Variants (per-degree stock) ─────────────────────────────────────────
export interface LensVariant extends BaseRecord {
  lensId: string
  sph: number    // sphere power e.g. +1.00, -2.50
  cyl: number    // cylinder power e.g. 0.00, -0.75
  quantity: number
  price: number
}

// ── Inventory Movements ───────────────────────────────────────────────────────
export type MovementType =
  | 'purchase' | 'sale' | 'return' | 'adjustment' | 'transfer'  // legacy v1
  | 'opening' | 'stock_in' | 'stock_out'
  | 'adjustment_in' | 'adjustment_out'
  | 'damaged' | 'returned'

export interface InventoryMovement extends BaseRecord {
  itemType: 'frame' | 'lens'
  itemId: string
  movementType: MovementType
  quantity: number          // positive = in, negative = out
  quantityBefore: number
  quantityAfter: number
  movementDate: string      // actual date/time (ISO-8601) — may differ from createdAt
  reason?: string           // phase 06
  sessionId?: string        // stocktaking session reference
  referenceType?: string
  referenceId?: string
  referenceNumber?: string  // human-readable reference
  notes?: string
}

// ── Stocktaking ───────────────────────────────────────────────────────────────
export type StocktakingStatus = 'draft' | 'in_progress' | 'confirmed' | 'cancelled'

export interface StocktakingSession extends BaseRecord {
  sessionNumber: string    // ST-000001
  sessionDate: string
  status: StocktakingStatus
  notes?: string
  confirmedAt?: string
}

export interface StocktakingItem extends BaseRecord {
  sessionId: string
  productType: 'frame' | 'lens'
  productId: string
  systemQty: number         // stock captured at time of item creation
  countedQty?: number       // physical count entered by user
}

// ── Sales ─────────────────────────────────────────────────────────────────────
export type SaleStatus = 'draft' | 'confirmed' | 'ready' | 'delivered' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export interface Sale extends BaseRecord {
  saleNumber: string
  patientId?: string
  walkInName?: string        // Phase 08: walk-in customer name
  prescriptionId?: string
  status: SaleStatus
  saleDate: string           // Phase 08: actual sale date
  readyDate?: string         // Phase 09: expected date glasses will be ready
  labNotes?: string          // Phase 09: notes for the lab/workshop
  subtotal: number
  discountAmount: number
  discountPercent?: number
  taxAmount: number
  total: number
  paidAmount: number
  balanceDue: number
  paymentStatus: PaymentStatus  // Phase 08: derived status
  deliveryDate?: string
  notes?: string
}

// ── Sale Items ────────────────────────────────────────────────────────────────
export interface SaleItem extends BaseRecord {
  saleId: string
  itemType: 'frame' | 'lens' | 'service'
  itemId?: string
  description: string
  sku?: string               // Phase 08: denormalized
  quantity: number
  unitPrice: number
  discountAmount: number
  total: number
  returnedQty: number        // Phase 08: cumulative returned
}

// ── Sale Returns ──────────────────────────────────────────────────────────────
export interface SaleReturn extends BaseRecord {
  saleId: string
  returnNumber: string       // RT-000001
  returnDate: string
  reason?: string
  notes?: string
  totalRefund: number
}

export interface SaleReturnItem extends BaseRecord {
  returnId: string
  saleItemId: string
  quantity: number
  unitPrice: number
  refundAmount: number
  restockItem: boolean       // add back to inventory?
}

// ── Payments ──────────────────────────────────────────────────────────────────
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'cheque' | 'other'
export interface Payment extends BaseRecord {
  saleId: string
  amount: number
  method: PaymentMethod
  reference?: string
  paidAt: string
  notes?: string
}

// ── Expenses ──────────────────────────────────────────────────────────────────
export interface Expense extends BaseRecord {
  expenseNumber: string    // EX-000001, auto-generated
  category: string         // predefined slug e.g. 'rent', 'salary', 'utilities', 'other'
  description: string
  amount: number
  paidAt: string           // YYYY-MM-DD
  paymentMethod?: PaymentMethod
  paidBy?: string
  receiptNumber?: string
  notes?: string
}

// ── Suppliers ─────────────────────────────────────────────────────────────────
export interface Supplier extends BaseRecord {
  name: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  taxNumber?: string
  paymentTerms?: string
  notes?: string
}

// ── Purchases ─────────────────────────────────────────────────────────────────
export type PurchaseStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'
export interface Purchase extends BaseRecord {
  purchaseNumber: string
  supplierId: string
  status: PurchaseStatus
  purchaseDate?: string         // user-entered date (Phase 07+)
  expectedDeliveryDate?: string // expected delivery date
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  paidAmount: number
  balanceDue: number
  orderedAt?: string
  receivedAt?: string
  invoiceNumber?: string
  notes?: string
}

// ── Purchase Items ────────────────────────────────────────────────────────────
export interface PurchaseItem extends BaseRecord {
  purchaseId: string
  productType: 'frame' | 'lens'
  productId: string
  description: string    // denormalized: "Brand Model (SKU)"
  sku: string            // denormalized
  orderedQty: number
  receivedQty: number    // cumulative received; initially 0
  unitCost: number
  discountAmount: number // per-item discount
  taxAmount: number      // per-item tax
  lineTotal: number      // orderedQty * unitCost - discountAmount + taxAmount
}

// ── Cash Transactions ─────────────────────────────────────────────────────────
export type CashTxType = 'in' | 'out'
export interface CashTransaction extends BaseRecord {
  type: CashTxType
  amount: number
  balanceAfter: number
  referenceType?: string
  referenceId?: string
  description: string
  transactedAt: string
}

// ── Settings ──────────────────────────────────────────────────────────────────
export interface Setting extends BaseRecord {
  key: string
  value: string    // JSON-encoded
  group?: string
}

// ── Audit Logs ────────────────────────────────────────────────────────────────
export type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'login' | 'export' | 'import'
export interface AuditLog extends BaseRecord {
  action: AuditAction
  entityType: string
  entityId: string
  before?: string   // JSON snapshot
  after?: string    // JSON snapshot
  performedBy?: string
  ipAddress?: string
}

// ── Patient Medical History ───────────────────────────────────────────────────
export interface PatientMedicalHistory extends BaseRecord {
  patientId: string              // unique — one record per patient
  chronicConditions: string[]    // list of condition names
  hasDiabetes: boolean
  hasHypertension: boolean
  allergies: string[]
  medications: string[]
  previousSurgeries: string[]
  additionalNotes?: string
}

// ── Patient Ocular History ────────────────────────────────────────────────────
export interface PatientOcularHistory extends BaseRecord {
  patientId: string              // unique — one record per patient
  previousEyeConditions: string[]
  eyeSurgeries: string[]
  eyeInjuries: string[]
  previousGlasses: boolean
  previousContactLenses: boolean
  lastEyeExamDate?: string
  familyEyeHistory?: string
  additionalNotes?: string
}

// ── Current Symptoms ──────────────────────────────────────────────────────────
export type EyeSide = 'OD' | 'OS' | 'OU'
export type SymptomType =
  | 'blurry_vision' | 'headache' | 'eye_strain'
  | 'near_difficulty' | 'far_difficulty'
  | 'photophobia' | 'dry_eye' | 'other'

export interface PatientSymptom extends BaseRecord {
  patientId: string
  symptomType: SymptomType
  eye: EyeSide
  onsetDate?: string
  description?: string
}

// ── Dexie table-to-type mapping ───────────────────────────────────────────────
export interface BarOptSchema {
  patients: Patient
  eyeExaminations: EyeExamination
  prescriptions: Prescription
  patientMedicalHistory: PatientMedicalHistory
  patientOcularHistory: PatientOcularHistory
  patientSymptoms: PatientSymptom
  productCategories: ProductCategory
  frames: Frame
  lenses: Lens
  inventoryMovements: InventoryMovement
  stocktakingSessions: StocktakingSession
  stocktakingItems: StocktakingItem
  sales: Sale
  saleItems: SaleItem
  payments: Payment
  saleReturns: SaleReturn
  saleReturnItems: SaleReturnItem
  expenses: Expense
  suppliers: Supplier
  purchases: Purchase
  purchaseItems: PurchaseItem
  cashTransactions: CashTransaction
  settings: Setting
  auditLogs: AuditLog
}
