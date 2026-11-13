import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'
import { batchSetSettings } from './SettingsRepository'
import { useTheme } from '../../contexts/ThemeContext'
import { setLocale, type SupportedLocale } from '../../i18n'
import { createBackup, downloadBackup, validateBackupFile, restoreBackup } from '../../services/backup.service'
import i18n from 'i18next'

type Tab = 'clinic' | 'financial' | 'appearance' | 'invoices' | 'backup'

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

function applyFontSize(size: string) {
  const root = document.documentElement
  root.setAttribute('data-font-size', size)
  try { localStorage.setItem('baropt-font-size', size) } catch { /* ignore */ }
}

// ── Save Button ───────────────────────────────────────────────────────────────

function SaveButton({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  const { t } = useTranslation()
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-5 py-2 rounded-xl bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
    >
      {saving ? t('common.saving') : saved ? t('settings.saved') : t('common.save')}
    </button>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-5">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
    </div>
  )
}

// ── Tab: Clinic Info ──────────────────────────────────────────────────────────

function ClinicTab() {
  const { t } = useTranslation()
  const logoRef = useRef<HTMLInputElement>(null)

  const clinic = useLiveQuery(async () => {
    const keys = ['clinic_name', 'clinic_address', 'clinic_phone', 'clinic_whatsapp', 'clinic_email', 'clinic_website', 'clinic_description', 'clinic_logo']
    const rows = await db.settings.filter(s => keys.includes(s.key) && !s.deletedAt).toArray()
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    return map
  }, [])

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [logoPreview, setLogoPreview] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (clinic !== undefined && !initialized) {
    setName(clinic['clinic_name'] ?? '')
    setPhone(clinic['clinic_phone'] ?? '')
    setWhatsapp(clinic['clinic_whatsapp'] ?? '')
    setEmail(clinic['clinic_email'] ?? '')
    setWebsite(clinic['clinic_website'] ?? '')
    setAddress(clinic['clinic_address'] ?? '')
    setDescription(clinic['clinic_description'] ?? '')
    setLogoPreview(clinic['clinic_logo'] ?? '')
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
      { key: 'clinic_phone', value: phone, group: 'clinic' },
      { key: 'clinic_whatsapp', value: whatsapp, group: 'clinic' },
      { key: 'clinic_email', value: email, group: 'clinic' },
      { key: 'clinic_website', value: website, group: 'clinic' },
      { key: 'clinic_address', value: address, group: 'clinic' },
      { key: 'clinic_description', value: description, group: 'clinic' },
      { key: 'clinic_logo', value: logoPreview, group: 'clinic' },
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-5">
      <SectionHeader title={t('settings.clinic.name')} />

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
          {t('settings.clinic.description')}
        </label>
        <input
          className="form-input"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={t('settings.clinic.descriptionPlaceholder')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            {t('settings.clinic.whatsapp')}
          </label>
          <input
            className="form-input"
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
            placeholder={t('settings.clinic.whatsappPlaceholder')}
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('settings.clinic.email')}
          </label>
          <input
            type="email"
            className="form-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('settings.clinic.emailPlaceholder')}
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('settings.clinic.website')}
          </label>
          <input
            type="url"
            className="form-input"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            placeholder={t('settings.clinic.websitePlaceholder')}
            dir="ltr"
          />
        </div>
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
            <img
              src={logoPreview}
              alt="Logo"
              className="h-20 w-auto rounded-lg border border-slate-200 dark:border-slate-700 object-contain bg-white p-1"
            />
            <button onClick={removeLogo} className="text-sm text-red-600 dark:text-red-400 hover:underline mt-1">
              {t('settings.clinic.removeLogo')}
            </button>
          </div>
        ) : (
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <span>📁</span>
            <span>{t('settings.clinic.uploadLogo')}</span>
            <input ref={logoRef} type="file" accept="image/*" className="sr-only" onChange={handleLogoChange} />
          </label>
        )}
        <p className="mt-1 text-xs text-slate-400">{t('settings.clinic.logoHint')}</p>
      </div>

      <div className="pt-2">
        <SaveButton onClick={handleSave} saving={saving} saved={saved} />
      </div>
    </div>
  )
}

