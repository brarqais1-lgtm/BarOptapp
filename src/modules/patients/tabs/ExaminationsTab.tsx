import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { PrescriptionPrintView } from '../../examinations/PrescriptionPrintView'
import {
  getPatientExaminations,
  getExaminationPrescriptions,
  compareExaminations,
  type ExamDiff,
} from '../../examinations/ExaminationRepository'
import { db } from '../../../database/db'
import type { EyeExamination, Patient, Prescription } from '../../../database/schema'
import i18n from 'i18next'

interface Props {
  patient: Patient
  onExamCountChange?: (n: number) => void
}

export function ExaminationsTab({ patient, onExamCountChange }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isAr = i18n.language === 'ar'
  const locale = isAr ? 'ar-SA' : 'en-US'

  const [exams, setExams] = useState<EyeExamination[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [comparison, setComparison] = useState<ExamDiff[] | null>(null)
  const [printRx, setPrintRx] = useState<Prescription | null>(null)
  const [rxMap, setRxMap] = useState<Map<string, Prescription[]>>(new Map())

  useEffect(() => {
    getPatientExaminations(patient.id, false, db).then(async list => {
      setExams(list)
      onExamCountChange?.(list.length)

      const map = new Map<string, Prescription[]>()
      await Promise.all(list.map(async e => {
        const rxs = await getExaminationPrescriptions(e.id, db)
        map.set(e.id, rxs)
      }))
      setRxMap(map)
      setLoading(false)
    })
  }, [patient.id, onExamCountChange])

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })

  const fmtNum = (n: number | undefined) =>
    n !== undefined ? (n >= 0 ? `+${n}` : String(n)) : '—'

  const toggleSelect = (examId: string) => {
    setSelected(prev => {
      if (prev.includes(examId)) return prev.filter(id => id !== examId)
      if (prev.length >= 2) return [prev[1], examId]
      return [...prev, examId]
    })
    setComparison(null)
  }

  const handleCompare = () => {
    if (selected.length < 2) return
    const a = exams.find(e => e.id === selected[0])
    const b = exams.find(e => e.id === selected[1])
    if (a && b) setComparison(compareExaminations(a, b))
  }

  const examTypeColor: Record<string, 'blue' | 'green' | 'purple' | 'yellow'> = {
    comprehensive: 'blue', distance: 'green', near: 'purple', recheck: 'yellow',
  }

  if (loading) return (
    <div className="p-5 text-center text-slate-400 text-sm">{t('common.loading')}</div>
  )

  return (
    <div className="p-5">
      {/* Print view — hidden on screen */}
      {printRx && (
        <PrescriptionPrintView
          patient={patient}
          examination={exams.find(e => rxMap.get(e.id)?.some(rx => rx.id === printRx.id))!}
          prescription={printRx}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {t('patients.tabs.examinations')} ({exams.length})
          </h3>
          {selected.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {selected.length === 1
                ? t('examinations.selectOneMore')
                : t('examinations.twoSelected')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {selected.length === 2 && (
            <Button variant="secondary" size="sm" onClick={handleCompare}>
              ⚖ {t('examinations.compare')}
            </Button>
          )}
          <Button size="sm" onClick={() => navigate(`/examinations/new?patientId=${patient.id}`)}>
            + {t('examinations.new')}
          </Button>
        </div>
      </div>

      {/* Comparison panel */}
      {comparison && (
        <div className="mb-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {t('examinations.comparison')}
            </h4>
            <button onClick={() => setComparison(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg">×</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 px-3 text-xs text-slate-400 font-medium text-start">{t('examinations.metric')}</th>
                  <th className="py-2 px-3 text-center text-xs font-bold text-blue-600 dark:text-blue-400">
                    {fmtDate(exams.find(e => e.id === selected[0])?.examinationDate ?? '')}
                  </th>
                  <th className="py-2 px-3 text-center text-xs font-bold text-green-600 dark:text-green-400">
                    {fmtDate(exams.find(e => e.id === selected[1])?.examinationDate ?? '')}
                  </th>
                  <th className="py-2 px-3 text-center text-xs text-slate-400">{t('examinations.difference')}</th>
                </tr>
              </thead>
              <tbody>
                {comparison.filter(d => d.valueA !== '—' || d.valueB !== '—').map(d => (
                  <tr key={d.field} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <td className="py-2 px-3 text-xs font-bold text-slate-500 uppercase">{isAr ? d.labelAr : d.labelEn}</td>
                    <td className="py-2 px-3 text-center font-mono" dir="ltr">{String(d.valueA)}</td>
                    <td className="py-2 px-3 text-center font-mono" dir="ltr">{String(d.valueB)}</td>
                    <td className="py-2 px-3 text-center font-mono text-xs" dir="ltr">
                      {d.diff !== null ? (d.diff === 0 ? '—' : (d.diff > 0 ? `+${d.diff}` : String(d.diff))) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Examinations list */}
      {exams.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <div className="text-4xl mb-2 opacity-30">👁</div>
          <p className="text-sm font-medium">{t('patients.examinations.empty')}</p>
          <p className="text-xs mt-1">{t('patients.examinations.emptyHint')}</p>
          <Button size="sm" className="mt-4" onClick={() => navigate(`/examinations/new?patientId=${patient.id}`)}>
            + {t('examinations.new')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map(exam => {
            const isSelected = selected.includes(exam.id)
            const rxs = rxMap.get(exam.id) ?? []
            return (
              <div
                key={exam.id}
                className={`rounded-2xl border p-4 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox for comparison */}
                  <button
                    onClick={() => toggleSelect(exam.id)}
                    className={`mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-blue-400'
                    }`}
                  >
                    {isSelected && <span className="text-xs">✓</span>}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{exam.examinationNumber}</span>
                      <Badge variant={examTypeColor[exam.examType] ?? 'blue'}>{t(`examinations.${exam.examType}`)}</Badge>
                      <span className="text-xs text-slate-500">📅 {fmtDate(exam.examinationDate)}</span>
                      {exam.examinedBy && <span className="text-xs text-slate-500">👤 {exam.examinedBy}</span>}
                      {rxs.length > 0 && (
                        <Badge variant="green">📄 {rxs.length} Rx</Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono" dir="ltr">
                      {(exam.reSphere !== undefined || exam.reCylinder !== undefined) && (
                        <span className="me-3 text-blue-600 dark:text-blue-400">
                          OD: {fmtNum(exam.reSphere)}{exam.reCylinder !== undefined ? ` / ${fmtNum(exam.reCylinder)} ×${exam.reAxis ?? '?'}` : ''}
                        </span>
                      )}
                      {(exam.leSphere !== undefined || exam.leCylinder !== undefined) && (
                        <span className="text-green-600 dark:text-green-400">
                          OS: {fmtNum(exam.leSphere)}{exam.leCylinder !== undefined ? ` / ${fmtNum(exam.leCylinder)} ×${exam.leAxis ?? '?'}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm"
                      onClick={e => { e.stopPropagation(); navigate(`/examinations/${exam.id}`) }}>
                      {t('common.view')}
                    </Button>
                    {rxs.length > 0 && (
                      <Button variant="ghost" size="sm"
                        icon={<span>🖨</span>}
                        onClick={e => {
                          e.stopPropagation()
                          setPrintRx(rxs[0])
                          setTimeout(() => window.print(), 100)
                        }}>
                        {t('examinations.prescription.print')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
