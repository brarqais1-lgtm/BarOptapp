import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type {
  PatientMedicalHistory,
  PatientOcularHistory,
  PatientSymptom,
} from '../../database/schema'
import type {
  MedicalHistoryFormValues,
  OcularHistoryFormValues,
  SymptomFormValues,
} from './schema'

// ── Medical History ───────────────────────────────────────────────────────────

export async function getMedicalHistory(
  patientId: string,
  db: BarOptDB = globalDb,
): Promise<PatientMedicalHistory | undefined> {
  return db.patientMedicalHistory
    .where('patientId').equals(patientId)
    .filter(r => !r.deletedAt)
    .first()
}

export async function upsertMedicalHistory(
  patientId: string,
  data: MedicalHistoryFormValues,
  db: BarOptDB = globalDb,
): Promise<PatientMedicalHistory> {
  const patient = await db.patients.get(patientId)
  if (!patient) throw new Error(`Patient ${patientId} not found`)

  const now = new Date().toISOString()
  const existing = await getMedicalHistory(patientId, db)

  if (existing) {
    const updated: PatientMedicalHistory = { ...existing, ...data, updatedAt: now }
    await db.patientMedicalHistory.put(updated)
    return updated
  }

  const record: PatientMedicalHistory = {
    id: uuidv4(),
    patientId,
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  await db.patientMedicalHistory.add(record)
  return record
}

// ── Ocular History ────────────────────────────────────────────────────────────

export async function getOcularHistory(
  patientId: string,
  db: BarOptDB = globalDb,
): Promise<PatientOcularHistory | undefined> {
  return db.patientOcularHistory
    .where('patientId').equals(patientId)
    .filter(r => !r.deletedAt)
    .first()
}

export async function upsertOcularHistory(
  patientId: string,
  data: OcularHistoryFormValues,
  db: BarOptDB = globalDb,
): Promise<PatientOcularHistory> {
  const patient = await db.patients.get(patientId)
  if (!patient) throw new Error(`Patient ${patientId} not found`)

  const now = new Date().toISOString()
  const existing = await getOcularHistory(patientId, db)

  if (existing) {
    const updated: PatientOcularHistory = { ...existing, ...data, updatedAt: now }
    await db.patientOcularHistory.put(updated)
    return updated
  }

  const record: PatientOcularHistory = {
    id: uuidv4(),
    patientId,
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  await db.patientOcularHistory.add(record)
  return record
}

// ── Symptoms ──────────────────────────────────────────────────────────────────

export async function getPatientSymptoms(
  patientId: string,
  db: BarOptDB = globalDb,
): Promise<PatientSymptom[]> {
  const all = await db.patientSymptoms
    .where('patientId').equals(patientId)
    .filter(s => !s.deletedAt)
    .toArray()
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function addSymptom(
  patientId: string,
  data: SymptomFormValues,
  db: BarOptDB = globalDb,
): Promise<PatientSymptom> {
  const patient = await db.patients.get(patientId)
  if (!patient) throw new Error(`Patient ${patientId} not found`)

  const now = new Date().toISOString()
  const symptom: PatientSymptom = {
    id: uuidv4(),
    patientId,
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  await db.patientSymptoms.add(symptom)
  return symptom
}

export async function archiveSymptom(
  id: string,
  db: BarOptDB = globalDb,
): Promise<void> {
  const now = new Date().toISOString()
  await db.patientSymptoms.update(id, { deletedAt: now, updatedAt: now })
}

export async function getFullMedicalProfile(
  patientId: string,
  db: BarOptDB = globalDb,
) {
  const [medical, ocular, symptoms] = await Promise.all([
    getMedicalHistory(patientId, db),
    getOcularHistory(patientId, db),
    getPatientSymptoms(patientId, db),
  ])
  return { medical, ocular, symptoms }
}
