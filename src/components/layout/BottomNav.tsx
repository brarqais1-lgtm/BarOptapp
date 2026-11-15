import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const primaryItems = [
  { key: 'dashboard', path: '/dashboard',  icon: '⊞' },
  { key: 'patients',  path: '/patients',   icon: '👤' },
  { key: 'sales',     path: '/sales',      icon: '🧾' },
  { key: 'inventory', path: '/inventory',  icon: '📦' },
]

const drawerSections = [
  {
    label: 'nav.sections.clinical',
    items: [
      { key: 'examinations', path: '/examinations', icon: '👁' },
      { key: 'patients',     path: '/patients',     icon: '👤' },
    ],
  },
  {
    label: 'nav.sections.catalog',
    items: [
      { key: 'frames',    path: '/frames',    icon: '🕶' },
      { key: 'lenses',    path: '/lenses',    icon: '🔬' },
      { key: 'inventory', path: '/inventory', icon: '📦' },
    ],
  },
  {
    label: 'nav.sections.purchasing',
    items: [
      { key: 'suppliers', path: '/suppliers', icon: '🏭' },
      { key: 'purchases', path: '/purchases', icon: '🛒' },
    ],
  },
  {
    label: 'nav.sections.finance',
    items: [
      { key: 'sales',    path: '/sales',    icon: '🧾' },
      { key: 'expenses', path: '/expenses', icon: '📉' },
      { key: 'reports',  path: '/reports',  icon: '📊' },
    ],
  },
  {
    label: 'nav.sections.system',
    items: [
      { key: 'settings', path: '/settings', icon: '⚙' },
    ],
  },
]

export function BottomNav() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  function handleDrawerNav(path: string) {
    setOpen(false)
    navigate(path)
  }

  return (
    <>
      {/* Bottom nav bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex">
          {primaryItems.map(item => (
            <NavLink
              key={item.key}
              to={item.path}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors min-h-[56px] justify-center ${
                  isActive
                    ? 'text-blue-700 dark:text-blue-400'
                    : 'text-slate-400 dark:text-slate-500 active:text-blue-600'
                }`
              }
            >
              <span className="text-[22px] leading-none">{item.icon}</span>
              <span className="mt-0.5">{t(`nav.${item.key}`)}</span>
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setOpen(true)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium text-slate-400 dark:text-slate-500 min-h-[56px] justify-center active:text-blue-600 transition-colors"
          >
            <span className="text-[22px] leading-none">☰</span>
            <span className="mt-0.5">{t('nav.more')}</span>
          </button>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />

          {/* Sheet */}
          <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl max-h-[80vh] overflow-y-auto" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            {/* Handle bar */}
            <div className="sticky top-0 bg-white dark:bg-slate-900 pt-3 pb-2 px-4">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('nav.allPages')}</span>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="px-4 pb-4 space-y-5">
              {drawerSections.map(section => (
                <div key={section.label}>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 px-1">
                    {t(section.label)}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {section.items.map(item => (
                      <button
                        key={item.key}
                        onClick={() => handleDrawerNav(item.path)}
                        className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 active:bg-blue-50 dark:active:bg-blue-900/30 active:text-blue-700 dark:active:text-blue-400 transition-colors"
                      >
                        <span className="text-2xl leading-none">{item.icon}</span>
                        <span className="text-xs font-medium text-center leading-tight">
                          {t(`nav.${item.key}`)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
