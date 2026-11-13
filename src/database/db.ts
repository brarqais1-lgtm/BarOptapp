import Dexie, { type Table } from 'dexie'
import type {
  Patient, EyeExamination, Prescription,
  PatientMedicalHistory, PatientOcularHistory, PatientSymptom,
  ProductCategory, Frame, Lens, InventoryMovement,
  StocktakingSession, StocktakingItem,
  Sale, SaleItem, Payment, SaleReturn, SaleReturnItem,
  Expense, Supplier, Purchase, PurchaseItem,
  CashTransaction, Setting, AuditLog,
} from './schema'

export class BarOptDB extends Dexie {
  patients!: Table<Patient>
  eyeExaminations!: Table<EyeExamination>
  prescriptions!: Table<Prescription>
  patientMedicalHistory!: Table<PatientMedicalHistory>
  patientOcularHistory!: Table<PatientOcularHistory>
  patientSymptoms!: Table<PatientSymptom>
  productCategories!: Table<ProductCategory>
  frames!: Table<Frame>
  lenses!: Table<Lens>
  inventoryMovements!: Table<InventoryMovement>
  stocktakingSessions!: Table<StocktakingSession>
  stocktakingItems!: Table<StocktakingItem>
  sales!: Table<Sale>
  saleItems!: Table<SaleItem>
  payments!: Table<Payment>
  saleReturns!: Table<SaleReturn>
  saleReturnItems!: Table<SaleReturnItem>
  expenses!: Table<Expense>
  suppliers!: Table<Supplier>
  purchases!: Table<Purchase>
  purchaseItems!: Table<PurchaseItem>
  cashTransactions!: Table<CashTransaction>
  settings!: Table<Setting>
  auditLogs!: Table<AuditLog>

