import { useTranslation } from 'react-i18next'
import type { Patient } from '../../database/schema'
import type { PatientFinancialSummary } from './financial.service'
import { calcAge } from '../../utils/date'
import { formatCurrency } from '../../utils/format'
import { useCurrency } from '../../hooks/useCurrency'

interface PrintViewProps {
  patient: Patient
  financial: PatientFinancialSummary
  examinationCount: number
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }) }
  catch { return iso.slice(0, 10) }
}

export function PrintView({ patient, financial, examinationCount }: PrintViewProps) {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const locale = isAr ? 'ar-SA' : 'en-US'
  const { code: currency } = useCurrency()

  return (
    <div
      id="print-area"
      className="hidden print:block bg-white text-black p-8 max-w-[210mm] mx-auto"
      dir={isAr ? 'rtl' : 'ltr'}
      style={{ fontFamily: "'Noto Sans Arabic', 'Segoe UI', sans-serif" }}
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-blue-800 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">BarOpt</h1>
          <p className="text-sm text-gray-500">{t('app.tagline')}</p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p>{t('patients.print.generatedOn')}: {fmtDate(new Date().toISOString())}</p>
          <p className="font-mono text-xs">{patient.fileNumber}</p>
        </div>
      </div>

      {/* Patient info */}
      <section className="mb-6">
        <h2 className="text-base font-bold text-blue-800 border-b border-blue-200 pb-1 mb-3">
          {t('patients.print.title')}
        </h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <Row label={t('patients.fileNumber')} value={patient.fileNumber} />
          <Row label={t('patients.fullName')} value={patient.fullName} />
          {patient.phone && <Row label={t('patients.phone')} value={patient.phone} />}
          {patient.gender && <Row label={t('patients.gender')} value={t(`patients.${patient.gender}`)} />}
          {patient.dateOfBirth && (
            <Row label={t('patients.age')} value={`${calcAge(patient.dateOfBirth)} ${t('patients.years')}`} />
          )}
          {patient.address && <Row label={t('patients.address')} value={patient.address} wide />}
          <Row label={t('patients.registeredAt')} value={fmtDate(patient.createdAt)} />
        </div>
      </section>

      {/* Summary */}
      <section className="mb-6">
        <h2 className="text-base font-bold text-blue-800 border-b border-blue-200 pb-1 mb-3">
          {t('patients.tabs.overview')}
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <SummaryBox label={t('patients.overview.examCount')} value={String(examinationCount)} />
          <SummaryBox label={t('patients.overview.purchaseCount')} value={String(financial.purchaseCount)} />
          <SummaryBox label={t('patients.overview.totalSpent')} value={formatCurrency(financial.totalSalesAmount, currency, locale)} />
          <SummaryBox label={t('patients.overview.totalPaid')} value={formatCurrency(financial.totalPaid, currency, locale)} />
          <SummaryBox
            label={t('patients.overview.balance')}
            value={formatCurrency(financial.totalBalance, currency, locale)}
            highlight={financial.totalBalance > 0}
          />
        </div>
      </section>

      {/* Notes */}
      {patient.notes && (
        <section>
          <h2 className="text-base font-bold text-blue-800 border-b border-blue-200 pb-1 mb-2">
            {t('patients.notes')}
          </h2>
          <p className="text-sm whitespace-pre-wrap">{patient.notes}</p>
        </section>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
        BarOpt — {t('app.tagline')}
      </div>
    </div>
  )
}

function Row({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <span className="text-gray-500">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function SummaryBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`border rounded-lg p-3 text-center ${highlight ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`font-semibold text-sm ${highlight ? 'text-red-700' : 'text-gray-900'}`}>{value}</div>
    </div>
  )
}
