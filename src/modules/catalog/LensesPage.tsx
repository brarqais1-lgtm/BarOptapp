import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { PageSpinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../contexts/ToastContext'
import { useDebounce } from '../../hooks/useDebounce'
import { searchLensesWithStats, archiveLens, restoreLens, type LensWithStats } from './LensRepository'
import { db } from '../../database/db'

const LENS_TYPE_BADGE: Record<string, 'blue' | 'purple' | 'teal'> = {
  single_vision: 'blue', bifocal: 'purple', progressive: 'teal',
}

const LENS_TYPE_LABEL: Record<string, string> = {
  single_vision: 'Single Vision',
  bifocal: 'Bifocal',
  progressive: 'Progressive',
}

export function LensesPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [lenses, setLenses] = useState<LensWithStats[]>([])
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [archiveTarget, setArchiveTarget] = useState<LensWithStats | null>(null)

  const dq = useDebounce(query, 300)

  const load = useCallback(async () => {
    setLoading(true)
    const list = await searchLensesWithStats(
      { query: dq, lensType: typeFilter || undefined, includeArchived },
      db,
    )
    setLenses(list)
    setLoading(false)
  }, [dq, typeFilter, includeArchived])

  useEffect(() => { load() }, [load])

  const handleArchive = async (lens: LensWithStats) => {
    await archiveLens(lens.id, db)
    toast('تم أرشفة العدسة', 'success')
    load()
  }

  const handleRestore = async (lens: LensWithStats) => {
    await restoreLens(lens.id, db)
    toast('تم استعادة العدسة', 'success')
    load()
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">العدسات</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{lenses.length} عدسة</p>
        </div>
        <Button onClick={() => navigate('/lenses/new')} icon={<span>+</span>}>
          إضافة عدسة
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mb-5 flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="بحث بالاسم..."
          className="flex-1 min-w-48 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">جميع الأنواع</option>
          <option value="single_vision">Single Vision</option>
          <option value="bifocal">Bifocal</option>
          <option value="progressive">Progressive</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={e => setIncludeArchived(e.target.checked)}
            className="accent-blue-600"
          />
          إظهار المؤرشف
        </label>
      </div>

      {lenses.length === 0 ? (
        <EmptyState
          icon="🔬"
          title="لا توجد عدسات"
          description="أضف عدسة جديدة مع درجاتها وأسعارها"
          action={<Button onClick={() => navigate('/lenses/new')}>إضافة عدسة</Button>}
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">اسم العدسة</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">النوع</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">درجات</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">مخزون</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">الحالة</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {lenses.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">{l.name}</div>
                      {l.notes && <div className="text-xs text-slate-400 truncate max-w-48">{l.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={LENS_TYPE_BADGE[l.lensType] ?? 'gray'}>
                        {LENS_TYPE_LABEL[l.lensType] ?? l.lensType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {l.variantCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300 font-medium">
                      {l.totalQty}
                    </td>
                    <td className="px-4 py-3">
                      {l.deletedAt
                        ? <Badge variant="yellow">مؤرشف</Badge>
                        : <Badge variant="green">نشط</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => navigate(`/lenses/${l.id}/edit`)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          تعديل
                        </button>
                        {l.deletedAt ? (
                          <button
                            onClick={() => handleRestore(l)}
                            className="text-xs text-emerald-600 hover:underline"
                          >
                            استعادة
                          </button>
                        ) : (
                          <button
                            onClick={() => setArchiveTarget(l)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            أرشفة
                          </button>
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
        title="أرشفة العدسة"
        description="سيتم إخفاء هذه العدسة من القائمة. يمكنك استعادتها لاحقاً."
        confirmLabel="أرشفة"
        danger
        onConfirm={() => { if (archiveTarget) handleArchive(archiveTarget); setArchiveTarget(null) }}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  )
}
