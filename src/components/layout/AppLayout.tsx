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
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <div className="w-7 h-7 rounded-lg bg-blue-700 flex items-center justify-center text-white font-bold text-sm">B</div>
          <span className="font-semibold text-slate-900 dark:text-white text-sm">{t('app.name')}</span>
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
