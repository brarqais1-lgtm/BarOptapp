import { useTranslation } from 'react-i18next'
import type { Patient } from '../../../database/schema'
import type { PatientFinancialSummary } from '../financial.service'
import { formatCurrency } from '../../../utils/format'
import { calcAge } from '../../../utils/date'

interface OverviewTabProps {
  patient: Patient
  financial: PatientFinancialSummary
  examinationCount: number
  locale: string
}

export function OverviewTab({ patient, financial, examinationCount, locale }: OverviewTabProps) {
  const { t } = useTranslation()
  const isAr = locale.startsWith('ar')
  const currency = isAr ? 'SAR' : 'SAR'
  const fmt = (n: number) => formatCurrency(n, currency, locale)

  return (
    <div className="p-5 space-y-6">
      {/* Patient info card */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">{t('patients.title')}</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <InfoRow label={t('patients.fileNumber')} value={patient.fileNumber} />
          <InfoRow label={t('patients.fullName')} value={patient.fullName} />
          {patient.phone && <InfoRow label={t('patients.phone')} value={patient.phone} dir="ltr" />}
          {patient.phone2 && <InfoRow label={t('patients.phone2')} value={patient.phone2} dir="ltr" />}
          {patient.email && <InfoRow label={t('patients.email')} value={patient.email} dir="ltr" />}
          {patient.gender && (
            <InfoRow label={t('patients.gender')} value={t(`patients.${patient.gender}`)} />
          )}
          {patient.dateOfBirth && (
            <InfoRow
              label={t('patients.age')}
              value={`${calcAge(patient.dateOfBirth)} ${t('patients.years')}`}
            />
          )}
          {patient.address && <InfoRow label={t('patients.address')} value={patient.address} wide />}
          <InfoRow label={t('patients.registeredAt')} value={formatDate(patient.createdAt, locale)} />
        </div>
      </section>

      {/* Stats grid */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label={t('patients.overview.examCount')} value={String(examinationCount)} icon="👁" />
          <StatCard label={t('patients.overview.purchaseCount')} value={String(financial.purchaseCount)} icon="🕶" />
          <StatCard label={t('patients.overview.totalSpent')} value={fmt(financial.totalSalesAmount)} icon="💳" />
          <StatCard label={t('patients.overview.totalPaid')} value={fmt(financial.totalPaid)} icon="✓" color="emerald" />
          <StatCard
            label={t('patients.overview.balance')}
            value={fmt(financial.totalBalance)}
            icon="⚖"
            color={financial.totalBalance > 0 ? 'red' : 'emerald'}
          />
          {financial.lastPurchaseDate && (
            <StatCard
              label={t('patients.overview.lastVisit')}
              value={formatDate(financial.lastPurchaseDate, locale)}
              icon="📅"
            />
          )}
        </div>
      </section>

      {/* Notes preview */}
      {patient.notes && (
        <section className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 border border-amber-200 dark:border-amber-800">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">{t('patients.notes')}</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{patient.notes}</p>
        </section>
      )}
    </div>
  )
}

function InfoRow({ label, value, dir, wide }: { label: string; value: string; dir?: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-900 dark:text-white mt-0.5" dir={dir}>{value}</dd>
    </div>
  )
}

type StatColor = 'blue' | 'emerald' | 'red' | 'default'
function StatCard({ label, value, icon, color = 'default' }: { label: string; value: string; icon: string; color?: StatColor }) {
  const bg: Record<StatColor, string> = {
    default: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
    blue:    'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800',
    red:     'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800',
  }
  return (
    <div className={`rounded-2xl p-4 ${bg[color]}`}>
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</div>
      <div className="font-semibold text-slate-900 dark:text-white text-sm">{value}</div>
    </div>
  )
}

// Keep formatDate accessible from format.ts via re-export
function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso.slice(0, 10)
  }
}
