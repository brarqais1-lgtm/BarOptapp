import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { useEffect } from 'react'

export function AppLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Sync <html> dir when language changes
  useEffect(() => {
    const sync = () => {
      document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr'
      document.documentElement.lang = i18n.language
    }
    sync()
    i18n.on('languageChanged', sync)
    return () => i18n.off('languageChanged', sync)
  }, [])

  return (
    <div className="flex h-dvh bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile only) */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30">
          <div className="w-8 h-8 rounded-xl bg-blue-700 flex items-center justify-center text-white font-bold text-sm shrink-0">B</div>
          <span className="font-bold text-slate-900 dark:text-white text-base flex-1">{t('app.name')}</span>
          <button
            onClick={() => navigate('/patients/new')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-xl active:bg-blue-800 transition-colors"
          >
            <span className="text-sm">+</span>
            <span>{t('patients.new')}</span>
          </button>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto pb-20 md:pb-0"
          onClick={(e) => {
            // Allow cmd/ctrl+click to open in new tab on <a> tags
            const a = (e.target as HTMLElement).closest('a[href]')
            if (a) return
            // Navigate programmatically from data-href attributes
            const el = (e.target as HTMLElement).closest('[data-navigate]') as HTMLElement | null
            if (el?.dataset.navigate) {
              e.preventDefault()
              navigate(el.dataset.navigate)
            }
          }}
        >
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
