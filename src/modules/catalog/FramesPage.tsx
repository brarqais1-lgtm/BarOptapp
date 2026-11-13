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
import { searchFrames, archiveFrame, restoreFrame, getFrameBrands } from './FrameRepository'
import { db } from '../../database/db'
import type { Frame } from '../../database/schema'
const GENDER_BADGE: Record<string, 'blue' | 'purple' | 'green' | 'teal'> = {
  male: 'blue', female: 'purple', kids: 'green', unisex: 'teal',
}
const FRAME_TYPE_BADGE: Record<string, 'gray' | 'blue' | 'teal'> = {
  full: 'gray', half: 'blue', rimless: 'teal',
}

export function FramesPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()

  const [frames, setFrames] = useState<Frame[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [archiveTarget, setArchiveTarget] = useState<Frame | null>(null)

  const dq = useDebounce(query, 300)

  const load = useCallback(async () => {
    setLoading(true)
    const [list, br] = await Promise.all([
      searchFrames({ query: dq, brand: brandFilter || undefined, gender: genderFilter || undefined, frameType: typeFilter || undefined, includeArchived }, db),
      getFrameBrands(db),
    ])
    setFrames(list)
    setBrands(br)
    setLoading(false)
  }, [dq, brandFilter, genderFilter, typeFilter, includeArchived])

  useEffect(() => { load() }, [load])

  const handleArchive = async (frame: Frame) => {
    await archiveFrame(frame.id, db)
    toast(t('catalog.archiveSuccess'), 'success')
    load()
  }

  const handleRestore = async (frame: Frame) => {
    await restoreFrame(frame.id, db)
    toast(t('catalog.restoreSuccess'), 'success')
    load()
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('catalog.frames.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{frames.length} {t('catalog.items')}</p>
        </div>
        <Button onClick={() => navigate('/frames/new')} icon={<span>+</span>}>
          {t('catalog.frames.new')}
        </Button>
      </div>

      {/* Filters */}
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
        <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('catalog.allGenders')}</option>
          <option value="male">{t('catalog.frames.male')}</option>
          <option value="female">{t('catalog.frames.female')}</option>
          <option value="unisex">{t('catalog.frames.unisex')}</option>
          <option value="kids">{t('catalog.frames.kids')}</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('catalog.allTypes')}</option>
          <option value="full">{t('catalog.frames.full')}</option>
          <option value="half">{t('catalog.frames.half')}</option>
          <option value="rimless">{t('catalog.frames.rimless')}</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
          <input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)} className="accent-blue-600" />
          {t('catalog.showArchived')}
        </label>
      </div>

      {/* List */}
      {frames.length === 0 ? (
        <EmptyState icon="🕶" title={t('catalog.frames.empty')} description={t('catalog.frames.emptyHint')}
          action={<Button onClick={() => navigate('/frames/new')}>{t('catalog.frames.new')}</Button>} />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.sku')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.name')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.brand')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.frames.gender')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.frames.frameType')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.color')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('catalog.status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {frames.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">{f.sku}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">{f.name ?? f.brand}</div>
                      {f.model && <div className="text-xs text-slate-400">{f.model}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{f.brand}</td>
                    <td className="px-4 py-3">
                      {f.gender && <Badge variant={GENDER_BADGE[f.gender] ?? 'gray'}>{t(`catalog.frames.${f.gender}`)}</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      {f.frameType && <Badge variant={FRAME_TYPE_BADGE[f.frameType] ?? 'gray'}>{t(`catalog.frames.${f.frameType}`)}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{f.color ?? '—'}</td>
                    <td className="px-4 py-3">
                      {f.deletedAt
                        ? <Badge variant="yellow">{t('common.archived')}</Badge>
                        : <Badge variant="green">{t('common.active')}</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => navigate(`/frames/${f.id}/edit`)}
                          className="text-xs text-blue-600 hover:underline">{t('common.edit')}</button>
                        {f.deletedAt ? (
                          <button onClick={() => handleRestore(f)}
                            className="text-xs text-emerald-600 hover:underline">{t('common.restore')}</button>
                        ) : (
                          <button onClick={() => setArchiveTarget(f)}
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
