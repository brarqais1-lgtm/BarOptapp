import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { PageSpinner } from '../../components/ui/Spinner'
import { db } from '../../database/db'
import type { EyeExamination, Patient } from '../../database/schema'
import i18n from 'i18next'

export function ExaminationsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US'

  const [exams, setExams] = useState<Array<EyeExamination & { patient?: Patient }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const allExams = await db.eyeExaminations
        .filter(e => !e.deletedAt)
        .toArray()
      allExams.sort((a, b) => b.examinationDate.localeCompare(a.examinationDate))

      const patientIds = [...new Set(allExams.map(e => e.patientId))]
      const patients = await Promise.all(patientIds.map(pid => db.patients.get(pid)))
      const patientMap = new Map(patients.filter(Boolean).map(p => [p!.id, p!]))

      setExams(allExams.map(e => ({ ...e, patient: patientMap.get(e.patientId) })))
      setLoading(false)
    }
    load()
  }, [])

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })

  const examTypeColor: Record<string, 'blue' | 'green' | 'purple' | 'yellow'> = {
    comprehensive: 'blue',
    distance:      'green',
    near:          'purple',
    recheck:       'yellow',
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('examinations.title')}
        </h1>
        <Button onClick={() => navigate('/examinations/new')}>
          + {t('examinations.new')}
        </Button>
      </div>

      {/* List */}
      {exams.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3 opacity-30">👁</div>
          <p className="font-medium">{t('examinations.noExaminations')}</p>
          <p className="text-sm mt-1">{t('examinations.noExaminationsHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map(exam => (
            <div
              key={exam.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
              onClick={() => navigate(`/examinations/${exam.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-sm text-blue-600 dark:text-blue-400 font-semibold">
                      {exam.examinationNumber}
                    </span>
                    <Badge variant={examTypeColor[exam.examType] ?? 'blue'}>
                      {t(`examinations.${exam.examType}`)}
                    </Badge>
                    {exam.patient && (
                      <span className="text-sm text-slate-700 dark:text-slate-200 font-medium truncate">
                        {exam.patient.fullName}
                      </span>
                    )}
                    {exam.patient && (
                      <span className="text-xs text-slate-400 font-mono">
                        {exam.patient.fileNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span>📅 {fmtDate(exam.examinationDate)}</span>
                    {exam.examinedBy && <span>👤 {exam.examinedBy}</span>}
                    {(exam.reSphere !== undefined || exam.leSphere !== undefined) && (
                      <span dir="ltr">
                        OD: {exam.reSphere !== undefined ? (exam.reSphere >= 0 ? `+${exam.reSphere}` : `${exam.reSphere}`) : '—'}
                        {' / '}
                        OS: {exam.leSphere !== undefined ? (exam.leSphere >= 0 ? `+${exam.leSphere}` : `${exam.leSphere}`) : '—'}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => { e.stopPropagation(); navigate(`/examinations/${exam.id}`) }}
                >
                  {t('common.view')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
