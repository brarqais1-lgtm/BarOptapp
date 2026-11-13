import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { Patient, Setting } from '../../database/schema'
import { normalizePhone, normalizeSearch } from '../../utils/format'

export type SortField = 'createdAt' | 'fullName' | 'fileNumber'
export type SortDir = 'asc' | 'desc'

export interface PatientSearchParams {
  query?: string
  sortField?: SortField
  sortDir?: SortDir
  includeDeleted?: boolean
  page?: number
  pageSize?: number
}

export interface PatientSearchResult {
  patients: Patient[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ── File Number generation ────────────────────────────────────────────────────

export async function getNextFileNumber(db: BarOptDB = globalDb): Promise<string> {
  return db.transaction('rw', [db.settings], async () => {
    const existing = await db.settings
      .where({ key: 'patient_sequence' })
      .first()
    const current = existing ? (JSON.parse(existing.value) as number) : 0
    const next = current + 1
    const now = new Date().toISOString()
    if (existing) {
      await db.settings.update(existing.id, { value: JSON.stringify(next), updatedAt: now })
    } else {
      const newSetting: Setting = {
        id: uuidv4(),
        key: 'patient_sequence',
        value: JSON.stringify(next),
        group: 'system',
        createdAt: now,
        updatedAt: now,
      }
      await db.settings.add(newSetting)
    }
    return `P-${String(next).padStart(6, '0')}`
  })
}

// ── Duplicate detection ───────────────────────────────────────────────────────

export async function findDuplicateCandidates(
  fullName: string,
  phone?: string,
  excludeId?: string,
  db: BarOptDB = globalDb,
): Promise<Patient[]> {
  const nameLower = normalizeSearch(fullName)
  const phoneLower = phone ? normalizePhone(phone) : ''
  const all = await db.patients.filter(p => !p.deletedAt).toArray()
  return all.filter(p => {
    if (p.id === excludeId) return false
    const nameMatch = p.fullNameNormalized?.includes(nameLower) && nameLower.length >= 2
    const phoneMatch = phoneLower && p.phoneNormalized === phoneLower
    return nameMatch || phoneMatch
  })
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createPatient(
  data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>,
  db: BarOptDB = globalDb,
): Promise<Patient> {
  const now = new Date().toISOString()
  const patient: Patient = {
    ...data,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  }
  await db.patients.add(patient)
  return patient
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updatePatient(
  id: string,
  data: Partial<Omit<Patient, 'id' | 'fileNumber' | 'createdAt'>>,
  db: BarOptDB = globalDb,
): Promise<Patient> {
  const existing = await db.patients.get(id)
  if (!existing) throw new Error(`Patient ${id} not found`)
  const updated: Patient = {
    ...existing,
    ...data,
    id: existing.id,
    fileNumber: existing.fileNumber,  // immutable
    createdAt: existing.createdAt,    // immutable
    updatedAt: new Date().toISOString(),
  }
  await db.patients.put(updated)
  return updated
}

// ── Soft delete / restore ─────────────────────────────────────────────────────

export async function archivePatient(id: string, db: BarOptDB = globalDb): Promise<void> {
  const existing = await db.patients.get(id)
  if (!existing) throw new Error(`Patient ${id} not found`)
  await db.patients.put({ ...existing, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
}

export async function restorePatient(id: string, db: BarOptDB = globalDb): Promise<void> {
  const existing = await db.patients.get(id)
  if (!existing) throw new Error(`Patient ${id} not found`)
  const { deletedAt: _d, ...rest } = existing as Patient & { deletedAt?: string }
  await db.patients.put({ ...rest, updatedAt: new Date().toISOString() } as Patient)
}

// ── Search + Pagination ───────────────────────────────────────────────────────

export async function searchPatients(
  params: PatientSearchParams = {},
  db: BarOptDB = globalDb,
): Promise<PatientSearchResult> {
  const {
    query = '',
    sortField = 'createdAt',
    sortDir = 'desc',
    includeDeleted = false,
    page = 0,
    pageSize = 20,
  } = params

  const q = normalizeSearch(query)

  // Build base collection
  let all = await db.patients.toArray()

  // Filter deleted
  if (!includeDeleted) all = all.filter(p => !p.deletedAt)

  // Apply search
  if (q) {
    const qPhone = normalizePhone(q)
    all = all.filter(p => {
      const nameMatch = (p.fullNameNormalized ?? p.fullName.toLowerCase()).includes(q)
      const phoneMatch = qPhone && (p.phoneNormalized ?? '').includes(qPhone)
      const fileMatch = (p.fileNumber ?? '').toLowerCase().includes(q)
      return nameMatch || phoneMatch || fileMatch
    })
  }

  // Sort
  all.sort((a, b) => {
    let aVal: string, bVal: string
    if (sortField === 'fullName') {
      aVal = a.fullNameNormalized ?? a.fullName
      bVal = b.fullNameNormalized ?? b.fullName
    } else if (sortField === 'fileNumber') {
      aVal = a.fileNumber ?? ''
      bVal = b.fileNumber ?? ''
    } else {
      aVal = a.createdAt
      bVal = b.createdAt
    }
    return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
  })

  const total = all.length
  const offset = page * pageSize
  const patients = all.slice(offset, offset + pageSize)
  return { patients, total, page, pageSize, hasMore: offset + pageSize < total }
}

// ── Today stats ───────────────────────────────────────────────────────────────

export async function getTodayPatientCount(db: BarOptDB = globalDb): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  return db.patients
    .filter(p => !p.deletedAt && p.createdAt.startsWith(today))
    .count()
}

export async function getRecentPatients(limit = 5, db: BarOptDB = globalDb): Promise<Patient[]> {
  const all = await db.patients.filter(p => !p.deletedAt).toArray()
  return all
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}
