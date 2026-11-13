import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { EyeExamination, Prescription, Setting } from '../../database/schema'
import type { ExaminationFormValues, PrescriptionFormValues } from './schema'

// ── Sequence helpers ──────────────────────────────────────────────────────────

export async function getNextExaminationNumber(db: BarOptDB = globalDb): Promise<string> {
  return db.transaction('rw', [db.settings], async () => {
    const existing = await db.settings.where({ key: 'examination_sequence' }).first()
    const current = existing ? (JSON.parse(existing.value) as number) : 0
    const next = current + 1
    const now = new Date().toISOString()
    if (existing) {
      await db.settings.update(existing.id, { value: JSON.stringify(next), updatedAt: now })
    } else {
      const s: Setting = {
        id: uuidv4(), key: 'examination_sequence',
        value: JSON.stringify(next), group: 'system',
        createdAt: now, updatedAt: now,
      }
      await db.settings.add(s)
    }
    return `E-${String(next).padStart(6, '0')}`
  })
}

export async function getNextPrescriptionNumber(db: BarOptDB = globalDb): Promise<string> {
  return db.transaction('rw', [db.settings], async () => {
    const existing = await db.settings.where({ key: 'prescription_sequence' }).first()
    const current = existing ? (JSON.parse(existing.value) as number) : 0
    const next = current + 1
    const now = new Date().toISOString()
    if (existing) {
      await db.settings.update(existing.id, { value: JSON.stringify(next), updatedAt: now })
    } else {
      const s: Setting = {
        id: uuidv4(), key: 'prescription_sequence',
        value: JSON.stringify(next), group: 'system',
        createdAt: now, updatedAt: now,
      }
      await db.settings.add(s)
    }
    return `Rx-${String(next).padStart(6, '0')}`
  })
}

// ── Create examination ────────────────────────────────────────────────────────

export async function createExamination(
  data: ExaminationFormValues & { patientId: string },
  db: BarOptDB = globalDb,
): Promise<EyeExamination> {
  const patient = await db.patients.get(data.patientId)
  if (!patient) throw new Error(`Patient ${data.patientId} not found`)

  const examinationNumber = await getNextExaminationNumber(db)
  const now = new Date().toISOString()

  const exam: EyeExamination = {
    id: uuidv4(),
    patientId: data.patientId,
    examinationNumber,
    examType: data.examType ?? 'comprehensive',
    examinedBy: data.examinedBy || undefined,
    examinationDate: data.examinationDate,
    reSphere: data.reSphere,
    reCylinder: data.reCylinder,
    reAxis: data.reAxis,
    reAdd: data.reAdd,
    rePrismPower: data.rePrismPower,
    rePrismBase: data.rePrismBase || undefined,
    rePd: data.rePd,
    visualAcuityRight: data.visualAcuityRight || undefined,
    leSphere: data.leSphere,
    leCylinder: data.leCylinder,
    leAxis: data.leAxis,
    leAdd: data.leAdd,
    lePrismPower: data.lePrismPower,
    lePrismBase: data.lePrismBase || undefined,
    lePd: data.lePd,
    visualAcuityLeft: data.visualAcuityLeft || undefined,
    pdDistance: data.pdDistance,
    pdNear: data.pdNear,
    unaidedVARight: data.unaidedVARight || undefined,
    unaidedVALeft: data.unaidedVALeft || undefined,
    bcvaRight: data.bcvaRight || undefined,
    bcvaLeft: data.bcvaLeft || undefined,
    notes: data.notes || undefined,
    createdAt: now,
    updatedAt: now,
  }

  await db.eyeExaminations.add(exam)
  return exam
}

// ── Update examination ────────────────────────────────────────────────────────

