import { useState, useEffect, type ReactNode } from 'react'
import { validateLicenseCode, saveActivation, isActivated } from '../services/license.service'

export function ActivationGate({ children }: { children: ReactNode }) {
  const [activated, setActivated] = useState<boolean | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setActivated(isActivated())
  }, [])

  async function handleActivate() {
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      const storeId = await validateLicenseCode(code)
      if (storeId !== null) {
        saveActivation(code.trim().replace(/\D/g, ''), storeId)
        setActivated(true)
      } else {
        setError('كود التفعيل غير صحيح. تحقق من الكود وأعد المحاولة.')
      }
    } catch {
      setError('حدث خطأ. أعد المحاولة.')
    } finally {
      setLoading(false)
    }
  }

  // Still checking
  if (activated === null) return null

  // Allow seller generator without activation
  if (window.location.hash.startsWith('#/admin/gen')) return <>{children}</>

  // Already activated
  if (activated) return <>{children}</>

  // Lock screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-4 shadow-2xl">
            <span className="text-4xl font-black text-white">B</span>
          </div>
          <h1 className="text-2xl font-bold text-white">BarOpt</h1>
          <p className="text-blue-200 text-sm mt-1">نظام إدارة محلات النظارات</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 space-y-5">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">🔑</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800">تفعيل النظام</h2>
            <p className="text-sm text-slate-500 mt-1">
              أدخل كود التفعيل الخاص بك للمتابعة
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              كود التفعيل
            </label>
            <input
              type="text"
              value={code}
              onChange={e => {
                setError('')
                setCode(e.target.value.replace(/\D/g, '').slice(0, 8))
              }}
              onKeyDown={e => e.key === 'Enter' && handleActivate()}
              placeholder="12345678"
              maxLength={8}
              inputMode="numeric"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono text-xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
              dir="ltr"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleActivate}
            disabled={loading || code.length < 8}
            className="w-full py-3 rounded-xl bg-blue-700 text-white font-semibold text-sm hover:bg-blue-800 active:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'جارٍ التحقق...' : 'تفعيل النظام'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            للحصول على كود التفعيل تواصل مع المورد
          </p>
        </div>
      </div>
    </div>
  )
}
