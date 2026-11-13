import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

const mobileItems = [
  { key: 'dashboard', path: '/dashboard', icon: '⊞', active: false },
  { key: 'patients',  path: '/patients',  icon: '👤', active: true  },
  { key: 'sales',     path: '/sales',     icon: '🧾', active: false },
  { key: 'reports',   path: '/reports',   icon: '📊', active: false },
  { key: 'settings',  path: '/settings',  icon: '⚙',  active: false },
]

export function BottomNav() {
  const { t } = useTranslation()
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex safe-pb z-40">
      {mobileItems.map(item => (
        item.active ? (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
              }`
            }
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span>{t(`nav.${item.key}`)}</span>
          </NavLink>
        ) : (
          <div
            key={item.key}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium text-slate-300 dark:text-slate-600"
          >
            <span className="text-xl leading-none opacity-40">{item.icon}</span>
            <span>{t(`nav.${item.key}`)}</span>
          </div>
        )
      ))}
    </nav>
  )
}
