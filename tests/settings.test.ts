/**
 * Phase 10 Tests — Settings Repository
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BarOptDB } from '../src/database/db'
import {
  getSetting,
  setSetting,
  getSettingsByGroup,
  batchSetSettings,
  getClinicSettings,
  getFinancialSettings,
} from '../src/modules/settings/SettingsRepository'

function createTestDB() { return new BarOptDB() }
let db: BarOptDB

beforeEach(async () => { db = createTestDB(); await db.open() })
afterEach(async () => { await db.close(); db.delete() })

// ── 1. getSetting ─────────────────────────────────────────────────────────────

describe('getSetting', () => {
  it('returns undefined for a key that does not exist', async () => {
    expect(await getSetting('nonexistent', db)).toBeUndefined()
  })

  it('returns the value after setSetting', async () => {
    await setSetting('clinic_name', 'Al-Noor Optical', 'clinic', db)
    expect(await getSetting('clinic_name', db)).toBe('Al-Noor Optical')
  })
})

// ── 2. setSetting ─────────────────────────────────────────────────────────────

describe('setSetting', () => {
  it('creates a new setting', async () => {
    await setSetting('clinic_phone', '0501234567', 'clinic', db)
    const all = await db.settings.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].key).toBe('clinic_phone')
    expect(all[0].value).toBe('0501234567')
    expect(all[0].group).toBe('clinic')
  })

  it('updates an existing setting without creating a duplicate', async () => {
    await setSetting('clinic_name', 'Old Name', 'clinic', db)
    await setSetting('clinic_name', 'New Name', 'clinic', db)
    const all = await db.settings.filter(s => s.key === 'clinic_name' && !s.deletedAt).toArray()
    expect(all).toHaveLength(1)
    expect(all[0].value).toBe('New Name')
  })

  it('stores value as a plain string', async () => {
    await setSetting('tax_rate', '15', 'financial', db)
    const val = await getSetting('tax_rate', db)
    expect(val).toBe('15')
  })
})

// ── 3. getSettingsByGroup ─────────────────────────────────────────────────────

describe('getSettingsByGroup', () => {
  it('returns empty object for unknown group', async () => {
    const result = await getSettingsByGroup('unknown', db)
    expect(result).toEqual({})
  })

  it('returns all settings for the given group', async () => {
    await setSetting('clinic_name', 'Test Store', 'clinic', db)
    await setSetting('clinic_phone', '123', 'clinic', db)
    await setSetting('tax_rate', '10', 'financial', db)
    const result = await getSettingsByGroup('clinic', db)
    expect(Object.keys(result)).toHaveLength(2)
    expect(result['clinic_name']).toBe('Test Store')
    expect(result['clinic_phone']).toBe('123')
    expect(result['tax_rate']).toBeUndefined()
  })
})

// ── 4. batchSetSettings ───────────────────────────────────────────────────────

describe('batchSetSettings', () => {
  it('sets multiple settings in one call', async () => {
    await batchSetSettings([
      { key: 'clinic_name', value: 'Store A', group: 'clinic' },
      { key: 'clinic_phone', value: '055', group: 'clinic' },
      { key: 'currency', value: 'SAR', group: 'financial' },
    ], db)
    expect(await getSetting('clinic_name', db)).toBe('Store A')
    expect(await getSetting('clinic_phone', db)).toBe('055')
    expect(await getSetting('currency', db)).toBe('SAR')
  })

  it('updates existing settings in a batch', async () => {
    await setSetting('clinic_name', 'Old', 'clinic', db)
    await batchSetSettings([{ key: 'clinic_name', value: 'New', group: 'clinic' }], db)
    const all = await db.settings.filter(s => s.key === 'clinic_name' && !s.deletedAt).toArray()
    expect(all).toHaveLength(1)
    expect(all[0].value).toBe('New')
  })
})

// ── 5. getClinicSettings ──────────────────────────────────────────────────────

describe('getClinicSettings', () => {
  it('returns defaults when no clinic settings exist', async () => {
    const result = await getClinicSettings(db)
    expect(result.clinic_name).toBe('')
    expect(result.clinic_address).toBe('')
    expect(result.clinic_phone).toBe('')
    expect(result.clinic_logo).toBe('')
  })

  it('returns saved clinic settings', async () => {
    await batchSetSettings([
      { key: 'clinic_name', value: 'Vision Plus', group: 'clinic' },
      { key: 'clinic_phone', value: '+966500000', group: 'clinic' },
    ], db)
    const result = await getClinicSettings(db)
    expect(result.clinic_name).toBe('Vision Plus')
    expect(result.clinic_phone).toBe('+966500000')
    expect(result.clinic_address).toBe('')
  })
})

// ── 6. getFinancialSettings ───────────────────────────────────────────────────

describe('getFinancialSettings', () => {
  it('returns default currency IQD and tax rate 0 when unset', async () => {
    const result = await getFinancialSettings(db)
    expect(result.currency).toBe('IQD')
    expect(result.tax_rate).toBe('0')
  })

  it('returns saved financial settings', async () => {
    await batchSetSettings([
      { key: 'currency', value: 'USD', group: 'financial' },
      { key: 'tax_rate', value: '5', group: 'financial' },
    ], db)
    const result = await getFinancialSettings(db)
    expect(result.currency).toBe('USD')
    expect(result.tax_rate).toBe('5')
  })
})