  constructor() {
    super('BarOptDB')

    // ── Version 1: Initial schema ─────────────────────────────────────────────
    this.version(1).stores({
      patients:
        'id, phone, [deletedAt+createdAt], createdAt',
      eyeExaminations:
        'id, patientId, examinationDate, [patientId+examinationDate], deletedAt',
      prescriptions:
        'id, patientId, examinationId, deletedAt, createdAt',
      frames:
        'id, sku, brand, supplierId, barcode, deletedAt, [deletedAt+brand]',
      lenses:
        'id, sku, brand, supplierId, barcode, deletedAt, [deletedAt+brand]',
      inventoryMovements:
        'id, itemType, itemId, movementType, [itemType+itemId], createdAt',
      sales:
        'id, saleNumber, patientId, status, [status+createdAt], deletedAt, createdAt',
      saleItems:
        'id, saleId, itemType, itemId, [saleId+itemType]',
      payments:
        'id, saleId, method, paidAt, deletedAt',
      expenses:
        'id, category, paidAt, deletedAt, createdAt',
      suppliers:
        'id, name, deletedAt',
      purchases:
        'id, purchaseNumber, supplierId, status, deletedAt, createdAt',
      cashTransactions:
        'id, type, referenceType, referenceId, transactedAt, createdAt',
      settings:
        'id, key, &[key+group]',
      auditLogs:
        'id, action, entityType, entityId, [entityType+entityId], createdAt',
    })

    // ── Version 2: Add fileNumber + search indexes to patients ────────────────
    this.version(2).stores({
      patients:
        'id, &fileNumber, phone, phoneNormalized, fullNameNormalized, [deletedAt+createdAt], createdAt',
    }).upgrade(async tx => {
      const existing = await tx.table('patients').toArray()
      let seq = 0
      for (const p of existing) {
        if (!p.fileNumber) {
          seq++
          await tx.table('patients').update(p.id, {
            fileNumber: `P-${String(seq).padStart(6, '0')}`,
            fullNameNormalized: (p.fullName ?? '').toLowerCase(),
            phoneNormalized: p.phone ?? '',
          })
        }
      }
      const setting = await tx.table('settings').where('key').equals('patient_sequence').first()
      if (setting) {
        await tx.table('settings').update(setting.id, { value: JSON.stringify(seq) })
      }
    })

    // ── Version 3: examinationNumber + examType on examinations; prescriptionNumber on prescriptions ──
    this.version(3).stores({
      eyeExaminations:
        'id, &examinationNumber, patientId, examType, examinationDate, [patientId+examinationDate], deletedAt',
      prescriptions:
        'id, &prescriptionNumber, patientId, examinationId, deletedAt, createdAt',
    }).upgrade(async tx => {
      const exams = await tx.table('eyeExaminations').toArray()
      let eSeq = 0
      for (const e of exams) {
        if (!e.examinationNumber) {
          eSeq++
          await tx.table('eyeExaminations').update(e.id, {
            examinationNumber: `E-${String(eSeq).padStart(6, '0')}`,
            examType: e.examType ?? 'comprehensive',
          })
        }
      }
      const rxs = await tx.table('prescriptions').toArray()
      let rSeq = 0
      for (const rx of rxs) {
        if (!rx.prescriptionNumber) {
          rSeq++
          await tx.table('prescriptions').update(rx.id, {
            prescriptionNumber: `Rx-${String(rSeq).padStart(6, '0')}`,
            prescriptionDate: rx.prescriptionDate ?? rx.createdAt,
          })
        }
      }
    })

    // ── Version 4: Patient Medical & Ocular History + Symptoms ───────────────
    this.version(4).stores({
      patientMedicalHistory:
        'id, &patientId, updatedAt, deletedAt',
      patientOcularHistory:
        'id, &patientId, updatedAt, deletedAt',
      patientSymptoms:
        'id, patientId, symptomType, createdAt, deletedAt',
    })

    // ── Version 5: Product Catalog — Frames, Lenses, Categories ─────────────
    this.version(5).stores({
      productCategories:
        'id, type, deletedAt',
      frames:
        'id, sku, brand, supplierId, barcode, categoryId, deletedAt, [deletedAt+brand]',
      lenses:
        'id, sku, brand, lensType, supplierId, barcode, categoryId, deletedAt, [deletedAt+brand]',
    }).upgrade(async tx => {
      const now = new Date().toISOString()
      const frames = await tx.table('frames').toArray()
      for (const f of frames) {
        if (!f.name) {
          const name = [f.brand, f.model].filter(Boolean).join(' ') || f.sku
          await tx.table('frames').update(f.id, { name, updatedAt: now })
        }
      }
      const lenses = await tx.table('lenses').toArray()
      for (const l of lenses) {
        if (!l.name) {
          const name = [l.brand, l.lensType].filter(Boolean).join(' ') || l.sku
          await tx.table('lenses').update(l.id, { name, updatedAt: now })
        }
      }
    })

    // ── Version 7: Suppliers & Purchase Orders ───────────────────────────────
    this.version(7).stores({
      purchases:
        'id, &purchaseNumber, supplierId, status, purchaseDate, deletedAt, createdAt',
      purchaseItems:
        'id, purchaseId, productType, productId, [purchaseId+productType]',
      inventoryMovements:
        'id, itemType, itemId, movementType, [itemType+itemId], movementDate, sessionId, referenceId, createdAt',
    }).upgrade(async tx => {
      const now = new Date().toISOString()
      const purchases = await tx.table('purchases').toArray()
      for (const p of purchases) {
        if (!p.purchaseDate) {
          await tx.table('purchases').update(p.id, { purchaseDate: p.createdAt ?? now })
        }
      }
    })

    // ── Version 8: Sales & Invoicing ─────────────────────────────────────────
    this.version(8).stores({
      sales:
        'id, &saleNumber, patientId, status, saleDate, paymentStatus, deletedAt, createdAt',
      saleItems:
        'id, saleId, itemType, itemId, [saleId+itemType]',
      payments:
        'id, saleId, method, paidAt, deletedAt',
      saleReturns:
        'id, &returnNumber, saleId, returnDate, createdAt',
      saleReturnItems:
        'id, returnId, saleItemId, createdAt',
    }).upgrade(async tx => {
      const now = new Date().toISOString()
      const sales = await tx.table('sales').toArray()
      for (const s of sales) {
        const patch: Record<string, unknown> = {}
        if (!s.saleDate) patch.saleDate = s.createdAt ?? now
        if (!s.paymentStatus) {
          const paid = s.paidAmount ?? 0
          const total = s.total ?? 0
          patch.paymentStatus = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
        }
        if (Object.keys(patch).length) await tx.table('sales').update(s.id, patch)
      }
      const saleItems = await tx.table('saleItems').toArray()
      for (const i of saleItems) {
        if (i.returnedQty == null) await tx.table('saleItems').update(i.id, { returnedQty: 0 })
      }
    })

    // ── Version 9: Glasses Order Management (readyDate, labNotes) ───────────
    this.version(9).stores({
      sales:
        'id, &saleNumber, patientId, status, saleDate, readyDate, paymentStatus, deletedAt, createdAt',
    })

    // ── Version 10: Expenses — add expenseNumber unique index ─────────────────
    this.version(10).stores({
      expenses:
        'id, &expenseNumber, category, paidAt, paymentMethod, deletedAt, createdAt',
    })

    // ── Version 6: Inventory & Stocktaking ────────────────────────────────────
    this.version(6).stores({
      inventoryMovements:
        'id, itemType, itemId, movementType, [itemType+itemId], movementDate, sessionId, createdAt',
      stocktakingSessions:
        'id, &sessionNumber, status, sessionDate, createdAt',
      stocktakingItems:
        'id, sessionId, productType, productId, [sessionId+productId]',
    }).upgrade(async tx => {
      const now = new Date().toISOString()
      // Set movementDate for all existing movements (use createdAt)
      const movements = await tx.table('inventoryMovements').toArray()
      for (const m of movements) {
        if (!m.movementDate) {
          await tx.table('inventoryMovements').update(m.id, { movementDate: m.createdAt })
        }
      }
      // Initialize quantity = 0 for all frames/lenses that don't have it yet
      const frames = await tx.table('frames').toArray()
      for (const f of frames) {
        if (f.quantity == null) {
          await tx.table('frames').update(f.id, { quantity: 0, reorderPoint: f.reorderPoint ?? 0, updatedAt: now })
        }
      }
      const lenses = await tx.table('lenses').toArray()
      for (const l of lenses) {
        if (l.quantity == null) {
          await tx.table('lenses').update(l.id, { quantity: 0, reorderPoint: l.reorderPoint ?? 0, updatedAt: now })
        }
      }
    })
  }
}

export const db = new BarOptDB()

// ── Re-export types for convenience ──────────────────────────────────────────
export type {
  Patient, EyeExamination, Prescription,
  PatientMedicalHistory, PatientOcularHistory, PatientSymptom,
  ProductCategory, Frame, Lens, InventoryMovement,
  StocktakingSession, StocktakingItem,
  Sale, SaleItem, Payment, SaleReturn, SaleReturnItem,
  PaymentStatus,
  Expense, Supplier, Purchase, PurchaseItem,
  CashTransaction, Setting, AuditLog,
} from './schema'
