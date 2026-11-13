import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InventoryDashboard } from './InventoryDashboard'
import { StockListPage } from './StockListPage'
import { StockMovementPage } from './StockMovementPage'
import { StocktakingPage } from './StocktakingPage'
import { LowStockPage } from './LowStockPage'

type Tab = 'dashboard' | 'stock' | 'movements' | 'stocktaking' | 'lowstock'

export function InventoryPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('dashboard')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: t('inventory.tabs.dashboard') },
    { id: 'stock', label: t('inventory.tabs.stock') },
    { id: 'movements', label: t('inventory.tabs.movements') },
    { id: 'stocktaking', label: t('inventory.tabs.stocktaking') },
    { id: 'lowstock', label: t('inventory.tabs.lowStock') },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('inventory.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('inventory.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-blue-700 text-blue-700 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'dashboard'   && <InventoryDashboard />}
      {tab === 'stock'       && <StockListPage />}
      {tab === 'movements'   && <StockMovementPage />}
      {tab === 'stocktaking' && <StocktakingPage />}
      {tab === 'lowstock'    && <LowStockPage />}
    </div>
  )
}
