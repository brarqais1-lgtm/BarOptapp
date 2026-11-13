/**
 * Migration registry — each entry maps a Dexie version to a description.
 * Actual schema changes live in db.ts as `this.version(N).stores(...)`.
 *
 * Version history:
 *   1 — Initial schema (all 15 tables)
 *   2 — Add fileNumber (unique), fullNameNormalized, phoneNormalized to patients
 */

export const MIGRATIONS: Record<number, string> = {
  1: 'Initial schema: patients, examinations, prescriptions, frames, lenses, inventory, sales, payments, expenses, suppliers, purchases, cash, settings, audit',
  2: 'Patients: add fileNumber (unique), fullNameNormalized, phoneNormalized for search',
  3: 'EyeExaminations: add examinationNumber (unique), examType, prism, unaidedVA, bcva fields; Prescriptions: add prescriptionNumber (unique), prescriptionDate, examinedBy, prism, PD, VA fields',
  4: 'Add patientMedicalHistory, patientOcularHistory, patientSymptoms tables for Patient Medical & Ocular History module',
  5: 'Catalog: add productCategories table; extend frames (name, frameShape, categoryId) and lenses (name, model, addMin, addMax, coatings, categoryId)',
  6: 'Inventory: extend inventoryMovements (movementDate, reason, sessionId, referenceNumber); add stocktakingSessions, stocktakingItems tables; initialize quantity=0 on existing products',
  7: 'Purchases: add purchaseItems table; extend purchases (purchaseDate, expectedDeliveryDate, unique purchaseNumber); add referenceId index on inventoryMovements',
  8: 'Sales: extend sales (saleDate, paymentStatus, walkInName, unique saleNumber); extend saleItems (returnedQty, sku); add saleReturns, saleReturnItems tables',
  9: 'Orders: extend sales (readyDate, labNotes) for glasses order management; add readyDate index',
  10: 'Expenses: add expenseNumber (unique) and paymentMethod fields; add unique expenseNumber index',
}

export const CURRENT_DB_VERSION = 10