export async function updateExamination(
  id: string,
  data: ExaminationFormValues,
  db: BarOptDB = globalDb,
): Promise<EyeExamination> {
  const existing = await db.eyeExaminations.get(id)
  if (!existing) throw new Error(`Examination ${id} not found`)

  const updated: EyeExamination = {
    ...existing,
    examType: data.examType ?? existing.examType,
    examinedBy: data.examinedBy || undefined,
    examinationDate: data.examinationDate,
    reSphere: data.reSphere,
    reCylinder: data.reCylinder,
    reAxis: data.reAxis,
    reAdd: data.reAdd,
    rePrismPower: data.rePrismPower,
    rePrismBase: data.rePrismBase || undefined,
    rePd: data.rePd,
    visualAcuityRight: data.visualAcuityRight || undefined,
    leSphere: data.leSphere,
    leCylinder: data.leCylinder,
    leAxis: data.leAxis,
    leAdd: data.leAdd,
    lePrismPower: data.lePrismPower,
    lePrismBase: data.lePrismBase || undefined,
    lePd: data.lePd,
    visualAcuityLeft: data.visualAcuityLeft || undefined,
    pdDistance: data.pdDistance,
    pdNear: data.pdNear,
    unaidedVARight: data.unaidedVARight || undefined,
    unaidedVALeft: data.unaidedVALeft || undefined,
    bcvaRight: data.bcvaRight || undefined,
    bcvaLeft: data.bcvaLeft || undefined,
    notes: data.notes || undefined,
    updatedAt: new Date().toISOString(),
  }

  await db.eyeExaminations.put(updated)
  return updated
}

// ── Archive / restore ─────────────────────────────────────────────────────────

