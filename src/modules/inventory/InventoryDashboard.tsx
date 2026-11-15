import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getInventoryStats, type InventoryStats } from './InventoryRepository'
import { db } from '../../database/db'

export function InventoryDashboard() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<InventoryStats | null>(null)
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getInventoryStats().then(s => { setStats(s); setLoading(false) }).catch(() => setLoading(false))
    Promise.all([
      db.frames.filter(fr => !fr.deletedAt).toArray(),
      db.lenses.filter(l => !l.deletedAt).toArray(),
    ]).then(([frames, lenses]) => {
      const map: Record<string, string> = {}
      frames.forEach(fr => { if (fr.id && fr.name) map[fr.id] = fr.name })
      lenses.forEach(l => { if (l.id && l.name) map[l.id] = l.name })
      setProductNames(map)
    })
  }, [])

  if (loading) {
    return <div className="flex justify-center py-12 text-slate-400">{t('common.loading')}</div>
  }
  if (!stats) return null

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label={t('inventory.stats.frameProducts')} value={stats.totalFrameProducts} color="blue" />
        <StatCard label={t('inventory.stats.lensProducts')} value={stats.totalLensProducts} color="indigo" />
        <StatCard label={t('inventory.stats.frameUnits')} value={stats.totalFrameUnits} color="sky" />
        <StatCard label={t('inventory.stats.lensUnits')} value={stats.totalLensUnits} color="violet" />
        <StatCard label={t('inventory.stats.lowStock')} value={stats.lowStockCount} color="amber" />
        <StatCard label={t('inventory.stats.outOfStock')} value={stats.outOfStockCount} color="red" />
      </div>

      {/* Recent movements */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          {t('inventory.recentMovements')}
        </h3>
        {stats.recentMovements.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">{t('common.noData')}</p>
        ) : (
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('inventory.movements.type')}</th>
                  <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('inventory.movements.product')}</th>
                  <th className="px-4 py-2.5 text-end font-medium text-slate-600 dark:text-slate-300">{t('inventory.movements.qty')}</th>
                  <th className="px-4 py-2.5 text-end font-medium text-slate-600 dark:text-slate-300">{t('inventory.movements.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {stats.recentMovements.map(m => (
                  <tr key={m.id} className="bg-white dark:bg-slate-900">
                    <td className="px-4 py-2.5">
                      <MovementBadge type={m.movementType} label={t(`inventory.movements.${m.movementType}`, { defaultValue: m.movementType })} />
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{productNames[m.itemId] ?? m.itemId}</td>
                    <td className={`px-4 py-2.5 text-end font-mono font-medium ${m.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="px-4 py-2.5 text-end text-slate-400">
                      {m.movementDate.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
    indigo: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
    sky: 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
    violet: 'bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300',
    amber: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
    red: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300',
  }
  return (
    <div className={`rounded-xl p-4 ${colorMap[color] ?? colorMap.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  )
}

function MovementBadge({ type, label }: { type: string; label: string }) {
  const isIn = ['opening', 'stock_in', 'adjustment_in', 'returned'].includes(type)
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
      isIn ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
           : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
    }`}>
      {isIn ? '▲' : '▼'} {label}
    </span>
  )
}
