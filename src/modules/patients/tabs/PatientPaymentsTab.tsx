import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Badge, type BadgeVariant } from '../../../components/ui/Badge'
import { db } from '../../../database/db'
import type { Patient, Payment } from '../../../database/schema'

const methodBadge: Record<string, BadgeVariant> = {
  cash: 'green', card: 'blue', transfer: 'teal', cheque: 'purple', other: 'gray',
}

interface PaymentRow extends Payment {
  saleNumber: string
  saleId: string
}

interface Props { patient: Patient; refreshKey?: number }

function fmtNum(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PatientPaymentsTab({ patient, refreshKey }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const load = async () => {
      const sales = await db.sales.where('patientId').equals(patient.id).toArray()
      const all: PaymentRow[] = []
      for (const sale of sales) {
        const payments = await db.payments.where('saleId').equals(sale.id).toArray()
        for (const p of payments) {
          if (!p.deletedAt) all.push({ ...p, saleNumber: sale.saleNumber, saleId: sale.id })
        }
      }
      all.sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      setRows(all)
      setLoading(false)
    }
    load()
  }, [patient.id, refreshKey])

  if (loading) return <div className="p-6 text-sm text-slate-400">{t('common.loading')}</div>

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="text-5xl mb-3 opacity-30">💳</div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('patients.payments.empty')}</p>
        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">{t('patients.payments.emptyHint')}</p>
      </div>
    )
  }

  const total = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {rows.map(row => (
          <button
            key={row.id}
            onClick={() => navigate(`/sales/${row.saleId}`)}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-start"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {row.saleNumber}
                </span>
                <Badge variant={methodBadge[row.method] ?? 'gray'}>
                  {t(`sales.payment.methods.${row.method}`)}
                </Badge>
                {row.reference && (
                  <span className="text-xs text-slate-400">#{row.reference}</span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{row.paidAt}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold text-sm text-green-700 dark:text-green-400">
                +{fmtNum(row.amount)}
              </p>
            </div>
            <span className="text-slate-300 dark:text-slate-600 text-lg">›</span>
          </button>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span>الإجمالي المدفوع</span>
        <span className="text-green-700 dark:text-green-400">{fmtNum(total)}</span>
      </div>
    </div>
  )
}
