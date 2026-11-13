import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { setLocale, type SupportedLocale } from '../../i18n'
import { useEffect, useState } from 'react'
import i18n from 'i18next'

type NavItem = { key: string; path: string; icon: string; active: boolean }

const navItems: NavItem[] = [
  { key: 'dashboard',    path: '/dashboard',    icon: '⊞', active: true  },
  { key: 'patients',     path: '/patients',     icon: '👤', active: true  },
  { key: 'examinations', path: '/examinations', icon: '👁', active: true  },
  { key: 'frames',       path: '/frames',       icon: '🕶', active: true  },
  { key: 'lenses',       path: '/lenses',       icon: '🔬', active: true  },
  { key: 'inventory',    path: '/inventory',    icon: '📦', active: true  },
  { key: 'suppliers',    path: '/suppliers',    icon: '🏭', active: true  },
  { key: 'purchases',    path: '/purchases',    icon: '🛒', active: true  },
  { key: 'sales',        path: '/sales',        icon: '🧾', active: true  },
  { key: 'accounts',     path: '/accounts',     icon: '💰', active: false },
  { key: 'expenses',     path: '/expenses',     icon: '📉', active: true  },
  { key: 'reports',      path: '/reports',      icon: '📊', active: true  },
  { key: 'settings',     path: '/settings',     icon: '⚙', active: true  },
]

export function Sidebar() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>(
    (i18n.language as SupportedLocale) || 'ar'
  )

  useEffect(() => {
    const handler = () => setCurrentLocale(i18n.language as SupportedLocale)
    i18n.on('languageChanged', handler)
    return () => i18n.off('languageChanged', handler)
  }, [])

  const toggleLocale = () => {
    const next: SupportedLocale = currentLocale === 'ar' ? 'en' : 'ar'
    setLocale(next)
    setCurrentLocale(next)
  }

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-700 h-full overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100 dark:border-slate-700">
        <div className="w-9 h-9 rounded-xl bg-blue-700 flex items-center justify-center text-white font-bold text-lg">B</div>
        <div>
          <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{t('app.name')}</div>
          <div className="text-xs text-slate-400 leading-tight">v2.0</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3">
        {navItems.map(item => (
          item.active ? (
            <NavLink
              key={item.key}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {t(`nav.${item.key}`)}
            </NavLink>
          ) : (
            <div
              key={item.key}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm text-slate-400 dark:text-slate-500 cursor-not-allowed"
            >
              <span className="text-base opacity-50">{item.icon}</span>
              {t(`nav.${item.key}`)}
              <span className="ms-auto text-xs bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md">
                {t('common.comingSoon')}
              </span>
            </div>
          )
        ))}
      </nav>

      {/* Footer controls */}
      <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-700 flex gap-2">
        <button
          onClick={toggleTheme}
          className="flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title={t(`theme.${theme === 'light' ? 'dark' : 'light'}`)}
        >
          {theme === 'light' ? '🌙' : '☀️'}
          {theme === 'light' ? t('theme.dark') : t('theme.light')}
        </button>
        <button
          onClick={toggleLocale}
          className="px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
        >
          {currentLocale === 'ar' ? 'EN' : 'ع'}
        </button>
      </div>
    </aside>
  )
}
