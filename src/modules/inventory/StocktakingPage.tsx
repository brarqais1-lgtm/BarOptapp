import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createStocktakingSession, getStocktakingSessions, getStocktakingItems,
  addStocktakingItem, updateStocktakingCount, confirmStocktakingSession,
  updateSessionStatus, getStockList,
} from './InventoryRepository'
import type { StocktakingSession, StocktakingItem } from '../../database/schema'
import type { ProductStock } from './InventoryRepository'
import { FormField } from '../../components/ui/FormField'
import { StocktakingSessionSchema, type StocktakingSessionValues } from './inventory.schema'

type View = 'list' | 'detail'

export function StocktakingPage() {
  const { t } = useTranslation()
  const [view, setView] = useState<View>('list')
  const [sessions, setSessions] = useState<StocktakingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<Partial<StocktakingSessionValues>>({ sessionDate: new Date().toISOString().slice(0, 10) })
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof StocktakingSessionValues, string>>>({})
  const [createError, setCreateError] = useState('')
  const [selectedSession, setSelectedSession] = useState<StocktakingSession | null>(null)

  const loadSessions = () => {
    getStocktakingSessions().then(s => { setSessions(s); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(loadSessions, [])

  const handleCreate = async () => {
    setCreateError('')
    const parsed = StocktakingSessionSchema.safeParse(createForm)
    if (!parsed.success) {
      const errs: Partial<Record<keyof StocktakingSessionValues, string>> = {}
      parsed.error.issues.forEach(e => { if (e.path.length) errs[String(e.path[0]) as keyof StocktakingSessionValues] = e.message })
      setCreateErrors(errs)
      return
    }
    try {
      const session = await createStocktakingSession(parsed.data)
      setSessions(s => [session, ...s])
      setCreating(false)
      setSelectedSession(session)
      setView('detail')
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : t('common.error'))
    }
  }

  const openSession = (s: StocktakingSession) => {
    setSelectedSession(s)
    setView('detail')
  }

  if (view === 'detail' && selectedSession) {
    return (
      <StocktakingDetail
        session={selectedSession}
        onBack={() => { setView('list'); loadSessions() }}
        onSessionUpdate={s => setSelectedSession(s)}
      />
    )
  }

  const statusBadge = (s: StocktakingSession['status']) => {
    const map: Record<string, string> = {
      draft: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
      in_progress: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
      confirmed: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
      cancelled: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
    }
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[s]}`}>{t(`inventory.stocktaking.status.${s}`)}</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.stocktaking.title')}</h3>
        <button
          onClick={() => { setCreating(true); setCreateErrors({}); setCreateError('') }}
          className="text-sm px-4 py-2 rounded-xl bg-blue-700 text-white hover:bg-blue-800"
        >
          {t('inventory.stocktaking.new')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : sessions.length === 0 ? (
        <div className="flex justify-center py-12 text-slate-400">{t('common.noData')}</div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('inventory.stocktaking.sessionNumber')}</th>
                <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('inventory.stocktaking.date')}</th>
                <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('inventory.stock.status')}</th>
                <th className="px-4 py-2.5 text-end font-medium text-slate-600 dark:text-slate-300">{t('common.view')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {sessions.map(s => (
                <tr key={s.id} className="bg-white dark:bg-slate-900">
                  <td className="px-4 py-2.5 font-mono text-slate-800 dark:text-slate-200">{s.sessionNumber}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{s.sessionDate.slice(0, 10)}</td>
                  <td className="px-4 py-2.5">{statusBadge(s.status)}</td>
                  <td className="px-4 py-2.5 text-end">
                    <button onClick={() => openSession(s)} className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                      {t('common.view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create session modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('inventory.stocktaking.new')}</h2>
              <button onClick={() => setCreating(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <FormField label={t('inventory.stocktaking.date')} required error={createErrors.sessionDate}>
                <input type="date" className="form-input" value={createForm.sessionDate ?? ''}
                  onChange={e => setCreateForm(f => ({ ...f, sessionDate: e.target.value }))} />
              </FormField>
              <FormField label={t('catalog.notes')} error={createErrors.notes}>
                <textarea className="form-input resize-none" rows={2} value={createForm.notes ?? ''}
                  onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} />
              </FormField>
              {createError && <p className="text-sm text-red-500">{createError}</p>}
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">{t('common.cancel')}</button>
                <button onClick={handleCreate} className="px-4 py-2 text-sm rounded-lg bg-blue-700 text-white hover:bg-blue-800">{t('common.confirm')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StocktakingDetail({
  session,
  onBack,
  onSessionUpdate,
}: {
  session: StocktakingSession
  onBack: () => void
  onSessionUpdate: (s: StocktakingSession) => void
}) {
  const { t } = useTranslation()
  const [items, setItems] = useState<StocktakingItem[]>([])
  const [products, setProducts] = useState<ProductStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [addingProductId, setAddingProductId] = useState('')
  const [addingProductType, setAddingProductType] = useState<'frame' | 'lens'>('frame')
  const [currentSession, setCurrentSession] = useState(session)

  const isEditable = currentSession.status !== 'confirmed' && currentSession.status !== 'cancelled'

  useEffect(() => {
    Promise.all([
      getStocktakingItems(currentSession.id),
      getStockList({})
    ]).then(([its, ps]) => { setItems(its); setProducts(ps); setLoading(false) })
      .catch(() => setLoading(false))
  }, [currentSession.id])

  const availableProducts = products.filter(p =>
    !items.some(i => i.productId === p.id)
  )

  const handleAddItem = async () => {
    if (!addingProductId) return
    setError('')
    try {
      const item = await addStocktakingItem(currentSession.id, addingProductType, addingProductId)
      setItems(prev => [...prev, item])
      setAddingProductId('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }

  const handleCount = async (itemId: string, val: string) => {
    const qty = val === '' ? undefined : parseInt(val, 10)
    if (qty !== undefined && (isNaN(qty) || qty < 0)) return
    try {
      if (qty !== undefined) await updateStocktakingCount(itemId, qty)
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, countedQty: qty } : i))
    } catch { /* ignore */ }
  }

  const handleStatusChange = async (status: 'in_progress' | 'cancelled') => {
    setError('')
    try {
      await updateSessionStatus(currentSession.id, status)
      const updated = { ...currentSession, status }
      setCurrentSession(updated)
      onSessionUpdate(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }

  const handleConfirm = async () => {
    setConfirmError('')
    setConfirming(true)
    try {
      await confirmStocktakingSession(currentSession.id)
      const updated = { ...currentSession, status: 'confirmed' as const, confirmedAt: new Date().toISOString() }
      setCurrentSession(updated)
      onSessionUpdate(updated)
    } catch (e: unknown) {
      setConfirmError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setConfirming(false)
    }
  }

  const getProductName = (item: StocktakingItem) => {
    const p = products.find(px => px.id === item.productId)
    return p ? `${p.name} (${p.sku})` : item.productId.slice(0, 8)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t('common.back')}</button>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {currentSession.sessionNumber}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ms-2 ${
          currentSession.status === 'confirmed' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
          : currentSession.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
          : currentSession.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
        }`}>
          {t(`inventory.stocktaking.status.${currentSession.status}`)}
        </span>
      </div>

      {/* Action bar */}
      {isEditable && (
        <div className="flex gap-2 flex-wrap">
          {currentSession.status === 'draft' && (
            <button onClick={() => handleStatusChange('in_progress')}
              className="text-sm px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-100">
              {t('inventory.stocktaking.startCounting')}
            </button>
          )}
          <button onClick={handleConfirm} disabled={confirming || items.length === 0}
            className="text-sm px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
            {confirming ? t('common.loading') : t('inventory.stocktaking.confirm')}
          </button>
          <button onClick={() => handleStatusChange('cancelled')}
            className="text-sm px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-100">
            {t('common.archive')}
          </button>
        </div>
      )}

      {(error || confirmError) && (
        <p className="text-sm text-red-500">{error || confirmError}</p>
      )}

      {/* Add product row */}
      {isEditable && (
        <div className="flex gap-2 flex-wrap items-end">
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">{t('inventory.stock.type')}</label>
            <select className="form-input w-auto" value={addingProductType}
              onChange={e => setAddingProductType(e.target.value as 'frame' | 'lens')}>
              <option value="frame">{t('inventory.stock.frames')}</option>
              <option value="lens">{t('inventory.stock.lenses')}</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">{t('inventory.movements.product')}</label>
            <select className="form-input" value={addingProductId}
              onChange={e => setAddingProductId(e.target.value)}>
              <option value="">{t('common.select')}</option>
              {availableProducts.filter(p => p.productType === addingProductType).map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>
          <button onClick={handleAddItem} disabled={!addingProductId}
            className="text-sm px-4 py-2 rounded-xl bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50">
            {t('common.add')}
          </button>
        </div>
      )}

      {/* Items table */}
      {loading ? (
        <div className="flex justify-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : items.length === 0 ? (
        <div className="flex justify-center py-8 text-slate-400 text-sm">{t('inventory.stocktaking.noItems')}</div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('inventory.movements.product')}</th>
                <th className="px-4 py-2.5 text-start font-medium text-slate-600 dark:text-slate-300">{t('inventory.stock.type')}</th>
                <th className="px-4 py-2.5 text-end font-medium text-slate-600 dark:text-slate-300">{t('inventory.stocktaking.systemQty')}</th>
                <th className="px-4 py-2.5 text-end font-medium text-slate-600 dark:text-slate-300">{t('inventory.stocktaking.countedQty')}</th>
                <th className="px-4 py-2.5 text-end font-medium text-slate-600 dark:text-slate-300">{t('inventory.stocktaking.difference')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {items.map(item => {
                const diff = item.countedQty != null ? item.countedQty - item.systemQty : null
                return (
                  <tr key={item.id} className="bg-white dark:bg-slate-900">
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">{getProductName(item)}</td>
                    <td className="px-4 py-2.5 capitalize text-slate-500">{item.productType}</td>
                    <td className="px-4 py-2.5 text-end font-mono text-slate-500">{item.systemQty}</td>
                    <td className="px-4 py-2.5 text-end">
                      {isEditable ? (
                        <input
                          type="number"
                          min="0"
                          className="form-input w-24 text-end"
                          value={item.countedQty ?? ''}
                          onChange={e => handleCount(item.id, e.target.value)}
                        />
                      ) : (
                        <span className="font-mono">{item.countedQty ?? '—'}</span>
                      )}
                    </td>
                    <td className={`px-4 py-2.5 text-end font-mono font-medium ${
                      diff == null ? 'text-slate-400' : diff > 0 ? 'text-green-600 dark:text-green-400' : diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'
                    }`}>
                      {diff == null ? '—' : diff > 0 ? `+${diff}` : diff}
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
