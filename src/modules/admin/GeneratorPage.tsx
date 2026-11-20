import { useState, useEffect } from 'react'
import { generateLicenseCode } from '../../services/license.service'

interface HistoryEntry {
  storeId: number
  storeName: string
  code: string
  date: string
}

const HISTORY_KEY = 'baropt-gen-history'

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}
function saveHistory(h: HistoryEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)) } catch { /* ignore */ }
}

export default function GeneratorPage() {
  const [storeName, setStoreName] = useState('')
  const [storeId, setStoreId] = useState('')
  const [code, setCode] = useState('')
  const [codeLabel, setCodeLabel] = useState('')
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  useEffect(() => { saveHistory(history) }, [history])

  async function generate() {
    const id = parseInt(storeId)
    if (!id || id < 1 || id > 9999) {
      alert('أدخل رقم محل صحيح بين 1 و 9999')
      return
    }
    const generated = await generateLicenseCode(id)
    setCode(generated)
    setCopied(false)
    setCodeLabel(storeName.trim() ? `كود تفعيل: ${storeName.trim()}` : `كود تفعيل (محل #${id})`)

    const entry: HistoryEntry = {
      storeId: id,
      storeName: storeName.trim() || `محل #${id}`,
      code: generated,
      date: new Date().toLocaleDateString('ar-IQ'),
    }
    setHistory(prev => {
      const filtered = prev.filter(h => h.storeId !== id)
      const next = [entry, ...filtered].slice(0, 50)
      return next
    })
  }

  async function copyCode(text: string, idx?: number) {
    await navigator.clipboard.writeText(text)
    if (idx === undefined) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    }
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4" dir="rtl">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-700 rounded-2xl text-white text-3xl font-black mb-3">B</div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">أداة توليد الأكواد</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">خاصة بك — لا تشاركها مع أحد</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">اسم المحل</label>
            <input
              type="text"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="مثال: بصريات الأمين"
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">رقم المحل (1 – 9999)</label>
            <input
              type="number"
              value={storeId}
              onChange={e => setStoreId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
              min={1}
              max={9999}
              placeholder="1"
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 transition-colors text-center font-mono tracking-widest"
            />
          </div>

          <button
            onClick={generate}
            className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl transition-colors text-sm"
          >
            ⚡ توليد الكود
          </button>
        </div>

        {/* Result */}
        {code && (
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5 text-center">
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">{codeLabel}</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 font-mono tracking-widest">{code}</div>
            <button
              onClick={() => copyCode(code)}
              className={`mt-3 px-5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-700 hover:bg-blue-800 text-white'
              }`}
            >
              {copied ? '✅ تم النسخ!' : '📋 نسخ الكود'}
            </button>
          </div>
        )}

        {/* Warning */}
        <div className="mt-5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl px-4 py-3 text-xs text-yellow-800 dark:text-yellow-300">
          ⚠️ هذه الصفحة سرية — لا تشارك الرابط مع العملاء
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">الأكواد المولّدة</h2>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-xl px-4 py-2.5">
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{h.storeName}</div>
                    <div className="text-xs font-mono text-blue-600 dark:text-blue-400 tracking-wide">{h.code}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{h.date}</div>
                  </div>
                  <button
                    onClick={() => copyCode(h.code, i)}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    {copiedIdx === i ? '✅' : 'نسخ'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
