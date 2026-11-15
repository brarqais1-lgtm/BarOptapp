/**
 * BarOpt Backup & Restore Service
 *
 * Exports all IndexedDB tables to a JSON file, with:
 *   - schema version tagging
 *   - ISO-8601 timestamp
 *   - SHA-256 integrity hash of the data payload
 *
 * Designed to be extended with AES-256-GCM encryption (see encryptPayload stub).
 * Does NOT use localStorage as a database.
 */

import { db as globalDb, BarOptDB } from '../database/db'
import { CURRENT_DB_VERSION } from '../database/migrations'

export interface BackupManifest {
  appName: 'BarOpt'
  schemaVersion: number
  createdAt: string          // ISO-8601
  checksum: string           // SHA-256 hex of `data` JSON
  recordCounts: Record<string, number>
  encrypted: false           // future: true when AES-256-GCM is applied
}

export interface BackupFile {
  manifest: BackupManifest
  data: Record<string, unknown[]>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha256hex(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(text))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Stub — swap body to call WebCrypto AES-256-GCM when encryption is desired.
export async function encryptPayload(_payload: string, _password: string): Promise<string> {
  throw new Error('Encryption not yet implemented — planned for Phase 03')
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function createBackup(db: BarOptDB = globalDb): Promise<BackupFile> {
  const tableNames = [
    'patients', 'eyeExaminations', 'prescriptions',
    'patientMedicalHistory', 'patientOcularHistory', 'patientSymptoms',
    'productCategories', 'frames', 'lenses', 'inventoryMovements',
    'stocktakingSessions', 'stocktakingItems',
    'sales', 'saleItems', 'payments', 'saleReturns', 'saleReturnItems',
    'expenses', 'suppliers', 'purchases', 'purchaseItems',
    'cashTransactions', 'settings', 'auditLogs',
  ] as const

  const data: Record<string, unknown[]> = {}
  const recordCounts: Record<string, number> = {}

  for (const name of tableNames) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = (db as any)[name]
    const rows = await table.toArray()
    data[name] = rows
    recordCounts[name] = rows.length
  }

  const dataJson = JSON.stringify(data)
  const checksum = await sha256hex(dataJson)

  const manifest: BackupManifest = {
    appName: 'BarOpt',
    schemaVersion: CURRENT_DB_VERSION,
    createdAt: new Date().toISOString(),
    checksum,
    recordCounts,
    encrypted: false,
  }

  return { manifest, data }
}

export function downloadBackup(backup: BackupFile): void {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `BarOpt_backup_${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Import / Restore ──────────────────────────────────────────────────────────

export type RestoreResult =
  | { success: true; recordCounts: Record<string, number> }
  | { success: false; error: string }

export async function validateBackupFile(raw: unknown): Promise<BackupFile> {
  if (typeof raw !== 'object' || raw === null)
    throw new Error('Invalid backup: not an object')

  const file = raw as Partial<BackupFile>
  if (!file.manifest || !file.data)
    throw new Error('Invalid backup: missing manifest or data')

  const { manifest } = file
  if (manifest.appName !== 'BarOpt')
    throw new Error('Invalid backup: not a BarOpt backup file')

  if (manifest.schemaVersion > CURRENT_DB_VERSION)
    throw new Error(
      `Incompatible schema version: backup is v${manifest.schemaVersion}, app supports up to v${CURRENT_DB_VERSION}`
    )

  // Re-compute checksum to verify integrity
  const dataJson = JSON.stringify(file.data)
  const computed = await sha256hex(dataJson)
  if (computed !== manifest.checksum)
    throw new Error('Integrity check failed: backup file may be corrupted or tampered with')

  return file as BackupFile
}

export async function restoreBackup(
  backup: BackupFile,
  options: { overwrite: boolean } = { overwrite: false },
  db: BarOptDB = globalDb,
): Promise<RestoreResult> {
  if (!options.overwrite) {
    const patientCount = await db.patients.count()
    if (patientCount > 0) {
      return {
        success: false,
        error: 'Database is not empty. Pass { overwrite: true } to confirm overwrite.',
      }
    }
  }

  try {
    await db.transaction(
      'rw',
      [
        db.patients, db.eyeExaminations, db.prescriptions,
        db.patientMedicalHistory, db.patientOcularHistory, db.patientSymptoms,
        db.productCategories, db.frames, db.lenses, db.inventoryMovements,
        db.stocktakingSessions, db.stocktakingItems,
        db.sales, db.saleItems, db.payments, db.saleReturns, db.saleReturnItems,
        db.expenses, db.suppliers, db.purchases, db.purchaseItems,
        db.cashTransactions, db.settings, db.auditLogs,
      ],
      async () => {
        await db.patients.clear()
        await db.eyeExaminations.clear()
        await db.prescriptions.clear()
        await db.patientMedicalHistory.clear()
        await db.patientOcularHistory.clear()
        await db.patientSymptoms.clear()
        await db.productCategories.clear()
        await db.frames.clear()
        await db.lenses.clear()
        await db.inventoryMovements.clear()
        await db.stocktakingSessions.clear()
        await db.stocktakingItems.clear()
        await db.sales.clear()
        await db.saleItems.clear()
        await db.payments.clear()
        await db.saleReturns.clear()
        await db.saleReturnItems.clear()
        await db.expenses.clear()
        await db.suppliers.clear()
        await db.purchases.clear()
        await db.purchaseItems.clear()
        await db.cashTransactions.clear()
        await db.settings.clear()
        await db.auditLogs.clear()

        const d = backup.data
        if (d.patients)              await db.patients.bulkAdd(d.patients as never)
        if (d.eyeExaminations)       await db.eyeExaminations.bulkAdd(d.eyeExaminations as never)
        if (d.prescriptions)         await db.prescriptions.bulkAdd(d.prescriptions as never)
        if (d.patientMedicalHistory) await db.patientMedicalHistory.bulkAdd(d.patientMedicalHistory as never)
        if (d.patientOcularHistory)  await db.patientOcularHistory.bulkAdd(d.patientOcularHistory as never)
        if (d.patientSymptoms)       await db.patientSymptoms.bulkAdd(d.patientSymptoms as never)
        if (d.productCategories)     await db.productCategories.bulkAdd(d.productCategories as never)
        if (d.frames)                await db.frames.bulkAdd(d.frames as never)
        if (d.lenses)                await db.lenses.bulkAdd(d.lenses as never)
        if (d.inventoryMovements)    await db.inventoryMovements.bulkAdd(d.inventoryMovements as never)
        if (d.stocktakingSessions)   await db.stocktakingSessions.bulkAdd(d.stocktakingSessions as never)
        if (d.stocktakingItems)      await db.stocktakingItems.bulkAdd(d.stocktakingItems as never)
        if (d.sales)                 await db.sales.bulkAdd(d.sales as never)
        if (d.saleItems)             await db.saleItems.bulkAdd(d.saleItems as never)
        if (d.payments)              await db.payments.bulkAdd(d.payments as never)
        if (d.saleReturns)           await db.saleReturns.bulkAdd(d.saleReturns as never)
        if (d.saleReturnItems)       await db.saleReturnItems.bulkAdd(d.saleReturnItems as never)
        if (d.expenses)              await db.expenses.bulkAdd(d.expenses as never)
        if (d.suppliers)             await db.suppliers.bulkAdd(d.suppliers as never)
        if (d.purchases)             await db.purchases.bulkAdd(d.purchases as never)
        if (d.purchaseItems)         await db.purchaseItems.bulkAdd(d.purchaseItems as never)
        if (d.cashTransactions)      await db.cashTransactions.bulkAdd(d.cashTransactions as never)
        if (d.settings)              await db.settings.bulkAdd(d.settings as never)
        if (d.auditLogs)             await db.auditLogs.bulkAdd(d.auditLogs as never)
      }
    )

    return { success: true, recordCounts: backup.manifest.recordCounts }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
