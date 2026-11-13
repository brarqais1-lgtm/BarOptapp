import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { PageSpinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../contexts/ToastContext'
import { useDebounce } from '../../hooks/useDebounce'
import { searchLenses, archiveLens, restoreLens, getLensBrands } from './LensRepository'
import { db } from '../../database/db'
import type { Lens } from '../../database/schema'

const LENS_TYPE_BADGE: Record<string, 'blue' | 'purple' | 'teal'> = {
  single_vision: 'blue', bifocal: 'purple', progressive: 'teal',
}

export function LensesPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()

  const [lenses, setLenses] = useState<Lens[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [archiveTarget, setArchiveTarget] = useState<Lens | null>(null)

  const dq = useDebounce(query, 300)

  const load = useCallback(async () => {
    setLoading(true)
    const [list, br] = await Promise.all([
      searchLenses({ query: dq, brand: brandFilter || undefined, lensType: typeFilter || undefined, includeArchived }, db),
      getLensBrands(db),
    ])
    setLenses(list)
    setBrands(br)
    setLoading(false)
  }, [dq, brandFilter, typeFilter, includeArchived])

  useEffect(() => { load() }, [load])

  const handleArchive = async (lens: Lens) => {
    await archiveLens(lens.id, db)
    toast(t('catalog.archiveSuccess'), 'success')
    load()
  }

  const handleRestore = async (lens: Lens) => {
    await restoreLens(lens.id, db)
    toast(t('catalog.restoreSuccess'), 'success')
    load()
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('catalog.lenses.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{lenses.length} {t('catalog.items')}</p>
        </div>
        <Button onClick={() => navigate('/lenses/new')} icon={<span>+</span>}>
          {t('catalog.lenses.new')}
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mb-5 flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('catalog.searchPlaceholder')}
          className="flex-1 min-w-48 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('catalog.allBrands')}</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('catalog.allTypes')}</option>
          <option value="single_vision">{t('catalog.lenses.single_vision')}</option>
          <option value="bifocal">{t('catalog.lenses.bifocal')}</option>
          <option value="progressive">{t('catalog.lenses.progressive')}</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
          <input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)} className="accent-blue-600" />
          {t('catalog.showArchived')}
        </label>
      </div>

      {lenses.length === 0 ? (
        <EmptyState icon="🔬" title={t('catalog.lenses.empty')} description={t('catalog.lenses.emptyHint')}
          action={<Button onClick={() => navigate('/lenses/new')}>{t('catalog.lenses.new')}</Button>} />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.sku')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.name')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.brand')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.lenses.lensType')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.lenses.material')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.lenses.index')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {lenses.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">{l.sku}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">{l.name ?? l.brand}</div>
                      {l.model && <div className="text-xs text-slate-400">{l.model}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{l.brand}</td>
                    <td className="px-4 py-3">
                      <Badge variant={LENS_TYPE_BADGE[l.lensType] ?? 'gray'}>{t(`catalog.lenses.${l.lensType}`)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{l.material ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{l.index != null ? l.index.toFixed(2) : '—'}</td>
                    <td className="px-4 py-3">
                      {l.deletedAt
                        ? <Badge variant="yellow">{t('common.archived')}</Badge>
                        : <Badge variant="green">{t('common.active')}</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => navigate(`/lenses/${l.id}/edit`)}
                          className="text-xs text-blue-600 hover:underline">{t('common.edit')}</button>
                        {l.deletedAt ? (
                          <button onClick={() => handleRestore(l)}
                            className="text-xs text-emerald-600 hover:underline">{t('common.restore')}</button>
                        ) : (
                          <button onClick={() => setArchiveTarget(l)}
                            className="text-xs text-red-500 hover:underline">{t('common.archive')}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        title={t('catalog.archiveConfirm')}
        description={t('catalog.archiveWarning')}
        confirmLabel={t('common.archive')}
        danger
        onConfirm={() => { if (archiveTarget) handleArchive(archiveTarget); setArchiveTarget(null) }}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  )
}