// ── Tab: Financial ────────────────────────────────────────────────────────────

function FinancialTab() {
  const { t } = useTranslation()

  const financial = useLiveQuery(async () => {
    const rows = await db.settings
      .filter(s => ['currency', 'tax_rate', 'invoice_prefix', 'low_stock_threshold'].includes(s.key) && !s.deletedAt)
      .toArray()
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    return map
  }, [])

  const [currency, setCurrency] = useState('')
  const [taxRate, setTaxRate] = useState('')
  const [invoicePrefix, setInvoicePrefix] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (financial !== undefined && !initialized) {
    setCurrency(financial['currency'] ?? 'IQD')
    setTaxRate(financial['tax_rate'] ?? '0')
    setInvoicePrefix(financial['invoice_prefix'] ?? 'INV-')
    setLowStockThreshold(financial['low_stock_threshold'] ?? '5')
    setInitialized(true)
  }

  async function handleSave() {
    setSaving(true)
    await batchSetSettings([
      { key: 'currency', value: currency, group: 'financial' },
      { key: 'tax_rate', value: taxRate, group: 'financial' },
      { key: 'invoice_prefix', value: invoicePrefix, group: 'financial' },
      { key: 'low_stock_threshold', value: lowStockThreshold, group: 'financial' },
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
        <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
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

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('settings.financial.invoicePrefix')}
        </label>
        <input
          className="form-input max-w-xs"
          value={invoicePrefix}
          onChange={e => setInvoicePrefix(e.target.value)}
          placeholder="INV-"
          dir="ltr"
          maxLength={10}
        />
        <p className="mt-1 text-xs text-slate-400">{t('settings.financial.invoicePrefixHint')}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('settings.financial.lowStockThreshold')}
        </label>
        <input
          type="number"
          min="1"
          max="100"
          className="form-input max-w-xs"
          value={lowStockThreshold}
          onChange={e => setLowStockThreshold(e.target.value)}
          dir="ltr"
        />
        <p className="mt-1 text-xs text-slate-400">{t('settings.financial.lowStockThresholdHint')}</p>
      </div>

      <div className="pt-2">
        <SaveButton onClick={handleSave} saving={saving} saved={saved} />
      </div>
    </div>
  )
}

// ── Tab: Appearance ───────────────────────────────────────────────────────────

