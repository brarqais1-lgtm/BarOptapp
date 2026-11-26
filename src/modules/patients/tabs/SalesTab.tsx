import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Badge, type BadgeVariant } from '../../../components/ui/Badge'
import { db } from '../../../database/db'
import type { Patient, Sale } from '../../../database/schema'

const statusBadge: Record<string, BadgeVariant> = {
  draft: 'gray', confirmed: 'blue', ready: 'teal', delivered: 'green', cancelled: 'red',
}
const payBadge: Record<string, BadgeVariant> = {
  unpaid: 'red', partial: 'yellow', paid: 'green',
}

interface Props { patient: Patient }

function fmtNum(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function SalesTab({ patient }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.sales
      .where('patientId').equals(patient.id)
      .reverse()
      .sortBy('saleDate')
      .then(list => { setSales(list); setLoading(false) })
  }, [patient.id])

  if (loading) return <div className="p-6 text-sm text-slate-400">{t('common.loading')}</div>

  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="text-5xl mb-3 opacity-30">🕶</div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('patients.purchases.empty')}</p>
        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">{t('patients.purchases.emptyHint')}</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-700">
      {sales.map(sale => (
        <button
          key={sale.id}
          onClick={() => navigate(`/sales/${sale.id}`)}
          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-start"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-blue-700 dark:text-blue-400">
                {sale.saleNumber}
              </span>
              <Badge variant={statusBadge[sale.status] ?? 'gray'}>
                {t(`sales.status.${sale.status}`)}
              </Badge>
              <Badge variant={payBadge[sale.paymentStatus] ?? 'gray'}>
                {t(`sales.payment.${sale.paymentStatus}`)}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{sale.saleDate}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-sm text-slate-900 dark:text-white">
              {fmtNum(sale.total)}
            </p>
            {sale.balanceDue > 0 && (
              <p className="text-xs text-red-500">متبقي {fmtNum(sale.balanceDue)}</p>
            )}
          </div>
          <span className="text-slate-300 dark:text-slate-600 text-lg">›</span>
        </button>
      ))}
    </div>
  )
}
