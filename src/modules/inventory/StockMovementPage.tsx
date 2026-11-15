import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMovements, type MovementFilters } from './InventoryRepository'
import { db } from '../../database/db'
import type { InventoryMovement } from '../../database/schema'

export function StockMovementPage() {
  const { t } = useTranslation()
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<MovementFilters>({ limit: 100 })

  const load = (f: MovementFilters, silent = false) => {
    if (!silent) setLoading(true)
    getMovements(f).then(m => { setMovements(m); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => {
    load(filters)
    Promise.all([
      db.frames.filter(fr => !fr.deletedAt).toArray(),
      db.lenses.filter(l => !l.deletedAt).toArray(),
    ]).then(([frames, lenses]) => {
      const map: Record<string, string> = {}
      frames.forEach(fr => { if (fr.id && fr.name) map[fr.id] = fr.name })
      lenses.forEach(l => { if (l.id && l.name) map[l.id] = l.name })
      setProductNames(map)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateFilter = (patch: Partial<MovementFilters>) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    load(next)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          className="form-input w-auto"
          value={filters.productType ?? ''}
          onChange={e => updateFilter({ productType: e.target.value === '' ? undefined : e.target.value as 'frame' | 'lens' })}
        >
          <option value="">{t('inventory.stock.allTypes')}</option>
          <option value="frame">{t('inventory.stock.frames')}</option>
          <option value="lens">{t('inventory.stock.lenses')}</option>
        </select>
        <select
          className="form-input w-auto"
          value={filters.movementType ?? ''}
          onChange={e => updateFilter({ movementType: e.target.value === '' ? undefined : e.target.value })}
        >
          <option value="">{t('inventory.movements.allTypes')}</option>
          <option value="opening">{t('inventory.movements.opening')}</option>
          <option value="stock_in">{t('inventory.movements.stock_in')}</option>
          <option value="stock_out">{t('inventory.movements.stock_out')}</option>
          <option value="adjustment_in">{t('inventory.movements.adjustment_in')}</option>
          <option value="adjustment_out">{t('inventory.movements.adjustment_out')}</option>
          <option value="damaged">{t('inventory.movements.damaged')}</option>
          <option value="returned">{t('inventory.movements.returned')}</option>
        </select>
        <input
          type="date"
          className="form-input w-auto"
          value={filters.fromDate ?? ''}
          onChange={e => updateFilter({ fromDate: e.target.value || undefined })}
          title={t('inventory.movements.fromDate')}
        />
        <input
          type="date"
          className="form-input w-auto"
          value={filters.toDate ?? ''}
          onChange={e => updateFilter({ toDate: e.target.value || undefined })}
          title={t('inventory.movements.toDate')}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : movements.length === 0 ? (
        <div className="flex justify-center py-12 text-slate-400">{t('common.noData')}</div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('inventory.movements.type')}</th>
                <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('inventory.movements.product')}</th>
                <th className="px-4 py-2.5 text-end font-medium text-slate-600 dark:text-slate-300">{t('inventory.movements.qty')}</th>
                <th className="px-4 py-2.5 text-end font-medium text-slate-600 dark:text-slate-300">{t('inventory.movements.qtyBefore')}</th>
                <th className="px-4 py-2.5 text-end font-medium text-slate-600 dark:text-slate-300">{t('inventory.movements.qtyAfter')}</th>
                <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('inventory.movements.reason')}</th>
                <th className="px-4 py-2.5 text-end font-medium text-slate-600 dark:text-slate-300">{t('inventory.movements.date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {movements.map(m => {
                const isIn = m.quantity > 0
                return (
                  <tr key={m.id} className="bg-white dark:bg-slate-900">
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        isIn ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                             : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                      }`}>
                        {isIn ? '▲' : '▼'} {t(`inventory.movements.${m.movementType}`, { defaultValue: m.movementType })}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{productNames[m.itemId] ?? m.itemId}</td>
                    <td className={`px-4 py-2.5 text-end font-mono font-medium ${isIn ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isIn ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="px-4 py-2.5 text-end font-mono text-slate-400">{m.quantityBefore}</td>
                    <td className="px-4 py-2.5 text-end font-mono text-slate-700 dark:text-slate-300">{m.quantityAfter}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[180px] truncate">{m.reason ?? '—'}</td>
                    <td className="px-4 py-2.5 text-end text-slate-400 whitespace-nowrap">
                      {m.movementDate.slice(0, 10)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
