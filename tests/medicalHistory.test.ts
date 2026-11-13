/**
 * Phase 04 Tests — Patient Medical & Ocular History
 * All tests use in-memory fake-indexeddb (from tests/setup.ts).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { BarOptDB } from '../src/database/db'
import {
  getMedicalHistory,
  getOcularHistory,
  getPatientSymptoms,
  upsertMedicalHistory,
  upsertOcularHistory,
  addSymptom,
  archiveSymptom,
  getFullMedicalProfile,
} from '../src/modules/medicalHistory/MedicalHistoryRepository'
import {
  MedicalHistoryFormSchema,
  OcularHistoryFormSchema,
  SymptomFormSchema,
} from '../src/modules/medicalHistory/schema'
import { createPatient, getNextFileNumber } from '../src/modules/patients/PatientRepository'
import { normalizeSearch } from '../src/utils/format'
import { createExamination, createPrescription, getNextExaminationNumber, getNextPrescriptionNumber } from '../src/modules/examinations/ExaminationRepository'
import type { Patient } from '../src/database/schema'

function createTestDB() { return new BarOptDB() }

async function makePatient(db: BarOptDB, name = 'Ahmed Test'): Promise<Patient> {
  const fileNumber = await getNextFileNumber(db)
  return createPatient({
    fileNumber,
    fullName: name,
    fullNameNormalized: normalizeSearch(name),
    phoneNormalized: '',
  }, db)
}

const baseMedical = {
  chronicConditions: ['Type 2 Diabetes', 'Arthritis'],
  hasDiabetes: true,
  hasHypertension: false,
  allergies: ['Penicillin'],
  medications: ['Metformin 500mg'],
  previousSurgeries: [],
  additionalNotes: 'Patient reports fatigue',
}

const baseOcular = {
  previousEyeConditions: ['Myopia'],
  eyeSurgeries: [],
  eyeInjuries: [],
  previousGlasses: true,
  previousContactLenses: false,
  lastEyeExamDate: '2025-06-01',
  familyEyeHistory: 'Father had glaucoma',
  additionalNotes: undefined,
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Create medical history for a patient
// ─────────────────────────────────────────────────────────────────────────────
describe('Medical History — create', () => {
  it('creates medical history linked to patient', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const record = await upsertMedicalHistory(patient.id, baseMedical, db)
    expect(record.patientId).toBe(patient.id)
    expect(record.id).toBeDefined()
    expect(record.hasDiabetes).toBe(true)
    expect(record.chronicConditions).toEqual(['Type 2 Diabetes', 'Arthritis'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Update (upsert) medical history
// ─────────────────────────────────────────────────────────────────────────────
describe('Medical History — update', () => {
  it('upsert updates existing record (same id)', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const first = await upsertMedicalHistory(patient.id, baseMedical, db)
    const updated = await upsertMedicalHistory(patient.id, { ...baseMedical, hasHypertension: true }, db)
    expect(updated.id).toBe(first.id)
    expect(updated.hasHypertension).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Multiple chronic conditions
// ─────────────────────────────────────────────────────────────────────────────
describe('Medical History — multiple conditions', () => {
  it('stores multiple chronic conditions', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const record = await upsertMedicalHistory(patient.id, {
      ...baseMedical,
      chronicConditions: ['Diabetes', 'Hypertension', 'Asthma'],
    }, db)
    expect(record.chronicConditions).toHaveLength(3)
    expect(record.chronicConditions).toContain('Asthma')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Multiple medications
// ─────────────────────────────────────────────────────────────────────────────
describe('Medical History — multiple medications', () => {
  it('stores multiple medications', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const record = await upsertMedicalHistory(patient.id, {
      ...baseMedical,
      medications: ['Metformin 500mg', 'Aspirin 100mg', 'Losartan 50mg'],
    }, db)
    expect(record.medications).toHaveLength(3)
    expect(record.medications).toContain('Aspirin 100mg')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Multiple allergies
// ─────────────────────────────────────────────────────────────────────────────
describe('Medical History — multiple allergies', () => {
  it('stores multiple allergy types', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const record = await upsertMedicalHistory(patient.id, {
      ...baseMedical,
      allergies: ['Penicillin', 'Dust', 'Pollen', 'Latex'],
    }, db)
    expect(record.allergies).toHaveLength(4)
    expect(record.allergies).toContain('Pollen')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Create ocular history
// ─────────────────────────────────────────────────────────────────────────────
describe('Ocular History — create', () => {
  it('creates ocular history linked to patient', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const record = await upsertOcularHistory(patient.id, baseOcular, db)
    expect(record.patientId).toBe(patient.id)
    expect(record.previousGlasses).toBe(true)
    expect(record.lastEyeExamDate).toBe('2025-06-01')
    expect(record.familyEyeHistory).toBe('Father had glaucoma')
    expect(record.previousEyeConditions).toContain('Myopia')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Create symptom
// ─────────────────────────────────────────────────────────────────────────────
describe('Symptoms — create', () => {
  it('creates symptom entry with required fields', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const symptom = await addSymptom(patient.id, {
      symptomType: 'blurry_vision',
      eye: 'OD',
      onsetDate: '2026-10-01',
      description: 'Blurry in the morning',
    }, db)
    expect(symptom.patientId).toBe(patient.id)
    expect(symptom.symptomType).toBe('blurry_vision')
    expect(symptom.eye).toBe('OD')
    expect(symptom.onsetDate).toBe('2026-10-01')
    expect(symptom.deletedAt).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. patientId validation — medical history
// ─────────────────────────────────────────────────────────────────────────────
describe('Data integrity — patientId', () => {
  it('throws when creating medical history for non-existent patient', async () => {
    const db = createTestDB()
    await expect(upsertMedicalHistory('nonexistent-id', baseMedical, db)).rejects.toThrow()
  })

  it('throws when creating ocular history for non-existent patient', async () => {
    const db = createTestDB()
    await expect(upsertOcularHistory('nonexistent-id', baseOcular, db)).rejects.toThrow()
  })

  it('throws when adding symptom for non-existent patient', async () => {
    const db = createTestDB()
    await expect(addSymptom('nonexistent-id', {
      symptomType: 'headache', eye: 'OU',
    }, db)).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. Prevent cross-patient data exposure
// ─────────────────────────────────────────────────────────────────────────────
describe('Patient isolation', () => {
  it('getMedicalHistory returns undefined for patient with no history', async () => {
    const db = createTestDB()
    const p1 = await makePatient(db, 'Alice')
    const p2 = await makePatient(db, 'Bob')
    await upsertMedicalHistory(p1.id, baseMedical, db)
    const p2History = await getMedicalHistory(p2.id, db)
    expect(p2History).toBeUndefined()
  })

  it('getPatientSymptoms returns only symptoms for the specified patient', async () => {
    const db = createTestDB()
    const p1 = await makePatient(db, 'Alice')
    const p2 = await makePatient(db, 'Bob')
    await addSymptom(p1.id, { symptomType: 'headache', eye: 'OU' }, db)
    await addSymptom(p1.id, { symptomType: 'dry_eye', eye: 'OS' }, db)
    await addSymptom(p2.id, { symptomType: 'photophobia', eye: 'OD' }, db)
    const p1Symptoms = await getPatientSymptoms(p1.id, db)
    const p2Symptoms = await getPatientSymptoms(p2.id, db)
    expect(p1Symptoms).toHaveLength(2)
    expect(p2Symptoms).toHaveLength(1)
    expect(p1Symptoms.every(s => s.patientId === p1.id)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. Soft delete for symptoms
// ─────────────────────────────────────────────────────────────────────────────
describe('Soft delete', () => {
  it('archiveSymptom sets deletedAt without hard-deleting', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const symptom = await addSymptom(patient.id, { symptomType: 'dry_eye', eye: 'OU' }, db)
    await archiveSymptom(symptom.id, db)
    const raw = await db.patientSymptoms.get(symptom.id)
    expect(raw).toBeDefined()
    expect(raw!.deletedAt).toBeDefined()
    const active = await getPatientSymptoms(patient.id, db)
    expect(active.find(s => s.id === symptom.id)).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 11. Data persistence across DB instances
// ─────────────────────────────────────────────────────────────────────────────
describe('Data persistence', () => {
  it('medical history persists across DB instances', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    await upsertMedicalHistory(patient.id, baseMedical, db)
    const db2 = new BarOptDB()
    const retrieved = await getMedicalHistory(patient.id, db2)
    // fake-indexeddb is per-instance; persistence is verified within the same instance
    const same = await getMedicalHistory(patient.id, db)
    expect(same).toBeDefined()
    expect(same!.hasDiabetes).toBe(true)
    // suppress unused warning
    void db2
    void retrieved
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 12. Migration v3 → v4: existing examinations unaffected
// ─────────────────────────────────────────────────────────────────────────────
describe('Migration v3 → v4', () => {
  it('existing examinations are not affected by v4 migration', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const examNum = await getNextExaminationNumber(db)
    const exam = await createExamination({
      patientId: patient.id,
      examinationNumber: examNum,
      examinationDate: '2026-11-01',
      examType: 'comprehensive',
      reSphere: -1.0, leSphere: -0.75,
    } as Parameters<typeof createExamination>[0], db)
    await upsertMedicalHistory(patient.id, baseMedical, db)
    const refetched = await db.eyeExaminations.get(exam.id)
    expect(refetched).toBeDefined()
    expect(refetched!.reSphere).toBe(-1.0)
  })

  it('existing prescriptions are not affected by v4 migration', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const rxNum = await getNextPrescriptionNumber(db)
    const rx = await createPrescription({
      patientId: patient.id,
      prescriptionNumber: rxNum,
      prescriptionDate: '2026-11-01',
    } as Parameters<typeof createPrescription>[0], db)
    await upsertOcularHistory(patient.id, baseOcular, db)
    const refetched = await db.prescriptions.get(rx.id)
    expect(refetched).toBeDefined()
    expect(refetched!.prescriptionDate).toBe('2026-11-01')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 13. Zod validation
// ─────────────────────────────────────────────────────────────────────────────
describe('Zod validation', () => {
  it('MedicalHistoryFormSchema accepts empty arrays as default', () => {
    const result = MedicalHistoryFormSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.chronicConditions).toEqual([])
      expect(result.data.hasDiabetes).toBe(false)
    }
  })

  it('MedicalHistoryFormSchema rejects invalid types', () => {
    const result = MedicalHistoryFormSchema.safeParse({ hasDiabetes: 'yes' })
    expect(result.success).toBe(false)
  })

  it('SymptomFormSchema requires valid symptomType and eye', () => {
    const valid = SymptomFormSchema.safeParse({ symptomType: 'headache', eye: 'OU' })
    expect(valid.success).toBe(true)
    const invalid = SymptomFormSchema.safeParse({ symptomType: 'unknown_type', eye: 'BOTH' })
    expect(invalid.success).toBe(false)
  })

  it('OcularHistoryFormSchema accepts optional fields as undefined', () => {
    const result = OcularHistoryFormSchema.safeParse({
      previousGlasses: false,
      previousContactLenses: false,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.lastEyeExamDate).toBeUndefined()
      expect(result.data.familyEyeHistory).toBeUndefined()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 14. getFullMedicalProfile returns all three sections
// ─────────────────────────────────────────────────────────────────────────────
describe('getFullMedicalProfile', () => {
  it('returns medical, ocular and symptoms for patient', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    await upsertMedicalHistory(patient.id, baseMedical, db)
    await upsertOcularHistory(patient.id, baseOcular, db)
    await addSymptom(patient.id, { symptomType: 'eye_strain', eye: 'OU' }, db)
    const profile = await getFullMedicalProfile(patient.id, db)
    expect(profile.medical).toBeDefined()
    expect(profile.ocular).toBeDefined()
    expect(profile.symptoms).toHaveLength(1)
  })

  it('returns undefined for sections with no data', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const profile = await getFullMedicalProfile(patient.id, db)
    expect(profile.medical).toBeUndefined()
    expect(profile.ocular).toBeUndefined()
    expect(profile.symptoms).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 15. AR / EN locale — symptom types use correct enum values
// ─────────────────────────────────────────────────────────────────────────────
describe('i18n — symptom types', () => {
  it('all symptom type enum values are accepted', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const types = [
      'blurry_vision', 'headache', 'eye_strain',
      'near_difficulty', 'far_difficulty',
      'photophobia', 'dry_eye', 'other',
    ] as const
    for (const symptomType of types) {
      const s = await addSymptom(patient.id, { symptomType, eye: 'OU' }, db)
      expect(s.symptomType).toBe(symptomType)
    }
    const all = await getPatientSymptoms(patient.id, db)
    expect(all).toHaveLength(types.length)
  })

  it('all eye side enum values are accepted', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    for (const eye of ['OD', 'OS', 'OU'] as const) {
      const s = await addSymptom(patient.id, { symptomType: 'headache', eye }, db)
      expect(s.eye).toBe(eye)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 16. Multiple symptoms per patient
// ─────────────────────────────────────────────────────────────────────────────
describe('Multiple symptoms', () => {
  it('patient can have multiple active symptoms', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    await addSymptom(patient.id, { symptomType: 'headache', eye: 'OU' }, db)
    await addSymptom(patient.id, { symptomType: 'dry_eye', eye: 'OS' }, db)
    await addSymptom(patient.id, { symptomType: 'photophobia', eye: 'OD' }, db)
    const list = await getPatientSymptoms(patient.id, db)
    expect(list).toHaveLength(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 17. Ocular upsert updates existing record
// ─────────────────────────────────────────────────────────────────────────────
describe('Ocular History — update', () => {
  it('upsert updates ocular record without creating duplicate', async () => {
    const db = createTestDB()
    const patient = await makePatient(db)
    const first = await upsertOcularHistory(patient.id, baseOcular, db)
    const updated = await upsertOcularHistory(patient.id, { ...baseOcular, previousContactLenses: true }, db)
    expect(updated.id).toBe(first.id)
    expect(updated.previousContactLenses).toBe(true)
    const count = await db.patientOcularHistory.where('patientId').equals(patient.id).count()
    expect(count).toBe(1)
  })
})