export async function archiveExamination(id: string, db: BarOptDB = globalDb): Promise<void> {
  const existing = await db.eyeExaminations.get(id)
  if (!existing) throw new Error(`Examination ${id} not found`)
  await db.eyeExaminations.put({
    ...existing,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

export async function restoreExamination(id: string, db: BarOptDB = globalDb): Promise<void> {
  const existing = await db.eyeExaminations.get(id)
  if (!existing) throw new Error(`Examination ${id} not found`)
  const { deletedAt: _d, ...rest } = existing as EyeExamination & { deletedAt?: string }
  await db.eyeExaminations.put({ ...rest, updatedAt: new Date().toISOString() } as EyeExamination)
}

// ── Query ─────────────────────────────────────────────────────────────────────

export async function getPatientExaminations(
  patientId: string,
  includeArchived = false,
  db: BarOptDB = globalDb,
): Promise<EyeExamination[]> {
  const all = await db.eyeExaminations
    .where('patientId').equals(patientId)
    .toArray()
  const filtered = includeArchived ? all : all.filter(e => !e.deletedAt)
  return filtered.sort((a, b) => b.examinationDate.localeCompare(a.examinationDate))
}

export async function getExamination(
  id: string,
  db: BarOptDB = globalDb,
): Promise<EyeExamination | undefined> {
  return db.eyeExaminations.get(id)
}

export async function getAllExaminations(
  includeArchived = false,
  db: BarOptDB = globalDb,
): Promise<EyeExamination[]> {
  const all = await db.eyeExaminations.toArray()
  const filtered = includeArchived ? all : all.filter(e => !e.deletedAt)
  return filtered.sort((a, b) => b.examinationDate.localeCompare(a.examinationDate))
}

// ── Create prescription ───────────────────────────────────────────────────────

export async function createPrescription(
  data: PrescriptionFormValues & { patientId: string; examinationId?: string },
  db: BarOptDB = globalDb,
): Promise<Prescription> {
  const patient = await db.patients.get(data.patientId)
  if (!patient) throw new Error(`Patient ${data.patientId} not found`)
  if (data.examinationId) {
    const exam = await db.eyeExaminations.get(data.examinationId)
    if (!exam) throw new Error(`Examination ${data.examinationId} not found`)
  }

  const prescriptionNumber = await getNextPrescriptionNumber(db)
  const now = new Date().toISOString()

  const rx: Prescription = {
    id: uuidv4(),
    patientId: data.patientId,
    examinationId: data.examinationId,
    prescriptionNumber,
    prescriptionDate: data.prescriptionDate,
    examinedBy: data.examinedBy || undefined,
    validUntil: data.validUntil || undefined,
    reSphere: data.reSphere,
    reCylinder: data.reCylinder,
    reAxis: data.reAxis,
    reAdd: data.reAdd,
    rePrismPower: data.rePrismPower,
    rePrismBase: data.rePrismBase || undefined,
    reVA: data.reVA || undefined,
    rePd: data.rePd,
    leSphere: data.leSphere,
    leCylinder: data.leCylinder,
    leAxis: data.leAxis,
    leAdd: data.leAdd,
    lePrismPower: data.lePrismPower,
    lePrismBase: data.lePrismBase || undefined,
    leVA: data.leVA || undefined,
    lePd: data.lePd,
    pdDistance: data.pdDistance,
    pdNear: data.pdNear,
    lensType: data.lensType || undefined,
    notes: data.notes || undefined,
    createdAt: now,
    updatedAt: now,
  }

  await db.prescriptions.add(rx)
  return rx
}

// ── Get prescriptions for exam ────────────────────────────────────────────────

export async function getExaminationPrescriptions(
  examinationId: string,
  db: BarOptDB = globalDb,
): Promise<Prescription[]> {
  return db.prescriptions
    .where('examinationId').equals(examinationId)
    .filter(r => !r.deletedAt)
    .toArray()
}

export async function getPatientPrescriptions(
  patientId: string,
  db: BarOptDB = globalDb,
): Promise<Prescription[]> {
  const all = await db.prescriptions
    .where('patientId').equals(patientId)
    .filter(r => !r.deletedAt)
    .toArray()
  return all.sort((a, b) => b.prescriptionDate.localeCompare(a.prescriptionDate))
}

// ── Compare two examinations ──────────────────────────────────────────────────

export type ExamDiff = {
  field: string
  labelAr: string
  labelEn: string
  valueA: string | number | undefined
  valueB: string | number | undefined
  diff: number | null  // numeric difference (B - A), null if not comparable
}

export function compareExaminations(a: EyeExamination, b: EyeExamination): ExamDiff[] {
  const numFmt = (v: number | undefined) => v !== undefined ? (v >= 0 ? `+${v}` : `${v}`) : '—'
  const strFmt = (v: string | undefined) => v ?? '—'

  const numDiff = (vA: number | undefined, vB: number | undefined): number | null => {
    if (vA === undefined && vB === undefined) return null
    const nA = vA ?? 0
    const nB = vB ?? 0
    return Math.round((nB - nA) * 100) / 100
  }

  return [
    { field: 'reSphere',   labelAr: 'OD كروي',    labelEn: 'OD SPH',  valueA: numFmt(a.reSphere),   valueB: numFmt(b.reSphere),   diff: numDiff(a.reSphere, b.reSphere) },
    { field: 'reCylinder', labelAr: 'OD أسطواني', labelEn: 'OD CYL',  valueA: numFmt(a.reCylinder), valueB: numFmt(b.reCylinder), diff: numDiff(a.reCylinder, b.reCylinder) },
    { field: 'reAxis',     labelAr: 'OD محور',    labelEn: 'OD AXIS', valueA: a.reAxis ?? '—',       valueB: b.reAxis ?? '—',       diff: numDiff(a.reAxis, b.reAxis) },
    { field: 'reAdd',      labelAr: 'OD إضافة',   labelEn: 'OD ADD',  valueA: numFmt(a.reAdd),       valueB: numFmt(b.reAdd),       diff: numDiff(a.reAdd, b.reAdd) },
    { field: 'leSphere',   labelAr: 'OS كروي',    labelEn: 'OS SPH',  valueA: numFmt(a.leSphere),   valueB: numFmt(b.leSphere),   diff: numDiff(a.leSphere, b.leSphere) },
    { field: 'leCylinder', labelAr: 'OS أسطواني', labelEn: 'OS CYL',  valueA: numFmt(a.leCylinder), valueB: numFmt(b.leCylinder), diff: numDiff(a.leCylinder, b.leCylinder) },
    { field: 'leAxis',     labelAr: 'OS محور',    labelEn: 'OS AXIS', valueA: a.leAxis ?? '—',       valueB: b.leAxis ?? '—',       diff: numDiff(a.leAxis, b.leAxis) },
    { field: 'leAdd',      labelAr: 'OS إضافة',   labelEn: 'OS ADD',  valueA: numFmt(a.leAdd),       valueB: numFmt(b.leAdd),       diff: numDiff(a.leAdd, b.leAdd) },
    { field: 'pdDistance', labelAr: 'بعد البؤبؤ', labelEn: 'PD',      valueA: a.pdDistance ? `${a.pdDistance}mm` : strFmt(undefined), valueB: b.pdDistance ? `${b.pdDistance}mm` : strFmt(undefined), diff: numDiff(a.pdDistance, b.pdDistance) },
    { field: 'vaRight',    labelAr: 'OD حدة',     labelEn: 'OD VA',   valueA: strFmt(a.visualAcuityRight), valueB: strFmt(b.visualAcuityRight), diff: null },
    { field: 'vaLeft',     labelAr: 'OS حدة',     labelEn: 'OS VA',   valueA: strFmt(a.visualAcuityLeft),  valueB: strFmt(b.visualAcuityLeft),  diff: null },
  ]
}
