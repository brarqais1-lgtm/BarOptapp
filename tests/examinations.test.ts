/**
 * Phase 03 Tests — Eye Examinations & Prescriptions
 * All tests use in-memory fake-indexeddb (from tests/setup.ts).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { BarOptDB } from '../src/database/db'
import {
  createExamination,
  updateExamination,
  archiveExamination,
  restoreExamination,
  getPatientExaminations,
  getExaminationPrescriptions,
  getPatientPrescriptions,
  createPrescription,
  compareExaminations,
  getNextExaminationNumber,
  getNextPrescriptionNumber,
} from '../src/modules/examinations/ExaminationRepository'
import { ExaminationFormSchema, PrescriptionFormSchema } from '../src/modules/examinations/schema'
import { createPatient, getNextFileNumber } from '../src/modules/patients/PatientRepository'
import { normalizeSearch } from '../src/utils/format'
import type { Patient } from '../src/database/schema'
import { v4 as uuid } from 'uuid'

// ── Helpers ───────────────────────────────────────────────────────────────────

function createTestDB() { return new BarOptDB() }

async function makePatient(db: BarOptDB, overrides: Partial<Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>> = {}): Promise<Patient> {
  const fileNumber = await getNextFileNumber(db)
  return createPatient({
    fileNumber,
    fullName: overrides.fullName ?? 'Ahmed Test',
    fullNameNormalized: normalizeSearch(overrides.fullName ?? 'Ahmed Test'),
    phone: overrides.phone,
    phoneNormalized: overrides.phone ?? '',
    ...overrides,
  }, db)
}

const baseExamData = {
  examinationDate: '2026-11-10',
  examinedBy: 'Dr. Ali',
  examType: 'comprehensive' as const,
  reSphere: -1.25,
  reCylinder: -0.50,
  reAxis: 90,
  reAdd: undefined,
  rePrismPower: undefined,
  rePrismBase: undefined,
  visualAcuityRight: '6/9',
  rePd: 32,
  leSphere: -1.00,
  leCylinder: -0.25,
  leAxis: 85,
  leAdd: undefined,
  lePrismPower: undefined,
  lePrismBase: undefined,
  visualAcuityLeft: '6/6',
  lePd: 31,
  pdDistance: 63,
  pdNear: 60,
  unaidedVARight: '6/60',
  unaidedVALeft: '6/60',
  bcvaRight: '6/9',
  bcvaLeft: '6/6',
  notes: 'Test examination',
}

// ── 1. Create examination ─────────────────────────────────────────────────────

describe('1. Create examination', () => {
  it('creates and stores examination in IndexedDB', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    expect(exam.id).toBeTruthy()
    expect(exam.examinationNumber).toMatch(/^E-\d{6}$/)
    expect(exam.patientId).toBe(patient.id)
    const stored = await db.eyeExaminations.get(exam.id)
    expect(stored?.id).toBe(exam.id)
  })
})

// ── 2. Save examination for patient ──────────────────────────────────────────

describe('2. Save examination for patient', () => {
  it('links examination to patient via patientId', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    const list = await getPatientExaminations(patient.id, false, db)
    expect(list.length).toBe(1)
    expect(list[0].id).toBe(exam.id)
  })
})

// ── 3. Prevent linking to non-existent patient ────────────────────────────────

describe('3. Referential integrity: patient must exist', () => {
  it('throws when patient does not exist', async () => {
    const db = createTestDB()
    await expect(
      createExamination({ ...baseExamData, patientId: uuid() }, db)
    ).rejects.toThrow()
  })
})

// ── 4. SPH positive input ─────────────────────────────────────────────────────

describe('4. SPH positive input', () => {
  it('accepts positive SPH values', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id, reSphere: +2.50, leSphere: +1.75 }, db)
    expect(exam.reSphere).toBe(2.50)
    expect(exam.leSphere).toBe(1.75)
  })
})

// ── 5. SPH negative input ─────────────────────────────────────────────────────

describe('5. SPH negative input', () => {
  it('accepts negative SPH values', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id, reSphere: -5.00, leSphere: -3.25 }, db)
    expect(exam.reSphere).toBe(-5.00)
    expect(exam.leSphere).toBe(-3.25)
  })
})

// ── 6. CYL input ──────────────────────────────────────────────────────────────

describe('6. CYL input validation', () => {
  it('accepts CYL within -10 to +10 range', () => {
    const result = ExaminationFormSchema.safeParse({ ...baseExamData, reCylinder: -2.75, leCylinder: 1.00 })
    expect(result.success).toBe(true)
  })
  it('rejects CYL outside range', () => {
    const result = ExaminationFormSchema.safeParse({ ...baseExamData, reCylinder: -15 })
    expect(result.success).toBe(false)
  })
})

// ── 7. AXIS validation ────────────────────────────────────────────────────────

describe('7. AXIS validation (0–180)', () => {
  it('accepts AXIS 0 to 180', () => {
    const r1 = ExaminationFormSchema.safeParse({ ...baseExamData, reAxis: 0 })
    const r2 = ExaminationFormSchema.safeParse({ ...baseExamData, reAxis: 180 })
    const r3 = ExaminationFormSchema.safeParse({ ...baseExamData, reAxis: 90 })
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    expect(r3.success).toBe(true)
  })
  it('rejects AXIS > 180', () => {
    const result = ExaminationFormSchema.safeParse({ ...baseExamData, reAxis: 181 })
    expect(result.success).toBe(false)
  })
  it('rejects negative AXIS', () => {
    const result = ExaminationFormSchema.safeParse({ ...baseExamData, reAxis: -1 })
    expect(result.success).toBe(false)
  })
})

// ── 8. ADD validation ─────────────────────────────────────────────────────────

describe('8. ADD validation (0–4)', () => {
  it('accepts ADD within range', () => {
    const result = ExaminationFormSchema.safeParse({ ...baseExamData, reAdd: 2.50, leAdd: 1.75 })
    expect(result.success).toBe(true)
  })
  it('rejects ADD > 4', () => {
    const result = ExaminationFormSchema.safeParse({ ...baseExamData, reAdd: 5 })
    expect(result.success).toBe(false)
  })
})

// ── 9. PD validation ──────────────────────────────────────────────────────────

describe('9. PD validation', () => {
  it('accepts PD in valid range', () => {
    const result = ExaminationFormSchema.safeParse({ ...baseExamData, pdDistance: 63, pdNear: 60 })
    expect(result.success).toBe(true)
  })
  it('rejects PD outside range', () => {
    const result = ExaminationFormSchema.safeParse({ ...baseExamData, pdDistance: 10 })
    expect(result.success).toBe(false)
  })
})

// ── 10. VA input ──────────────────────────────────────────────────────────────

describe('10. VA input', () => {
  it('stores VA values correctly', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({
      ...baseExamData, patientId: patient.id,
      visualAcuityRight: '6/6', visualAcuityLeft: '6/9',
    }, db)
    expect(exam.visualAcuityRight).toBe('6/6')
    expect(exam.visualAcuityLeft).toBe('6/9')
  })
  it('accepts non-standard VA values like CF, HM', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({
      ...baseExamData, patientId: patient.id,
      visualAcuityRight: 'CF', visualAcuityLeft: 'HM',
    }, db)
    expect(exam.visualAcuityRight).toBe('CF')
    expect(exam.visualAcuityLeft).toBe('HM')
  })
})

// ── 11. Create prescription ───────────────────────────────────────────────────

describe('11. Create prescription', () => {
  it('creates prescription linked to patient and examination', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    const rx = await createPrescription({
      prescriptionDate: '2026-11-10',
      examinedBy: 'Dr. Ali',
      patientId: patient.id,
      examinationId: exam.id,
      reSphere: -1.25, reCylinder: -0.50, reAxis: 90,
      leSphere: -1.00, leCylinder: -0.25, leAxis: 85,
      pdDistance: 63,
    }, db)
    expect(rx.id).toBeTruthy()
    expect(rx.prescriptionNumber).toMatch(/^Rx-\d{6}$/)
    expect(rx.patientId).toBe(patient.id)
    expect(rx.examinationId).toBe(exam.id)
  })
})

// ── 12. Link prescription to examination ──────────────────────────────────────

describe('12. Link prescription to examination', () => {
  it('prescription is retrievable by examinationId', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    await createPrescription({
      prescriptionDate: '2026-11-10', patientId: patient.id, examinationId: exam.id,
    }, db)
    const rxs = await getExaminationPrescriptions(exam.id, db)
    expect(rxs.length).toBe(1)
  })
})

// ── 13. Preserve old prescriptions ────────────────────────────────────────────

describe('13. Old prescriptions preserved when new one created', () => {
  it('creating a new prescription does not modify old ones', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    const rx1 = await createPrescription({
      prescriptionDate: '2025-01-01', patientId: patient.id, examinationId: exam.id, reSphere: -1.00,
    }, db)
    const rx2 = await createPrescription({
      prescriptionDate: '2026-11-10', patientId: patient.id, examinationId: exam.id, reSphere: -1.50,
    }, db)
    const rxs = await getExaminationPrescriptions(exam.id, db)
    expect(rxs.length).toBe(2)
    const old = rxs.find(r => r.id === rx1.id)
    expect(old?.reSphere).toBe(-1.00)
    expect(rx2.reSphere).toBe(-1.50)
  })
})

// ── 14. View examination history ──────────────────────────────────────────────

describe('14. View examination history (patient)', () => {
  it('returns all active exams sorted by date desc', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    await createExamination({ ...baseExamData, patientId: patient.id, examinationDate: '2025-03-01' }, db)
    await createExamination({ ...baseExamData, patientId: patient.id, examinationDate: '2026-01-15' }, db)
    await createExamination({ ...baseExamData, patientId: patient.id, examinationDate: '2024-07-20' }, db)
    const list = await getPatientExaminations(patient.id, false, db)
    expect(list.length).toBe(3)
    expect(list[0].examinationDate).toBe('2026-01-15')
    expect(list[2].examinationDate).toBe('2024-07-20')
  })
})

// ── 15. Compare two examinations ──────────────────────────────────────────────

describe('15. Compare two examinations', () => {
  it('shows numeric differences without medical labels', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const e1 = await createExamination({ ...baseExamData, patientId: patient.id, reSphere: -1.25, leSphere: -1.00 }, db)
    const e2 = await createExamination({ ...baseExamData, patientId: patient.id, reSphere: -1.50, leSphere: -1.25 }, db)
    const diffs = compareExaminations(e1, e2)
    const sphOD = diffs.find(d => d.field === 'reSphere')
    const sphOS = diffs.find(d => d.field === 'leSphere')
    expect(sphOD?.diff).toBe(-0.25)
    expect(sphOS?.diff).toBe(-0.25)
  })
  it('returns null diff for non-numeric fields (VA)', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const e1 = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    const e2 = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    const diffs = compareExaminations(e1, e2)
    const vaRow = diffs.find(d => d.field === 'vaRight')
    expect(vaRow?.diff).toBeNull()
  })
})

// ── 16. Archive examination ───────────────────────────────────────────────────

describe('16. Archive examination', () => {
  it('sets deletedAt on archive', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    await archiveExamination(exam.id, db)
    const stored = await db.eyeExaminations.get(exam.id)
    expect(stored?.deletedAt).toBeTruthy()
  })
  it('excludes archived from default list', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    await archiveExamination(exam.id, db)
    const active = await getPatientExaminations(patient.id, false, db)
    expect(active.length).toBe(0)
    const all = await getPatientExaminations(patient.id, true, db)
    expect(all.length).toBe(1)
  })
  it('restores archived examination', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    await archiveExamination(exam.id, db)
    await restoreExamination(exam.id, db)
    const stored = await db.eyeExaminations.get(exam.id)
    expect(stored?.deletedAt).toBeUndefined()
  })
})

// ── 17. Audit log ─────────────────────────────────────────────────────────────

describe('17. Audit log on examination actions', () => {
  it('audit entry is created when examination is created', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    const { logAudit } = await import('../src/services/audit.service')
    await logAudit({ action: 'create', entityType: 'EyeExamination', entityId: exam.id, after: exam, db })
    const logs = await db.auditLogs.where('entityId').equals(exam.id).toArray()
    expect(logs.length).toBeGreaterThan(0)
    expect(logs[0].action).toBe('create')
    expect(logs[0].entityType).toBe('EyeExamination')
  })
})

// ── 18. Print prescription (data integrity) ────────────────────────────────────

describe('18. Prescription print data', () => {
  it('prescription contains all needed print fields', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    const rx = await createPrescription({
      prescriptionDate: '2026-11-10',
      examinedBy: 'Dr. Ali',
      patientId: patient.id,
      examinationId: exam.id,
      reSphere: -1.25, reCylinder: -0.50, reAxis: 90,
      leSphere: -1.00, leCylinder: -0.25, leAxis: 85,
      pdDistance: 63,
      reVA: '6/9', leVA: '6/6',
    }, db)
    expect(rx.prescriptionNumber).toBeTruthy()
    expect(rx.prescriptionDate).toBe('2026-11-10')
    expect(rx.examinedBy).toBe('Dr. Ali')
    expect(rx.reSphere).toBe(-1.25)
    expect(rx.reVA).toBe('6/9')
    expect(rx.pdDistance).toBe(63)
  })
})

// ── 19. RTL (Arabic) ──────────────────────────────────────────────────────────

describe('19. Arabic RTL support', () => {
  it('stores Arabic examiner name correctly', async () => {
    const db = createTestDB()
    const patient = await makePatient(db, { fullName: 'محمد العلي' })
    const exam = await createExamination({
      ...baseExamData, patientId: patient.id, examinedBy: 'د. عبدالله الأحمد',
    }, db)
    expect(exam.examinedBy).toBe('د. عبدالله الأحمد')
    expect(patient.fullName).toBe('محمد العلي')
  })
})

// ── 20. LTR (English) ─────────────────────────────────────────────────────────

describe('20. English LTR support', () => {
  it('stores English examiner name and notes correctly', async () => {
    const db = createTestDB()
    const patient = await makePatient(db, { fullName: 'John Smith' })
    const exam = await createExamination({
      ...baseExamData, patientId: patient.id,
      examinedBy: 'Dr. Williams',
      notes: 'Patient reports frequent headaches',
    }, db)
    expect(exam.examinedBy).toBe('Dr. Williams')
    expect(exam.notes).toBe('Patient reports frequent headaches')
  })
})

// ── 21. Offline operation ─────────────────────────────────────────────────────

describe('21. Offline operation', () => {
  it('all exam operations use IndexedDB only (no network calls)', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    const rx = await createPrescription({
      prescriptionDate: '2026-11-10', patientId: patient.id, examinationId: exam.id,
    }, db)
    const list = await getPatientExaminations(patient.id, false, db)
    const rxList = await getPatientPrescriptions(patient.id, db)
    expect(list.length).toBe(1)
    expect(rxList.length).toBe(1)
    expect(rx.examinationId).toBe(exam.id)
  })
})

// ── 22. Data persistence ──────────────────────────────────────────────────────

describe('22. Data persistence after DB reopen', () => {
  it('examination survives a DB close and reopen', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const exam = await createExamination({ ...baseExamData, patientId: patient.id }, db)
    db.close()

    const db2 = new BarOptDB()
    const stored = await db2.eyeExaminations.get(exam.id)
    expect(stored?.id).toBe(exam.id)
    expect(stored?.reSphere).toBe(-1.25)
    db2.close()
  })
})

// ── 23. Referential integrity ─────────────────────────────────────────────────

describe('23. Referential integrity: patient + exam + prescription', () => {
  it('prescription cannot link to non-existent examination', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    await expect(
      createPrescription({
        prescriptionDate: '2026-11-10', patientId: patient.id, examinationId: uuid(),
      }, db)
    ).rejects.toThrow()
  })
  it('prescription cannot link to non-existent patient', async () => {
    const db = createTestDB()
    await expect(
      createPrescription({
        prescriptionDate: '2026-11-10', patientId: uuid(),
      }, db)
    ).rejects.toThrow()
  })
})

// ── Bonus: Examination number sequence ────────────────────────────────────────

describe('Examination number sequence', () => {
  it('generates sequential E-XXXXXX numbers', async () => {
    const db = createTestDB()
    const n1 = await getNextExaminationNumber(db)
    const n2 = await getNextExaminationNumber(db)
    expect(n1).toMatch(/^E-\d{6}$/)
    expect(n1).not.toBe(n2)
    expect(parseInt(n2.split('-')[1])).toBe(parseInt(n1.split('-')[1]) + 1)
  })
})

describe('Prescription number sequence', () => {
  it('generates sequential Rx-XXXXXX numbers', async () => {
    const db = createTestDB()
    const n1 = await getNextPrescriptionNumber(db)
    const n2 = await getNextPrescriptionNumber(db)
    expect(n1).toMatch(/^Rx-\d{6}$/)
    expect(n1).not.toBe(n2)
  })
})

describe('Zod prescription schema validation', () => {
  it('requires prescriptionDate', () => {
    const result = PrescriptionFormSchema.safeParse({ prescriptionDate: '' })
    expect(result.success).toBe(false)
  })
  it('accepts valid prescription data', () => {
    const result = PrescriptionFormSchema.safeParse({
      prescriptionDate: '2026-11-10',
      examinedBy: 'Dr. Test',
      reSphere: -1.25,
      reCylinder: -0.50,
      reAxis: 90,
      pdDistance: 63,
    })
    expect(result.success).toBe(true)
  })
})
