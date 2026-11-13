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
  clinic_whatsapp: string
  clinic_email: string
  clinic_website: string
  clinic_description: string
  clinic_logo: string
}

export async function getClinicSettings(db: BarOptDB = globalDb): Promise<ClinicSettings> {
  const keys = ['clinic_name', 'clinic_address', 'clinic_phone', 'clinic_whatsapp', 'clinic_email', 'clinic_website', 'clinic_description', 'clinic_logo']
  const rows = await db.settings.filter(s => keys.includes(s.key) && !s.deletedAt).toArray()
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value
  return {
    clinic_name: map['clinic_name'] ?? '',
    clinic_address: map['clinic_address'] ?? '',
    clinic_phone: map['clinic_phone'] ?? '',
    clinic_whatsapp: map['clinic_whatsapp'] ?? '',
    clinic_email: map['clinic_email'] ?? '',
    clinic_website: map['clinic_website'] ?? '',
    clinic_description: map['clinic_description'] ?? '',
    clinic_logo: map['clinic_logo'] ?? '',
  }
}

export interface FinancialSettings {
  currency: string
  tax_rate: string
  invoice_prefix: string
  low_stock_threshold: string
}

export async function getFinancialSettings(db: BarOptDB = globalDb): Promise<FinancialSettings> {
  const rows = await db.settings
    .filter(s => ['currency', 'tax_rate', 'invoice_prefix', 'low_stock_threshold'].includes(s.key) && !s.deletedAt)
    .toArray()
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value
  return {
    currency: map['currency'] ?? 'IQD',
    tax_rate: map['tax_rate'] ?? '0',
    invoice_prefix: map['invoice_prefix'] ?? 'INV-',
    low_stock_threshold: map['low_stock_threshold'] ?? '5',
  }
}

export interface InvoiceSettings {
  invoice_footer: string
  show_logo_on_invoice: string
  paper_size: string
}

export async function getInvoiceSettings(db: BarOptDB = globalDb): Promise<InvoiceSettings> {
  const rows = await db.settings
    .filter(s => ['invoice_footer', 'show_logo_on_invoice', 'paper_size'].includes(s.key) && !s.deletedAt)
    .toArray()
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value
  return {
    invoice_footer: map['invoice_footer'] ?? '',
    show_logo_on_invoice: map['show_logo_on_invoice'] ?? 'true',
    paper_size: map['paper_size'] ?? 'A4',
  }
}
