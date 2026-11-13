import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getStockList, createMovement, updateProductPricing,
  type ProductStock,
} from './InventoryRepository'
import { FormField } from '../../components/ui/FormField'
import { MovementFormSchema, type MovementFormValues, PricingSchema, type PricingValues } from './inventory.schema'

type ModalMode = 'movement' | 'pricing' | null

export function StockListPage() {
  const { t } = useTranslation()
  const [products, setProducts] = useState<ProductStock[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'frame' | 'lens'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [selected, setSelected] = useState<ProductStock | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Movement form state
  const [moveForm, setMoveForm] = useState<Partial<MovementFormValues>>({
    movementDate: new Date().toISOString().slice(0, 10),
  })
  const [moveErrors, setMoveErrors] = useState<Partial<Record<keyof MovementFormValues, string>>>({})

  // Pricing form state
  const [priceForm, setPriceForm] = useState<Partial<PricingValues>>({})
  const [priceErrors, setPriceErrors] = useState<Partial<Record<keyof PricingValues, string>>>({})

  const load = (silent = false) => {
    if (!silent) setLoading(true)
    const filters: { productType?: 'frame' | 'lens'; query?: string; status?: string } = {}
    if (typeFilter !== 'all') filters.productType = typeFilter
    if (query) filters.query = query
    if (statusFilter !== 'all') filters.status = statusFilter
    getStockList(filters).then(p => { setProducts(p); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [query, typeFilter, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const openMovement = (p: ProductStock) => {
    setSelected(p)
    setMoveForm({ productType: p.productType, productId: p.id, movementDate: new Date().toISOString().slice(0, 10) })
    setMoveErrors({})
    setError('')
    setModalMode('movement')
  }

  const openPricing = (p: ProductStock) => {
    setSelected(p)
    setPriceForm({ reorderPoint: p.reorderPoint, costPrice: p.costPrice, sellingPrice: p.sellingPrice })
    setPriceErrors({})
    setError('')
    setModalMode('pricing')
  }

  const closeModal = () => { setModalMode(null); setSelected(null) }

  const handleMovementSubmit = async () => {
    setError('')
    const parsed = MovementFormSchema.safeParse(moveForm)
    if (!parsed.success) {
      const errs: Partial<Record<keyof MovementFormValues, string>> = {}
      parsed.error.issues.forEach(e => { if (e.path.length) errs[String(e.path[0]) as keyof MovementFormValues] = e.message })
      setMoveErrors(errs)
      return
    }
    setSaving(true)
    try {
      await createMovement(parsed.data)
      closeModal()
      load(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handlePricingSubmit = async () => {
    if (!selected) return
    setError('')
    const parsed = PricingSchema.safeParse(priceForm)
    if (!parsed.success) {
      const errs: Partial<Record<keyof PricingValues, string>> = {}
      parsed.error.issues.forEach(e => { if (e.path.length) errs[String(e.path[0]) as keyof PricingValues] = e.message })
      setPriceErrors(errs)
      return
    }
    setSaving(true)
    try {
      await updateProductPricing(selected.productType, selected.id, parsed.data)
      closeModal()
      load(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const statusBadge = (s: ProductStock['status']) => {
    if (s === 'in_stock') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">{t('inventory.stock.in_stock')}</span>
    if (s === 'low_stock') return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">{t('inventory.stock.low_stock')}</span>
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">{t('inventory.stock.out_of_stock')}</span>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          className="form-input max-w-xs"
          placeholder={t('catalog.searchPlaceholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select className="form-input w-auto" value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}>
          <option value="all">{t('inventory.stock.allTypes')}</option>
          <option value="frame">{t('inventory.stock.frames')}</option>
          <option value="lens">{t('inventory.stock.lenses')}</option>
        </select>
        <select className="form-input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">{t('inventory.stock.allStatuses')}</option>
          <option value="in_stock">{t('inventory.stock.in_stock')}</option>
          <option value="low_stock">{t('inventory.stock.low_stock')}</option>
          <option value="out_of_stock">{t('inventory.stock.out_of_stock')}</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : products.length === 0 ? (
        <div className="flex justify-center py-12 text-slate-400">{t('common.noData')}</div>
      ) : (
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
                <th className="px-4 py-2.5 text-end font-medium text-slate-600 dark:text-slate-300">{t('common.edit')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {products.map(p => (
                <tr key={`${p.productType}-${p.id}`} className="bg-white dark:bg-slate-900">
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{p.name}</td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-2.5 capitalize text-slate-500">{p.productType}</td>
                  <td className="px-4 py-2.5 text-end font-mono font-semibold text-slate-800 dark:text-slate-200">{p.quantity}</td>
                  <td className="px-4 py-2.5 text-end font-mono text-slate-400">{p.reorderPoint}</td>
                  <td className="px-4 py-2.5">{statusBadge(p.status)}</td>
                  <td className="px-4 py-2.5 text-end">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => openMovement(p)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
                      >
                        {t('inventory.movements.add')}
                      </button>
                      <button
                        onClick={() => openPricing(p)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        {t('inventory.stock.editPricing')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Movement modal */}
      {modalMode === 'movement' && selected && (
        <Modal title={`${t('inventory.movements.add')} — ${selected.name}`} onClose={closeModal}>
          <div className="space-y-4">
            <FormField label={t('inventory.movements.type')} required error={moveErrors.movementType}>
              <select
                className="form-input"
                value={moveForm.movementType ?? ''}
                onChange={e => setMoveForm(f => ({ ...f, movementType: e.target.value as MovementFormValues['movementType'] }))}
              >
                <option value="">{t('common.select')}</option>
                <optgroup label={t('inventory.movements.inGroup')}>
                  <option value="opening">{t('inventory.movements.opening')}</option>
                  <option value="stock_in">{t('inventory.movements.stock_in')}</option>
                  <option value="adjustment_in">{t('inventory.movements.adjustment_in')}</option>
                  <option value="returned">{t('inventory.movements.returned')}</option>
                </optgroup>
                <optgroup label={t('inventory.movements.outGroup')}>
                  <option value="stock_out">{t('inventory.movements.stock_out')}</option>
                  <option value="adjustment_out">{t('inventory.movements.adjustment_out')}</option>
                  <option value="damaged">{t('inventory.movements.damaged')}</option>
                </optgroup>
              </select>
            </FormField>
            <FormField label={t('inventory.movements.qty')} required error={moveErrors.quantity}>
              <input
                type="number"
                min="1"
                className="form-input"
                value={moveForm.quantity ?? ''}
                onChange={e => setMoveForm(f => ({ ...f, quantity: e.target.value === '' ? undefined : Number(e.target.value) }))}
              />
            </FormField>
            <FormField label={t('inventory.movements.date')} required error={moveErrors.movementDate}>
              <input
                type="date"
                className="form-input"
                value={moveForm.movementDate ?? ''}
                onChange={e => setMoveForm(f => ({ ...f, movementDate: e.target.value }))}
              />
            </FormField>
            <FormField label={t('inventory.movements.reason')} error={moveErrors.reason}>
              <input
                className="form-input"
                value={moveForm.reason ?? ''}
                onChange={e => setMoveForm(f => ({ ...f, reason: e.target.value }))}
              />
            </FormField>
            <FormField label={t('inventory.movements.reference')} error={moveErrors.referenceNumber}>
              <input
                className="form-input"
                value={moveForm.referenceNumber ?? ''}
                onChange={e => setMoveForm(f => ({ ...f, referenceNumber: e.target.value }))}
              />
            </FormField>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={closeModal} className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">{t('common.cancel')}</button>
              <button onClick={handleMovementSubmit} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50">{t('common.save')}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Pricing modal */}
      {modalMode === 'pricing' && selected && (
        <Modal title={`${t('inventory.stock.editPricing')} — ${selected.name}`} onClose={closeModal}>
          <div className="space-y-4">
            <FormField label={t('inventory.stock.reorderPoint')} error={priceErrors.reorderPoint}>
              <input type="number" min="0" className="form-input" value={priceForm.reorderPoint ?? 0}
                onChange={e => setPriceForm(f => ({ ...f, reorderPoint: e.target.value === '' ? 0 : Number(e.target.value) }))} />
            </FormField>
            <FormField label={t('inventory.stock.costPrice')} error={priceErrors.costPrice}>
              <input type="number" min="0" step="0.01" className="form-input" value={priceForm.costPrice ?? ''}
                onChange={e => setPriceForm(f => ({ ...f, costPrice: e.target.value === '' ? undefined : Number(e.target.value) }))} />
            </FormField>
            <FormField label={t('inventory.stock.sellingPrice')} error={priceErrors.sellingPrice}>
              <input type="number" min="0" step="0.01" className="form-input" value={priceForm.sellingPrice ?? ''}
                onChange={e => setPriceForm(f => ({ ...f, sellingPrice: e.target.value === '' ? undefined : Number(e.target.value) }))} />
            </FormField>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={closeModal} className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">{t('common.cancel')}</button>
              <button onClick={handlePricingSubmit} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50">{t('common.save')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