function AppearanceTab() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>(
    (i18n.language as SupportedLocale) || 'ar'
  )
  const [fontSize, setFontSizeState] = useState<string>(() => {
    try { return localStorage.getItem('baropt-font-size') ?? 'medium' } catch { return 'medium' }
  })

  function handleLocale(locale: SupportedLocale) {
    setLocale(locale)
    setCurrentLocale(locale)
  }

  function handleFontSize(size: string) {
    setFontSizeState(size)
    applyFontSize(size)
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
              onClick={() => setTheme(mode)}
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

      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          {t('settings.appearance.fontSize')}
        </p>
        <div className="flex gap-3">
          {(['small', 'medium', 'large'] as const).map(size => (
            <button
              key={size}
              onClick={() => handleFontSize(size)}
              className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                fontSize === size
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {t(`settings.appearance.fontSizes.${size}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Invoices ─────────────────────────────────────────────────────────────

function InvoicesTab() {
  const { t } = useTranslation()

  const invoiceSettings = useLiveQuery(async () => {
    const rows = await db.settings
      .filter(s => ['invoice_footer', 'show_logo_on_invoice', 'paper_size'].includes(s.key) && !s.deletedAt)
      .toArray()
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    return map
  }, [])

  const [footer, setFooter] = useState('')
  const [showLogo, setShowLogo] = useState(true)
  const [paperSize, setPaperSize] = useState('A4')
  const [initialized, setInitialized] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (invoiceSettings !== undefined && !initialized) {
    setFooter(invoiceSettings['invoice_footer'] ?? '')
    setShowLogo((invoiceSettings['show_logo_on_invoice'] ?? 'true') === 'true')
    setPaperSize(invoiceSettings['paper_size'] ?? 'A4')
    setInitialized(true)
  }

  async function handleSave() {
    setSaving(true)
    await batchSetSettings([
      { key: 'invoice_footer', value: footer, group: 'invoices' },
      { key: 'show_logo_on_invoice', value: String(showLogo), group: 'invoices' },
      { key: 'paper_size', value: paperSize, group: 'invoices' },
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('settings.invoices.footer')}
        </label>
        <textarea
          className="form-input min-h-[80px] resize-none"
          value={footer}
          onChange={e => setFooter(e.target.value)}
          placeholder={t('settings.invoices.footerPlaceholder')}
          rows={3}
          maxLength={300}
        />
        <p className="mt-1 text-xs text-slate-400">{footer.length}/300</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('settings.invoices.paperSize')}
        </label>
        <div className="flex gap-3">
          {(['A4', 'A5', 'receipt'] as const).map(size => (
            <button
              key={size}
              onClick={() => setPaperSize(size)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                paperSize === size
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {t(`settings.invoices.paperSizes.${size}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-3 cursor-pointer group">
          <div
            onClick={() => setShowLogo(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors ${showLogo ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${showLogo ? 'start-5' : 'start-0.5'}`} />
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('settings.invoices.showLogo')}
          </span>
        </label>
      </div>

      <div className="pt-2">
        <SaveButton onClick={handleSave} saving={saving} saved={saved} />
      </div>
    </div>
  )
}

// ── Tab: Backup ───────────────────────────────────────────────────────────────

function BackupTab() {
  const { t } = useTranslation()
  const importRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  function showMsg(text: string, type: 'success' | 'error') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const backup = await createBackup()
      downloadBackup(backup)
      showMsg(t('settings.backup.exportSuccess'), 'success')
    } catch (e) {
      showMsg((e as Error).message, 'error')
    } finally {
      setExporting(false)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await readFileAsText(file)
      const raw = JSON.parse(text)
      const backup = await validateBackupFile(raw)
      const result = await restoreBackup(backup, { overwrite: true })
      if (result.success) {
        showMsg(t('settings.backup.importSuccess'), 'success')
      } else {
        showMsg(result.error, 'error')
      }
    } catch (e) {
      showMsg((e as Error).message, 'error')
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Export */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-xl flex-shrink-0">
            📤
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
              {t('settings.backup.exportTitle')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {t('settings.backup.exportDesc')}
            </p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {exporting ? t('settings.backup.exporting') : t('settings.backup.exportBtn')}
            </button>
          </div>
        </div>
      </div>

      {/* Import */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xl flex-shrink-0">
            📥
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
              {t('settings.backup.importTitle')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              {t('settings.backup.importDesc')}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-4 font-medium">
              ⚠️ {t('settings.backup.importWarning')}
            </p>
            <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium cursor-pointer transition-colors ${
              importing
                ? 'opacity-50 cursor-not-allowed border-slate-200 text-slate-400'
                : 'border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
            }`}>
              <span>📂</span>
              <span>{importing ? t('settings.backup.importing') : t('settings.backup.selectFile')}</span>
              <input
                ref={importRef}
                type="file"
                accept=".json"
                className="sr-only"
                onChange={handleImport}
                disabled={importing}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main SettingsPage ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('clinic')

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'clinic', label: t('settings.tabs.clinic'), icon: '🏪' },
    { key: 'financial', label: t('settings.tabs.financial'), icon: '💰' },
    { key: 'appearance', label: t('settings.tabs.appearance'), icon: '🎨' },
    { key: 'invoices', label: t('settings.tabs.invoices'), icon: '🧾' },
    { key: 'backup', label: t('settings.tabs.backup'), icon: '💾' },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('settings.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('settings.subtitle')}</p>
      </div>

      {/* Tabs — scrollable on small screens */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === key
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <span className="text-base leading-none">{icon}</span>
            <span className="whitespace-nowrap">{label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        {tab === 'clinic' && <ClinicTab />}
        {tab === 'financial' && <FinancialTab />}
        {tab === 'appearance' && <AppearanceTab />}
        {tab === 'invoices' && <InvoicesTab />}
        {tab === 'backup' && <BackupTab />}
      </div>
    </div>
  )
}
