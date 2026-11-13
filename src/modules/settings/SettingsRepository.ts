import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { Setting } from '../../database/schema'

export async function getSetting(key: string, db: BarOptDB = globalDb): Promise<string | undefined> {
  const row = await db.settings.filter(s => s.key === key && !s.deletedAt).first()
  return row?.value
}

export async function setSetting(
  key: string,
  value: string,
  group?: string,
  db: BarOptDB = globalDb,
): Promise<void> {
  const existing = await db.settings.filter(s => s.key === key && !s.deletedAt).first()
  const now = new Date().toISOString()
  if (existing) {
    await db.settings.update(existing.id, { value, updatedAt: now })
  } else {
    const record: Setting = {
      id: uuidv4(),
      key,
      value,
      group,
      createdAt: now,
      updatedAt: now,
    }
    await db.settings.add(record)
  }
}

export async function getSettingsByGroup(
  group: string,
  db: BarOptDB = globalDb,
): Promise<Record<string, string>> {
  const rows = await db.settings.filter(s => s.group === group && !s.deletedAt).toArray()
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}

export async function batchSetSettings(
  entries: Array<{ key: string; value: string; group?: string }>,
  db: BarOptDB = globalDb,
): Promise<void> {
  for (const { key, value, group } of entries) {
    await setSetting(key, value, group, db)
  }
}

// ── Typed helpers for clinic settings ────────────────────────────────────────

export interface ClinicSettings {
  clinic_name: string
  clinic_address: string
  clinic_phone: string
  clinic_logo: string
}

export async function getClinicSettings(db: BarOptDB = globalDb): Promise<ClinicSettings> {
  const rows = await db.settings
    .filter(s => ['clinic_name', 'clinic_address', 'clinic_phone', 'clinic_logo'].includes(s.key) && !s.deletedAt)
    .toArray()
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value
  return {
    clinic_name: map['clinic_name'] ?? '',
    clinic_address: map['clinic_address'] ?? '',
    clinic_phone: map['clinic_phone'] ?? '',
    clinic_logo: map['clinic_logo'] ?? '',
  }
}

export interface FinancialSettings {
  currency: string
  tax_rate: string
}

export async function getFinancialSettings(db: BarOptDB = globalDb): Promise<FinancialSettings> {
  const rows = await db.settings
    .filter(s => ['currency', 'tax_rate'].includes(s.key) && !s.deletedAt)
    .toArray()
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value
  return {
    currency: map['currency'] ?? 'IQD',
    tax_rate: map['tax_rate'] ?? '15',
  }
}
