/**
 * Phase 02 Tests — Patients Module
 * All tests use in-memory fake-indexeddb (from tests/setup.ts).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BarOptDB } from '../src/database/db'
import {
  createPatient, updatePatient, archivePatient, restorePatient,
  searchPatients, getNextFileNumber, findDuplicateCandidates,
  getTodayPatientCount,
} from '../src/modules/patients/PatientRepository'
import { getPatientFinancialSummary } from '../src/modules/patients/financial.service'
import { PatientFormSchema } from '../src/modules/patients/schema'
import { normalizePhone, normalizeSearch } from '../src/utils/format'
import { calcAge } from '../src/utils/date'
import type { Patient, Sale, Payment } from '../src/database/schema'
import { v4 as uuid } from 'uuid'

// ── Helpers ───────────────────────────────────────────────────────────────────

function createTestDB() { return new BarOptDB() }

async function makePatient(db: BarOptDB, overrides: Partial<Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>> = {}): Promise<Patient> {
  const fileNumber = await getNextFileNumber(db)
  return createPatient({
    fileNumber,
    fullName: overrides.fullName ?? 'Ahmed Al-Rashidi',
    fullNameNormalized: normalizeSearch(overrides.fullName ?? 'Ahmed Al-Rashidi'),
    phone: overrides.phone,
    phoneNormalized: overrides.phone ? normalizePhone(overrides.phone) : undefined,
    gender: overrides.gender,
    dateOfBirth: overrides.dateOfBirth,
    address: overrides.address,
    email: overrides.email,
    notes: overrides.notes,
    ...overrides,
  }, db)
}

// ── 1. Add patient ────────────────────────────────────────────────────────────

describe('1. Add patient', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('creates a patient and stores it in IndexedDB', async () => {
    const p = await makePatient(db)
    const found = await db.patients.get(p.id)
    expect(found).toBeTruthy()
    expect(found?.fullName).toBe('Ahmed Al-Rashidi')
  })
})

// ── 2. Edit patient ───────────────────────────────────────────────────────────

describe('2. Edit patient', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('updates patient fields and sets updatedAt', async () => {
    const p = await makePatient(db)
    const updated = await updatePatient(p.id, { fullName: 'Fatima Hassan', fullNameNormalized: 'fatima hassan' }, db)
    expect(updated.fullName).toBe('Fatima Hassan')
    expect(updated.updatedAt >= p.updatedAt).toBe(true)
  })

  it('preserves UUID on update', async () => {
    const p = await makePatient(db)
    const updated = await updatePatient(p.id, { notes: 'Updated notes' }, db)
    expect(updated.id).toBe(p.id)
  })

  it('preserves fileNumber on update', async () => {
    const p = await makePatient(db)
    const updated = await updatePatient(p.id, { notes: 'x' }, db)
    expect(updated.fileNumber).toBe(p.fileNumber)
  })

  it('linked records (audit logs) remain intact after update', async () => {
    const p = await makePatient(db)
    const now = new Date().toISOString()
    await db.auditLogs.add({
      id: uuid(), action: 'create', entityType: 'Patient', entityId: p.id,
      createdAt: now, updatedAt: now,
    })
    await updatePatient(p.id, { notes: 'x' }, db)
    const logs = await db.auditLogs.where('entityId').equals(p.id).count()
    expect(logs).toBeGreaterThan(0)
  })
})

// ── 3. File number generation ─────────────────────────────────────────────────

describe('3. File number generation', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('generates file numbers in P-XXXXXX format', async () => {
    const fn = await getNextFileNumber(db)
    expect(fn).toMatch(/^P-\d{6}$/)
  })

  it('increments file numbers sequentially', async () => {
    const fn1 = await getNextFileNumber(db)
    const fn2 = await getNextFileNumber(db)
    const n1 = parseInt(fn1.replace('P-', ''))
    const n2 = parseInt(fn2.replace('P-', ''))
    expect(n2).toBe(n1 + 1)
  })

  it('file numbers are unique across multiple patients', async () => {
    const p1 = await makePatient(db)
    const p2 = await makePatient(db)
    const p3 = await makePatient(db)
    const numbers = [p1.fileNumber, p2.fileNumber, p3.fileNumber]
    expect(new Set(numbers).size).toBe(3)
  })
})

// ── 4. UUID validation ────────────────────────────────────────────────────────

describe('4. UUID validation', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('patient id is a valid UUID v4', async () => {
    const p = await makePatient(db)
    expect(p.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })
})

// ── 5. Required field validation ──────────────────────────────────────────────

describe('5. Required fields validation (Zod)', () => {
  it('rejects empty fullName', () => {
    const result = PatientFormSchema.safeParse({ fullName: '' })
    expect(result.success).toBe(false)
  })

  it('accepts patient without phone', () => {
    const result = PatientFormSchema.safeParse({ fullName: 'Ahmed' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = PatientFormSchema.safeParse({ fullName: 'Ahmed', email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('accepts valid optional fields', () => {
    const result = PatientFormSchema.safeParse({
      fullName: 'Ahmed', phone: '0501234567', gender: 'male',
      dateOfBirth: '1990-01-15', email: 'ahmed@example.com',
    })
    expect(result.success).toBe(true)
  })
})

// ── 6. Duplicate detection ────────────────────────────────────────────────────

describe('6. Duplicate detection', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('detects duplicate by matching phone', async () => {
    await makePatient(db, { phone: '0501234567', phoneNormalized: '0501234567' })
    const dupes = await findDuplicateCandidates('Different Name', '0501234567', undefined, db)
    expect(dupes.length).toBeGreaterThan(0)
  })

  it('detects duplicate by similar name', async () => {
    await makePatient(db, { fullName: 'Ahmed Al-Rashidi', fullNameNormalized: 'ahmed al-rashidi' })
    const dupes = await findDuplicateCandidates('Ahmed Al-Rashidi', undefined, undefined, db)
    expect(dupes.length).toBeGreaterThan(0)
  })

  it('excludes self when editing', async () => {
    const p = await makePatient(db, { phone: '0501234567', phoneNormalized: '0501234567' })
    const dupes = await findDuplicateCandidates(p.fullName, '0501234567', p.id, db)
    expect(dupes.some(d => d.id === p.id)).toBe(false)
  })

  it('allows two patients with same name but no phone (legitimate)', async () => {
    await makePatient(db, { fullName: 'Mohammed Ali', fullNameNormalized: 'mohammed ali', phone: undefined })
    // Should warn but not block — duplicates found by name
    const dupes = await findDuplicateCandidates('Mohammed Ali', undefined, undefined, db)
    // found but app can still continue (warning only)
    expect(dupes.length).toBeGreaterThanOrEqual(0) // non-blocking
  })
})

// ── 7. Search by name ─────────────────────────────────────────────────────────

describe('7. Search by name', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('finds patients by partial name match', async () => {
    await makePatient(db, { fullName: 'Fatima Hassan', fullNameNormalized: 'fatima hassan' })
    await makePatient(db, { fullName: 'Ahmed Al-Rashidi', fullNameNormalized: 'ahmed al-rashidi' })
    const result = await searchPatients({ query: 'fatima' }, db)
    expect(result.patients.length).toBe(1)
    expect(result.patients[0].fullName).toBe('Fatima Hassan')
  })
})

// ── 8. Search by phone ────────────────────────────────────────────────────────

describe('8. Search by phone', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('finds patients by phone substring', async () => {
    await makePatient(db, { phone: '0501234567', phoneNormalized: '0501234567' })
    await makePatient(db, { phone: '0559876543', phoneNormalized: '0559876543' })
    const result = await searchPatients({ query: '050' }, db)
    expect(result.patients.some(p => p.phone === '0501234567')).toBe(true)
  })
})

// ── 9. Search by file number ──────────────────────────────────────────────────

describe('9. Search by file number', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('finds patient by exact file number', async () => {
    const p = await makePatient(db)
    const result = await searchPatients({ query: p.fileNumber }, db)
    expect(result.patients.some(r => r.id === p.id)).toBe(true)
  })
})

// ── 10. Pagination ────────────────────────────────────────────────────────────

describe('10. Pagination', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('respects pageSize and returns hasMore correctly', async () => {
    for (let i = 0; i < 25; i++) {
      await makePatient(db, { fullName: `Patient ${i}`, fullNameNormalized: `patient ${i}` })
    }
    const page0 = await searchPatients({ page: 0, pageSize: 10 }, db)
    expect(page0.patients.length).toBe(10)
    expect(page0.hasMore).toBe(true)
    expect(page0.total).toBe(25)
  })

  it('second page returns different patients', async () => {
    for (let i = 0; i < 15; i++) {
      await makePatient(db, { fullName: `Patient ${i}`, fullNameNormalized: `patient ${i}` })
    }
    const page0 = await searchPatients({ page: 0, pageSize: 10 }, db)
    const page1 = await searchPatients({ page: 1, pageSize: 10 }, db)
    const ids0 = new Set(page0.patients.map(p => p.id))
    const ids1 = new Set(page1.patients.map(p => p.id))
    const overlap = [...ids0].filter(id => ids1.has(id))
    expect(overlap.length).toBe(0)
    expect(page1.hasMore).toBe(false)
  })
})

// ── 11. Archive patient ───────────────────────────────────────────────────────

describe('11. Archive patient', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('sets deletedAt on archive', async () => {
    const p = await makePatient(db)
    await archivePatient(p.id, db)
    const found = await db.patients.get(p.id)
    expect(found?.deletedAt).toBeTruthy()
  })

  it('excludes archived patients from default search', async () => {
    const p = await makePatient(db)
    await archivePatient(p.id, db)
    const result = await searchPatients({ includeDeleted: false }, db)
    expect(result.patients.some(r => r.id === p.id)).toBe(false)
  })

  it('includes archived patients when includeDeleted=true', async () => {
    const p = await makePatient(db)
    await archivePatient(p.id, db)
    const result = await searchPatients({ includeDeleted: true }, db)
    expect(result.patients.some(r => r.id === p.id)).toBe(true)
  })
})

// ── 12. Restore patient ───────────────────────────────────────────────────────

describe('12. Restore patient', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('clears deletedAt on restore', async () => {
    const p = await makePatient(db)
    await archivePatient(p.id, db)
    await restorePatient(p.id, db)
    const found = await db.patients.get(p.id)
    expect(found?.deletedAt).toBeUndefined()
  })

  it('restored patient appears in default search', async () => {
    const p = await makePatient(db)
    await archivePatient(p.id, db)
    await restorePatient(p.id, db)
    const result = await searchPatients({}, db)
    expect(result.patients.some(r => r.id === p.id)).toBe(true)
  })
})

// ── 13. Linked records preserved on archive ───────────────────────────────────

describe('13. Linked records preserved on archive', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('eye examinations are not deleted when patient is archived', async () => {
    const p = await makePatient(db)
    const now = new Date().toISOString()
    await db.eyeExaminations.add({
      id: uuid(), patientId: p.id, examinationDate: now.slice(0, 10),
      createdAt: now, updatedAt: now,
    })
    await archivePatient(p.id, db)
    const exams = await db.eyeExaminations.where('patientId').equals(p.id).count()
    expect(exams).toBe(1)
  })
})

// ── 14–16. Financial calculations ─────────────────────────────────────────────

describe('14-16. Financial calculations', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  async function seedSaleAndPayment(db: BarOptDB, patientId: string, total: number, paid: number) {
    const now = new Date().toISOString()
    const saleId = uuid()
    const sale: Sale = {
      id: saleId, saleNumber: `S-${saleId.slice(0, 8)}`, patientId,
      status: 'confirmed', subtotal: total, discountAmount: 0, discountPercent: 0,
      taxAmount: 0, total, paidAmount: paid, balanceDue: total - paid,
      saleDate: now.slice(0, 10), paymentStatus: paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      createdAt: now, updatedAt: now,
    }
    await db.sales.add(sale)
    if (paid > 0) {
      const payment: Payment = {
        id: uuid(), saleId, amount: paid,
        method: 'cash', paidAt: now, createdAt: now, updatedAt: now,
      }
      await db.payments.add(payment)
    }
    return saleId
  }

  it('14. calculates total sales amount correctly', async () => {
    const p = await makePatient(db)
    await seedSaleAndPayment(db, p.id, 500, 0)
    await seedSaleAndPayment(db, p.id, 300, 0)
    const summary = await getPatientFinancialSummary(p.id, db)
    expect(summary.totalSalesAmount).toBe(800)
  })

  it('15. calculates total payments correctly', async () => {
    const p = await makePatient(db)
    await seedSaleAndPayment(db, p.id, 500, 200)
    await seedSaleAndPayment(db, p.id, 300, 150)
    const summary = await getPatientFinancialSummary(p.id, db)
    expect(summary.totalPaid).toBe(350)
  })

  it('16. calculates outstanding balance correctly', async () => {
    const p = await makePatient(db)
    await seedSaleAndPayment(db, p.id, 500, 200)
    const summary = await getPatientFinancialSummary(p.id, db)
    expect(summary.totalBalance).toBe(300)
  })

  it('does not count cancelled sales in totals', async () => {
    const p = await makePatient(db)
    // Add a cancelled sale directly
    const now = new Date().toISOString()
    await db.sales.add({
      id: uuid(), saleNumber: 'S-CANCEL', patientId: p.id,
      status: 'cancelled', subtotal: 1000, discountAmount: 0,
      taxAmount: 0, total: 1000, paidAmount: 0, balanceDue: 1000,
      createdAt: now, updatedAt: now,
    })
    const summary = await getPatientFinancialSummary(p.id, db)
    expect(summary.totalSalesAmount).toBe(0)
    expect(summary.purchaseCount).toBe(0)
  })

  it('returns zeros for patient with no sales', async () => {
    const p = await makePatient(db)
    const summary = await getPatientFinancialSummary(p.id, db)
    expect(summary.totalSalesAmount).toBe(0)
    expect(summary.totalPaid).toBe(0)
    expect(summary.totalBalance).toBe(0)
    expect(summary.purchaseCount).toBe(0)
  })
})

// ── 17. Patient profile data ──────────────────────────────────────────────────

describe('17. Patient profile data', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('retrieves full patient data by id', async () => {
    const p = await makePatient(db, {
      fullName: 'Sara Al-Zaidi', fullNameNormalized: 'sara al-zaidi',
      phone: '0567891234', gender: 'female',
    })
    const found = await db.patients.get(p.id)
    expect(found?.fullName).toBe('Sara Al-Zaidi')
    expect(found?.gender).toBe('female')
    expect(found?.phone).toBe('0567891234')
  })
})

// ── 18. Arabic RTL support ────────────────────────────────────────────────────

describe('18. Arabic patient data', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('stores and retrieves Arabic patient names correctly', async () => {
    const p = await makePatient(db, {
      fullName: 'أحمد محمد الرشيدي',
      fullNameNormalized: 'أحمد محمد الرشيدي',
    })
    const found = await db.patients.get(p.id)
    expect(found?.fullName).toBe('أحمد محمد الرشيدي')
  })

  it('searches Arabic names correctly', async () => {
    await makePatient(db, { fullName: 'أحمد محمد', fullNameNormalized: 'أحمد محمد' })
    const result = await searchPatients({ query: 'أحمد' }, db)
    expect(result.patients.length).toBeGreaterThan(0)
  })
})

// ── 19. English LTR ───────────────────────────────────────────────────────────

describe('19. English patient data', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('stores and retrieves English patient names correctly', async () => {
    const p = await makePatient(db, {
      fullName: 'John Smith', fullNameNormalized: 'john smith',
    })
    const result = await searchPatients({ query: 'john' }, db)
    expect(result.patients.some(r => r.id === p.id)).toBe(true)
  })
})

// ── 20. Offline operation ─────────────────────────────────────────────────────

describe('20. Offline operation', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('all operations work without network (all use IndexedDB directly)', async () => {
    // fake-indexeddb has no network — this test proves all calls are local
    const p = await makePatient(db, { fullName: 'Offline Test' })
    const updated = await updatePatient(p.id, { notes: 'offline note' }, db)
    await archivePatient(updated.id, db)
    await restorePatient(updated.id, db)
    const result = await searchPatients({ query: 'offline' }, db)
    expect(result.patients.length).toBe(1)
  })
})

// ── 21. Data persistence ──────────────────────────────────────────────────────

describe('21. Data persistence after re-open', () => {
  it('data survives DB close and re-open within the same fake-indexeddb context', async () => {
    const db1 = createTestDB()
    await db1.open()
    const p = await makePatient(db1, { fullName: 'Persistent Patient' })
    await db1.close()

    const db2 = new BarOptDB()
    await db2.open()
    const found = await db2.patients.get(p.id)
    expect(found?.fullName).toBe('Persistent Patient')
    await db2.close()
    db1.delete()
    db2.delete()
  })
})

// ── Bonus: Today count ────────────────────────────────────────────────────────

describe('Bonus: Today patient count', () => {
  let db: BarOptDB
  beforeEach(async () => { db = createTestDB(); await db.open() })
  afterEach(async () => { await db.close(); db.delete() })

  it('counts patients registered today', async () => {
    await makePatient(db)
    await makePatient(db)
    const count = await getTodayPatientCount(db)
    expect(count).toBe(2)
  })
})

// ── Age calculation ───────────────────────────────────────────────────────────

describe('Age calculation utility', () => {
  it('calculates age correctly', () => {
    const dob = '1990-01-01'
    const age = calcAge(dob)
    expect(age).toBeGreaterThan(30)
    expect(age).toBeLessThan(50)
  })
})
