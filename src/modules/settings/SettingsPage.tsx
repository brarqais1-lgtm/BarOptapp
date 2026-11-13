import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'
import { batchSetSettings } from './SettingsRepository'
import { useTheme } from '../../contexts/ThemeContext'
import { setLocale, type SupportedLocale } from '../../i18n'
import i18n from 'i18next'

type Tab = 'clinic' | 'financial' | 'appearance'

// ── Logo upload helper ────────────────────────────────────────────────────────

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Tab: Clinic Info ──────────────────────────────────────────────────────────

function ClinicTab() {
  const { t } = useTranslation()
  const logoRef = useRef<HTMLInputElement>(null)

  const clinic = useLiveQuery(async () => {
    const rows = await db.settings
      .filter(s => ['clinic_name', 'clinic_address', 'clinic_phone', 'clinic_logo'].includes(s.key) && !s.deletedAt)
      .toArray()
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    return map
  }, [])

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [logoPreview, setLogoPreview] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (clinic !== undefined && !initialized) {
    setName((clinic as Record<string, string>)['clinic_name'] ?? '')
    setAddress((clinic as Record<string, string>)['clinic_address'] ?? '')
    setPhone((clinic as Record<string, string>)['clinic_phone'] ?? '')
    setLogoPreview((clinic as Record<string, string>)['clinic_logo'] ?? '')
    setInitialized(true)
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await readFileAsDataURL(file)
    setLogoPreview(dataUrl)
  }

  function removeLogo() {
    setLogoPreview('')
    if (logoRef.current) logoRef.current.value = ''
  }

  async function handleSave() {
    setSaving(true)
    await batchSetSettings([
      { key: 'clinic_name', value: name, group: 'clinic' },
      { key: 'clinic_address', value: address, group: 'clinic' },
      { key: 'clinic_phone', value: phone, group: 'clinic' },
      { key: 'clinic_logo', value: logoPreview, group: 'clinic' },
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('settings.clinic.name')}
        </label>
        <input
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('settings.clinic.namePlaceholder')}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('settings.clinic.phone')}
        </label>
        <input
          className="form-input"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder={t('settings.clinic.phonePlaceholder')}
          dir="ltr"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('settings.clinic.address')}
        </label>
        <textarea
          className="form-input min-h-[72px] resize-none"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder={t('settings.clinic.addressPlaceholder')}
          rows={3}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('settings.clinic.logo')}
        </label>
        {logoPreview ? (
          <div className="flex items-start gap-4">
            <img src={logoPreview} alt="Logo" className="h-20 w-auto rounded-lg border border-slate-200 dark:border-slate-700 object-contain bg-white p-1" />
            <button
              onClick={removeLogo}
              className="text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              {t('settings.clinic.removeLogo')}
            </button>
          </div>
        ) : (
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <span>📁</span>
            <span>{t('settings.clinic.uploadLogo')}</span>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleLogoChange}
            />
          </label>
        )}
        <p className="mt-1 text-xs text-slate-400">{t('settings.clinic.logoHint')}</p>
      </div>

      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
        >
          {saving ? t('common.saving') : saved ? t('settings.saved') : t('common.save')}
        </button>
      </div>
    </div>
  )
}

// ── Tab: Financial ────────────────────────────────────────────────────────────

function FinancialTab() {
  const { t } = useTranslation()

  const financial = useLiveQuery(async () => {
    const rows = await db.settings
      .filter(s => ['currency', 'tax_rate'].includes(s.key) && !s.deletedAt)
      .toArray()
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    return map
  }, [])

  const [currency, setCurrency] = useState('')
  const [taxRate, setTaxRate] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (financial !== undefined && !initialized) {
    setCurrency((financial as Record<string, string>)['currency'] ?? 'IQD')
    setTaxRate((financial as Record<string, string>)['tax_rate'] ?? '15')
    setInitialized(true)
  }

  async function handleSave() {
    setSaving(true)
    await batchSetSettings([
      { key: 'currency', value: currency, group: 'financial' },
      { key: 'tax_rate', value: taxRate, group: 'financial' },
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('settings.financial.currency')}
        </label>
        <select
          className="form-input"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
        >
          <option value="SAR">SAR — {t('settings.financial.currencies.SAR')}</option>
          <option value="USD">USD — {t('settings.financial.currencies.USD')}</option>
          <option value="EUR">EUR — {t('settings.financial.currencies.EUR')}</option>
          <option value="AED">AED — {t('settings.financial.currencies.AED')}</option>
          <option value="KWD">KWD — {t('settings.financial.currencies.KWD')}</option>
          <option value="QAR">QAR — {t('settings.financial.currencies.QAR')}</option>
          <option value="BHD">BHD — {t('settings.financial.currencies.BHD')}</option>
          <option value="JOD">JOD — {t('settings.financial.currencies.JOD')}</option>
          <option value="EGP">EGP — {t('settings.financial.currencies.EGP')}</option>
          <option value="IQD">IQD — {t('settings.financial.currencies.IQD')}</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('settings.financial.taxRate')}
          <span className="ms-1 text-slate-400 text-xs">%</span>
        </label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.5"
          className="form-input"
          value={taxRate}
          onChange={e => setTaxRate(e.target.value)}
          dir="ltr"
        />
        <p className="mt-1 text-xs text-slate-400">{t('settings.financial.taxRateHint')}</p>
      </div>

      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
        >
          {saving ? t('common.saving') : saved ? t('settings.saved') : t('common.save')}
        </button>
      </div>
    </div>
  )
}

// ── Tab: Appearance ───────────────────────────────────────────────────────────

function AppearanceTab() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>(
    (i18n.language as SupportedLocale) || 'ar'
  )

  function handleLocale(locale: SupportedLocale) {
    setLocale(locale)
    setCurrentLocale(locale)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          {t('settings.appearance.language')}
        </p>
        <div className="flex gap-3">
          {(['ar', 'en'] as SupportedLocale[]).map(locale => (
            <button
              key={locale}
              onClick={() => handleLocale(locale)}
              className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                currentLocale === locale
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {locale === 'ar' ? '🇸🇦 العربية' : '🇬🇧 English'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          {t('settings.appearance.theme')}
        </p>
        <div className="flex gap-3">
          {(['light', 'dark'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { if (theme !== mode) toggleTheme() }}
              className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                theme === mode
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {mode === 'light' ? '☀️ ' + t('theme.light') : '🌙 ' + t('theme.dark')}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main SettingsPage ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('clinic')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'clinic', label: t('settings.tabs.clinic') },
    { key: 'financial', label: t('settings.tabs.financial') },
    { key: 'appearance', label: t('settings.tabs.appearance') },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('settings.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('settings.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === key
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        {tab === 'clinic' && <ClinicTab />}
        {tab === 'financial' && <FinancialTab />}
        {tab === 'appearance' && <AppearanceTab />}
      </div>
    </div>
  )
}
