import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getLowStockProducts, type ProductStock } from './InventoryRepository'

export function LowStockPage() {
  const { t } = useTranslation()
  const [products, setProducts] = useState<ProductStock[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    getLowStockProducts().then(p => { setProducts(p); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) {
    return <div className="flex justify-center py-12 text-slate-400">{t('common.loading')}</div>
  }

  const outOfStock = products.filter(p => p.status === 'out_of_stock')
  const lowStock = products.filter(p => p.status === 'low_stock')

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="text-5xl">✅</div>
        <p className="text-slate-500 dark:text-slate-400 font-medium">{t('inventory.lowStock.allGood')}</p>
        <p className="text-sm text-slate-400">{t('inventory.lowStock.allGoodHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {outOfStock.length > 0 && (
        <Section
          title={t('inventory.lowStock.outOfStock')}
          items={outOfStock}
          badgeClass="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
          badgeLabel={t('inventory.stock.out_of_stock')}
        />
      )}
      {lowStock.length > 0 && (
        <Section
          title={t('inventory.lowStock.lowStock')}
          items={lowStock}
          badgeClass="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
          badgeLabel={t('inventory.stock.low_stock')}
        />
      )}
    </div>
  )
}

function Section({ title, items, badgeClass, badgeLabel }: {
  title: string
  items: ProductStock[]
  badgeClass: string
  badgeLabel: string
}) {
  const { t } = useTranslation()
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{title} ({items.length})</h3>
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('catalog.name')}</th>
              <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('catalog.sku')}</th>
              <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('inventory.stock.type')}</th>
              <th className="px-4 py-2.5 text-end font-medium text-slate-600 dark:text-slate-300">{t('inventory.stock.qty')}</th>
              <th className="px-4 py-2.5 text-end font-medium text-slate-600 dark:text-slate-300">{t('inventory.stock.reorderPoint')}</th>
              <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('inventory.stock.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {items.map(p => (
              <tr key={`${p.productType}-${p.id}`} className="bg-white dark:bg-slate-900">
                <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{p.name}</td>
                <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-2.5 capitalize text-slate-500">{p.productType}</td>
                <td className="px-4 py-2.5 text-end font-mono font-semibold text-slate-800 dark:text-slate-200">{p.quantity}</td>
                <td className="px-4 py-2.5 text-end font-mono text-slate-400">{p.reorderPoint}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>{badgeLabel}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
