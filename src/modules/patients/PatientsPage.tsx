import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageSpinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useDebounce } from '../../hooks/useDebounce'
import { useToast } from '../../contexts/ToastContext'
import {
  searchPatients, archivePatient, getTodayPatientCount,
  type SortField, type SortDir, type PatientSearchResult,
} from './PatientRepository'
import { db } from '../../database/db'
import type { Patient } from '../../database/schema'
import { calcAge } from '../../utils/date'
import i18n from 'i18next'

type SortOption = `${SortField}:${SortDir}`

const PAGE_SIZE = 20

export function PatientsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US'

  const [query, setQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('createdAt:desc')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [page, setPage] = useState(0)
  const [results, setResults] = useState<PatientSearchResult | null>(null)
  const [allPatients, setAllPatients] = useState<Patient[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [archiveTarget, setArchiveTarget] = useState<Patient | null>(null)

  const debouncedQuery = useDebounce(query, 300)

  const [sortField, sortDir] = sortOption.split(':') as [SortField, SortDir]

  const fetchStats = useCallback(async () => {
    const [total, today] = await Promise.all([
      db.patients.filter(p => !p.deletedAt).count(),
      getTodayPatientCount(db),
    ])
    setTotalCount(total)
    setTodayCount(today)
  }, [])

  const fetchPage = useCallback(async (pg: number, replace: boolean) => {
    setLoading(true)
    try {
      const res = await searchPatients({
        query: debouncedQuery, sortField, sortDir,
        includeDeleted, page: pg, pageSize: PAGE_SIZE,
      }, db)
      setResults(res)
      setAllPatients(prev => replace ? res.patients : [...prev, ...res.patients])
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, sortField, sortDir, includeDeleted])

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0)
    fetchPage(0, true)
    fetchStats()
  }, [debouncedQuery, sortField, sortDir, includeDeleted, fetchPage, fetchStats])

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    fetchPage(next, false)
  }

  const handleArchive = async () => {
    if (!archiveTarget) return
    try {
      await archivePatient(archiveTarget.id, db)
      toast(t('patients.archiveSuccess'), 'success')
      setArchiveTarget(null)
      setPage(0)
      fetchPage(0, true)
      fetchStats()
    } catch {
      toast(t('common.error'), 'error')
    }
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('patients.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('patients.total')}: {totalCount} · {t('patients.today')}: {todayCount}
          </p>
        </div>
        <Button onClick={() => navigate('/patients/new')} icon={<span>+</span>}>
          {t('patients.new')}
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <span className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('patients.search')}
            className="w-full ps-9 pe-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={sortOption}
          onChange={e => setSortOption(e.target.value as SortOption)}
          className="text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="createdAt:desc">{t('patients.sortNewest')}</option>
          <option value="createdAt:asc">{t('patients.sortOldest')}</option>
          <option value="fullName:asc">{t('patients.sortName')}</option>
        </select>
        <button
          onClick={() => setIncludeDeleted(v => !v)}
          className={`text-sm px-3 py-2.5 rounded-xl border transition-colors ${
            includeDeleted
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700'
              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          {includeDeleted ? t('patients.hideArchived') : t('patients.showArchived')}
        </button>
      </div>

      {/* Patient list */}
      {loading && allPatients.length === 0 ? (
        <PageSpinner />
      ) : allPatients.length === 0 ? (
        <EmptyState
          icon="👤"
          title={debouncedQuery ? t('patients.noResults') : t('patients.noPatients')}
          description={debouncedQuery ? undefined : t('patients.addFirst')}
          action={!debouncedQuery ? (
            <Button size="sm" onClick={() => navigate('/patients/new')}>
              {t('patients.new')}
            </Button>
          ) : undefined}
        />
      ) : (
        <>
          <div className="space-y-2">
            {allPatients.map(p => (
              <PatientRow
                key={p.id}
                patient={p}
                locale={locale}
                fmtDate={fmtDate}
                onView={() => navigate(`/patients/${p.id}`)}
                onEdit={() => navigate(`/patients/${p.id}/edit`)}
                onArchive={() => setArchiveTarget(p)}
              />
            ))}
          </div>

          {/* Load more */}
          {results?.hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" size="sm" loading={loading} onClick={loadMore}>
                {t('patients.loadMore')}
              </Button>
            </div>
          )}

          <p className="mt-3 text-xs text-center text-slate-400">
            {allPatients.length} / {results?.total ?? 0}
          </p>
        </>
      )}

      {/* Archive confirm */}
      <ConfirmDialog
        open={!!archiveTarget}
        title={t('patients.archiveConfirm')}
        description={t('patients.archiveWarning')}
        confirmLabel={t('common.archive')}
        danger
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  )
}

interface PatientRowProps {
  patient: Patient
  locale: string
  fmtDate: (iso: string) => string
  onView: () => void
  onEdit: () => void
  onArchive: () => void
}

function PatientRow({ patient, locale, fmtDate, onView, onEdit, onArchive }: PatientRowProps) {
  const { t } = useTranslation()
  const isAr = locale.startsWith('ar')

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer group"
      onClick={onView}
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm shrink-0">
        {patient.fullName.charAt(0)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">{patient.fullName}</span>
          {patient.deletedAt && <Badge variant="yellow">{t('common.archived')}</Badge>}
          {patient.gender && (
            <Badge variant="blue">{t(`patients.${patient.gender}`)}</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
          <span className="font-mono text-blue-600 dark:text-blue-400">{patient.fileNumber}</span>
          {patient.phone && <span dir="ltr">{patient.phone}</span>}
          {patient.dateOfBirth && (
            <span>{calcAge(patient.dateOfBirth)} {t('patients.years')}</span>
          )}
          <span>{fmtDate(patient.createdAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onEdit}
          className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors text-xs"
          title={t('common.edit')}
        >
          ✏️
        </button>
        {!patient.deletedAt && (
          <button
            onClick={onArchive}
            className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors text-xs"
            title={t('common.archive')}
          >
            🗂
          </button>
        )}
      </div>

      <span className="text-slate-300 dark:text-slate-600 text-sm group-hover:text-blue-400 transition-colors">
        {isAr ? '←' : '→'}
      </span>
    </div>
  )
}
