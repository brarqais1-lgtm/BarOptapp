/**
 * Phase 01 Tests — Database, CRUD, Migrations, Backup/Restore
 *
 * All tests run against fake-indexeddb (in-memory) — no server required.
 * Each test suite opens a fresh BarOptDB instance to prevent cross-contamination.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BarOptDB } from '../src/database/db'
import { CURRENT_DB_VERSION, MIGRATIONS } from '../src/database/migrations'
import { BaseRepository } from '../src/database/repositories/base.repository'
import {
  createBackup,
  restoreBackup,
  validateBackupFile,
} from '../src/services/backup.service'
import type { Patient } from '../src/database/schema'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePatient(overrides: Partial<Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<Patient, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    fullName: 'Ahmed Al-Rashidi',
    phone: '0501234567',
    gender: 'male',
    ...overrides,
  }
}

// Each test suite gets a fresh database instance using fake-indexeddb
function createTestDB() {
  return new BarOptDB()
}

// ── 1. Schema & DB Version ────────────────────────────────────────────────────

describe('Database Schema', () => {
  let testDb: BarOptDB

  beforeEach(() => { testDb = createTestDB() })
  afterEach(async () => { await testDb.close(); testDb.delete() })

  it('opens the database successfully', async () => {
    await expect(testDb.open()).resolves.not.toThrow()
  })

  it(`is at schema version ${CURRENT_DB_VERSION}`, async () => {
    await testDb.open()
    expect(testDb.verno).toBe(CURRENT_DB_VERSION)
  })

  it('migration registry matches DB version', () => {
    expect(Object.keys(MIGRATIONS).map(Number)).toContain(CURRENT_DB_VERSION)
  })

  it('has all required tables', async () => {
    await testDb.open()
    const tables = testDb.tables.map(t => t.name).sort()
    const expected = [
      'auditLogs', 'cashTransactions', 'expenses',
      'eyeExaminations', 'frames', 'inventoryMovements',
      'lenses', 'patients', 'payments', 'prescriptions',
      'purchases', 'saleItems', 'sales', 'settings', 'suppliers',
      'patientMedicalHistory', 'patientOcularHistory', 'patientSymptoms',
      'productCategories', 'stocktakingSessions', 'stocktakingItems',
      'purchaseItems',
      'saleReturns', 'saleReturnItems',
      'lensVariants',
    ].sort()
    expect(tables).toEqual(expected)
  })
})

// ── 2. CRUD Operations ────────────────────────────────────────────────────────

describe('Patient CRUD', () => {
  let testDb: BarOptDB
  let repo: BaseRepository<Patient>

  beforeEach(async () => {
    testDb = createTestDB()
    await testDb.open()
    repo = new BaseRepository<Patient>(testDb.patients)
  })
  afterEach(async () => { await testDb.close(); testDb.delete() })

  it('creates a patient with auto-generated UUID', async () => {
    const p = await repo.create(makePatient())
    expect(p.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(p.createdAt).toBeTruthy()
    expect(p.updatedAt).toBeTruthy()
  })

  it('reads a patient by id', async () => {
    const created = await repo.create(makePatient({ fullName: 'Fatima Hassan' }))
    const found = await repo.findById(created.id)
    expect(found?.fullName).toBe('Fatima Hassan')
  })

  it('updates a patient', async () => {
    const created = await repo.create(makePatient())
    const updated = await repo.update(created.id, { phone: '0599999999' })
    expect(updated.phone).toBe('0599999999')
    expect(updated.updatedAt >= created.updatedAt).toBe(true)
  })

  it('soft-deletes a patient (sets deletedAt, keeps record)', async () => {
    const created = await repo.create(makePatient())
    await repo.softDelete(created.id)
    const found = await repo.findById(created.id)
    expect(found?.deletedAt).toBeTruthy()
  })

  it('excludes soft-deleted patients from findAll', async () => {
    const p1 = await repo.create(makePatient({ fullName: 'Active' }))
    const p2 = await repo.create(makePatient({ fullName: 'Deleted' }))
    await repo.softDelete(p2.id)
    const active = await repo.findAll()
    expect(active.some(p => p.id === p1.id)).toBe(true)
    expect(active.some(p => p.id === p2.id)).toBe(false)
  })

  it('restores a soft-deleted patient', async () => {
    const created = await repo.create(makePatient())
    await repo.softDelete(created.id)
    await repo.restore(created.id)
    const found = await repo.findById(created.id)
    expect(found?.deletedAt).toBeUndefined()
  })

  it('counts only active records by default', async () => {
    await repo.create(makePatient())
    const p2 = await repo.create(makePatient())
    await repo.softDelete(p2.id)
    expect(await repo.count()).toBe(1)
    expect(await repo.count(true)).toBe(2)
  })

  it('hard-deletes a patient permanently', async () => {
    const created = await repo.create(makePatient())
    await repo.hardDelete(created.id)
    const found = await repo.findById(created.id)
    expect(found).toBeUndefined()
  })
})

// ── 3. Multi-table integrity ──────────────────────────────────────────────────

describe('Multi-table operations', () => {
  let testDb: BarOptDB

  beforeEach(async () => {
    testDb = createTestDB()
    await testDb.open()
  })
  afterEach(async () => { await testDb.close(); testDb.delete() })

  it('stores and retrieves records across multiple tables', async () => {
    const patientRepo = new BaseRepository(testDb.patients)
    const supplierRepo = new BaseRepository(testDb.suppliers)
    const frameRepo = new BaseRepository(testDb.frames)

    const patient = await patientRepo.create(makePatient())
    const supplier = await supplierRepo.create({ name: 'Silhouette GmbH', phone: '+43123456' })
    const frame = await frameRepo.create({
      sku: 'SIL-001', brand: 'Silhouette', costPrice: 150, sellingPrice: 320,
      quantity: 10, reorderPoint: 2,
      supplierId: supplier.id,
    })

    expect(await patientRepo.count()).toBe(1)
    expect(await supplierRepo.count()).toBe(1)
    expect(await frameRepo.count()).toBe(1)
    expect(frame.supplierId).toBe(supplier.id)
    expect(patient.id).toBeTruthy()
  })

  it('stores settings as key-value pairs', async () => {
    const settingRepo = new BaseRepository(testDb.settings)
    await settingRepo.create({ key: 'currency', value: JSON.stringify('SAR'), group: 'financial' })
    await settingRepo.create({ key: 'language', value: JSON.stringify('ar'), group: 'display' })
    const all = await settingRepo.findAll()
    expect(all).toHaveLength(2)
    const currency = all.find(s => s.key === 'currency')
    expect(JSON.parse(currency!.value)).toBe('SAR')
  })
})

// ── 4. Data Persistence simulation ───────────────────────────────────────────

describe('Data persistence across DB re-open', () => {
  it('retains data after closing and reopening the DB', async () => {
    // fake-indexeddb is in-memory per process, but persisting across
    // close/open within the same fake-indexeddb instance is valid behaviour.
    const db1 = createTestDB()
    await db1.open()
    const repo1 = new BaseRepository<Patient>(db1.patients)
    const created = await repo1.create(makePatient({ fullName: 'Persistent Patient' }))
    await db1.close()

    // Re-open the same named DB
    const db2 = new BarOptDB()
    await db2.open()
    const repo2 = new BaseRepository<Patient>(db2.patients)
    const found = await repo2.findById(created.id)
    // fake-indexeddb shares in-memory state within the same DB name in a process
    expect(found?.fullName).toBe('Persistent Patient')
    await db2.close()
    db2.delete()
    db1.delete()
  })
})

// ── 5. Backup & Restore ───────────────────────────────────────────────────────

describe('Backup Service', () => {
  let testDb: BarOptDB

  beforeEach(async () => {
    testDb = createTestDB()
    await testDb.open()
  })
  afterEach(async () => { await testDb.close(); testDb.delete() })

  it('creates a backup with valid manifest', async () => {
    // Insert some data first
    const repo = new BaseRepository<Patient>(testDb.patients)
    await repo.create(makePatient({ fullName: 'Backup Test Patient' }))

    const backup = await createBackup(testDb)
    expect(backup.manifest.appName).toBe('BarOpt')
    expect(backup.manifest.schemaVersion).toBe(CURRENT_DB_VERSION)
    expect(backup.manifest.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(backup.manifest.encrypted).toBe(false)
    expect(backup.manifest.createdAt).toBeTruthy()
  })

  it('backup contains core table keys', async () => {
    const backup = await createBackup(testDb)
    const tableKeys = Object.keys(backup.data)
    const expected = [
      'auditLogs', 'cashTransactions', 'expenses',
      'eyeExaminations', 'frames', 'inventoryMovements',
      'lenses', 'patients', 'payments', 'prescriptions',
      'purchases', 'saleItems', 'sales', 'settings', 'suppliers',
    ]
    expected.forEach(key => expect(tableKeys).toContain(key))
  })

  it('validates a valid backup file', async () => {
    const backup = await createBackup(testDb)
    await expect(validateBackupFile(backup)).resolves.toBeTruthy()
  })

  it('rejects a backup with wrong appName', async () => {
    const backup = await createBackup(testDb)
    const tampered = { ...backup, manifest: { ...backup.manifest, appName: 'Other' } }
    await expect(validateBackupFile(tampered)).rejects.toThrow('not a BarOpt backup')
  })

  it('rejects a backup with incompatible schema version', async () => {
    const backup = await createBackup(testDb)
    const future = { ...backup, manifest: { ...backup.manifest, schemaVersion: 999 } }
    await expect(validateBackupFile(future)).rejects.toThrow('Incompatible schema version')
  })

  it('rejects a tampered backup (bad checksum)', async () => {
    const backup = await createBackup(testDb)
    const tampered = { ...backup, manifest: { ...backup.manifest, checksum: 'deadbeef' } }
    await expect(validateBackupFile(tampered)).rejects.toThrow('Integrity check failed')
  })

  it('restores data from a backup (overwrite)', async () => {
    const repo = new BaseRepository<Patient>(testDb.patients)
    await repo.create(makePatient({ fullName: 'Original Patient' }))

    const backup = await createBackup(testDb)

    // Clear + restore
    await testDb.patients.clear()
    const result = await restoreBackup(backup, { overwrite: true }, testDb)
    expect(result.success).toBe(true)

    const restored = await testDb.patients.toArray()
    expect(restored.some(p => p.fullName === 'Original Patient')).toBe(true)
  })

  it('refuses to restore without overwrite flag when DB has data', async () => {
    const repo = new BaseRepository<Patient>(testDb.patients)
    await repo.create(makePatient())

    const backup = await createBackup(testDb)
    // Try restore without overwrite
    const result = await restoreBackup(backup, { overwrite: false }, testDb)
    expect(result.success).toBe(false)
    expect((result as { success: false; error: string }).error).toMatch(/not empty/)
  })

  it('backup record counts match actual DB counts', async () => {
    const repo = new BaseRepository<Patient>(testDb.patients)
    await repo.create(makePatient({ fullName: 'P1' }))
    await repo.create(makePatient({ fullName: 'P2' }))

    const backup = await createBackup(testDb)
    expect(backup.manifest.recordCounts.patients).toBe(2)
  })
})

// ── 6. Zod schema validation stub ────────────────────────────────────────────

describe('Input validation with Zod', () => {
  it('validates required patient fields', async () => {
    const { z } = await import('zod')
    const PatientSchema = z.object({
      fullName: z.string().min(1, 'Name required'),
      phone: z.string().optional(),
      gender: z.enum(['male', 'female']).optional(),
    })

    const valid = PatientSchema.safeParse({ fullName: 'Ahmed', gender: 'male' })
    expect(valid.success).toBe(true)

    const invalid = PatientSchema.safeParse({ fullName: '' })
    expect(invalid.success).toBe(false)
  })
})
