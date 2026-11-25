import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import i18n from 'i18next'
import { db } from '../../database/db'
import { Button } from '../../components/ui/Button'
import { Badge, type BadgeVariant } from '../../components/ui/Badge'
import type { Sale, SaleItem, Patient, Prescription } from '../../database/schema'
import { confirmSale, cancelSale, markSaleReady, markSaleDelivered } from './SalesRepository'
import { getPayments } from './PaymentsRepository'
import { getSaleReturns } from './ReturnsService'

const statusBadge: Record<string, BadgeVariant> = {
  draft: 'gray', confirmed: 'blue', ready: 'teal', delivered: 'green', cancelled: 'red',
}
const paymentBadge: Record<string, BadgeVariant> = {
  unpaid: 'red', partial: 'yellow', paid: 'green',
}
const methodBadge: Record<string, BadgeVariant> = {
  cash: 'green', card: 'blue', transfer: 'teal', cheque: 'purple', other: 'gray',
}

export default function SaleDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [actionError, setActionError] = useState('')
  const [working, setWorking] = useState(false)
  const [labPrint, setLabPrint] = useState(false)

  const sale = useLiveQuery(() => db.sales.get(id!), [id])
  const items = useLiveQuery(() => db.saleItems.where('saleId').equals(id!).toArray(), [id])
  const payments = useLiveQuery(() => getPayments(id!), [id])
  const returns = useLiveQuery(() => getSaleReturns(id!), [id])

  const patient = useLiveQuery(async () => {
    if (!sale?.patientId) return undefined
    return db.patients.get(sale.patientId)
  }, [sale?.patientId])

  const prescription = useLiveQuery(async () => {
    if (!sale?.prescriptionId) return undefined
    return db.prescriptions.get(sale.prescriptionId)
  }, [sale?.prescriptionId])

  const clinicSettings = useLiveQuery(async () => {
    const rows = await db.settings
      .filter(s => ['clinic_name', 'clinic_phone', 'clinic_address', 'clinic_logo'].includes(s.key))
      .toArray()
    const m: Record<string, string> = {}
    for (const r of rows) m[r.key] = JSON.parse(r.value) as string
    return m
  }, [])

  if (!sale) return <div className="p-4 text-gray-400">{t('common.loading')}</div>

  async function doConfirm() {
    setActionError('')
    setWorking(true)
    try { await confirmSale(sale!.id) }
    catch (err) { setActionError(String(err)) }
    finally { setWorking(false) }
  }

  async function doMarkReady() {
    setActionError('')
    setWorking(true)
    try { await markSaleReady(sale!.id, undefined) }
    catch (err) { setActionError(String(err)) }
    finally { setWorking(false) }
  }

  async function doMarkDelivered() {
    setActionError('')
    setWorking(true)
    try { await markSaleDelivered(sale!.id) }
    catch (err) { setActionError(String(err)) }
    finally { setWorking(false) }
  }

  async function doCancel() {
    if (!confirm(t('sales.confirmCancel'))) return
    setActionError('')
    setWorking(true)
    try { await cancelSale(sale!.id) }
    catch (err) { setActionError(String(err)) }
    finally { setWorking(false) }
  }

  function doPrint() { window.print() }

  function doLabPrint() {
    setLabPrint(true)
  }

  const isRtl = i18n.language === 'ar'

  useEffect(() => {
    if (!labPrint) return
    document.body.classList.add('lab-print-mode')
    window.print()
    const handler = () => {
      document.body.classList.remove('lab-print-mode')
      setLabPrint(false)
    }
    window.addEventListener('afterprint', handler, { once: true })
    return () => {
      document.body.classList.remove('lab-print-mode')
      window.removeEventListener('afterprint', handler)
    }
  }, [labPrint])

  return (
    <div className="p-4 space-y-4 max-w-4xl print:max-w-full print:p-0" dir={isRtl ? 'rtl' : 'ltr'}>
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm 15mm 15mm 15mm; }
          body { background: white !important; color: black !important; font-size: 11pt; }
          .print\\:hidden { display: none !important; }
          .print-block { display: block !important; }
          body.lab-print-mode .invoice-print-section { display: none !important; }
          body.lab-print-mode .lab-order-section { display: block !important; }
          body:not(.lab-print-mode) .lab-order-section { display: none !important; }
        }
      `}</style>

      {/* Clinic header — visible only on print */}
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-gray-900">
        <div className={`flex ${isRtl ? 'flex-row-reverse' : 'flex-row'} justify-between items-start`}>
          <div className={isRtl ? 'text-right' : 'text-left'}>
            <p className="text-xl font-bold">{clinicSettings?.clinic_name ?? t('app.name')}</p>
            {clinicSettings?.clinic_address && (
              <p className="text-sm text-gray-600">{clinicSettings.clinic_address}</p>
            )}
            {clinicSettings?.clinic_phone && (
              <p className="text-sm text-gray-600">{clinicSettings.clinic_phone}</p>
            )}
          </div>
          <div className={`text-sm ${isRtl ? 'text-left' : 'text-right'}`}>
            <p className="font-bold text-lg">{t('sales.invoice')}</p>
            <p className="font-mono">{sale.saleNumber}</p>
            <p>{sale.saleDate}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/sales')}>← {t('common.back')}</Button>
          <h1 className="text-xl font-semibold flex-1">{sale.saleNumber}</h1>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {sale.status === 'draft' && (
            <>
              <Button variant="secondary" size="sm" onClick={() => navigate(`/sales/${id}/edit`)}>
                {t('common.edit')}
              </Button>
              <Button size="sm" loading={working} onClick={doConfirm}>
                {t('sales.confirm')}
              </Button>
            </>
          )}
          {sale.status === 'confirmed' && (
            <Button size="sm" loading={working} onClick={doMarkReady}>
              {t('sales.markReady')}
            </Button>
          )}
          {sale.status === 'ready' && (
            <Button size="sm" loading={working} onClick={doMarkDelivered}>
              {t('sales.markDelivered')}
            </Button>
          )}
          {(sale.status === 'confirmed' || sale.status === 'ready') && sale.balanceDue > 0 && (
            <Button variant="secondary" size="sm" onClick={() => navigate(`/sales/${id}/payment`)}>
              {t('sales.addPayment')}
            </Button>
          )}
          {sale.status === 'confirmed' && items?.some(i => i.quantity > i.returnedQty) && (
            <Button variant="secondary" size="sm" onClick={() => navigate(`/sales/${id}/return`)}>
              {t('sales.processReturn')}
            </Button>
          )}
          {(sale.status === 'confirmed' || sale.status === 'ready') && (
            <Button variant="ghost" size="sm" onClick={doLabPrint}>{t('sales.printLabOrder')}</Button>
          )}
          {sale.status !== 'cancelled' && (
            <Button variant="ghost" size="sm" onClick={doPrint}>{t('common.print')}</Button>
          )}
          {(sale.status === 'draft' || sale.status === 'confirmed') && (
            <Button variant="danger" size="sm" loading={working} onClick={doCancel}>
              {t('sales.cancel')}
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg px-4 py-3 text-sm print:hidden">
          {actionError}
        </div>
      )}

      {/* Lab order slip — screen: hidden; print: shown only in lab-print-mode */}
      <div className="lab-order-section hidden">
        <LabOrderSlip
          sale={sale}
          patient={patient}
          prescription={prescription ?? undefined}
          items={items ?? []}
          clinicSettings={clinicSettings}
          isRtl={isRtl}
          t={t}
        />
      </div>

      {/* Invoice content — hidden during lab print */}
      <div className="invoice-print-section">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
          <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">{t('sales.invoiceInfo')}</h2>
          <Row label={t('sales.invoiceNumber')} value={sale.saleNumber} mono />
          <Row label={t('sales.date')} value={sale.saleDate} />
          {sale.readyDate && <Row label={t('sales.readyDate')} value={sale.readyDate} />}
          {sale.deliveryDate && <Row label={t('sales.deliveryDate')} value={sale.deliveryDate} />}
          <Row label={t('common.status')}>
            <Badge variant={statusBadge[sale.status] ?? 'gray'}>{t(`sales.status.${sale.status}`)}</Badge>
          </Row>
          <Row label={t('sales.payment.status')}>
            <Badge variant={paymentBadge[sale.paymentStatus] ?? 'gray'}>{t(`sales.payment.${sale.paymentStatus}`)}</Badge>
          </Row>
          {sale.notes && <Row label={t('common.notes')} value={sale.notes} />}
          {sale.labNotes && <Row label={t('sales.labNotes')} value={sale.labNotes} />}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
          <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wide">{t('sales.customerInfo')}</h2>
          {patient ? (
            <>
              <Row label={t('sales.patient')} value={patient.fullName} />
              <Row label={t('patients.fileNumber')} value={patient.fileNumber} mono />
              {patient.phone && <Row label={t('patients.phone')} value={patient.phone} />}
            </>
          ) : (
            <Row label={t('sales.walkInName')} value={sale.walkInName ?? t('sales.walkIn')} />
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="font-medium mb-3">{t('sales.items')}</h2>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="py-2 text-start">{t('sales.description')}</th>
                <th className="py-2 text-end">{t('sales.qty')}</th>
                <th className="py-2 text-end">{t('sales.unitPrice')}</th>
                <th className="py-2 text-end">{t('sales.itemDiscount')}</th>
                <th className="py-2 text-end">{t('sales.lineTotal')}</th>
                {sale.status !== 'draft' && <th className="py-2 text-end">{t('sales.returned')}</th>}
              </tr>
            </thead>
            <tbody>
              {items?.map(item => (
                <tr key={item.id} className="border-b border-gray-50 dark:border-gray-700">
                  <td className="py-2">
                    <span>{item.description}</span>
                    {item.sku && <span className="text-xs text-gray-400 ml-2">{item.sku}</span>}
                  </td>
                  <td className="py-2 text-end">{item.quantity}</td>
                  <td className="py-2 text-end">{item.unitPrice.toFixed(2)}</td>
                  <td className="py-2 text-end">{item.discountAmount.toFixed(2)}</td>
                  <td className="py-2 text-end">{item.total.toFixed(2)}</td>
                  {sale.status !== 'draft' && (
                    <td className="py-2 text-end text-gray-500">{item.returnedQty > 0 ? item.returnedQty : '—'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col items-end gap-1 text-sm">
          <TotalRow label={t('sales.subtotal')} value={sale.subtotal} />
          {sale.discountAmount > 0 && <TotalRow label={t('sales.discount')} value={-sale.discountAmount} />}
          <TotalRow label={t('sales.total')} value={sale.total} bold />
          <TotalRow label={t('sales.paid')} value={sale.paidAmount} />
          <TotalRow label={t('sales.balance')} value={sale.balanceDue} bold />
        </div>
      </div>

      {payments && payments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="font-medium mb-3">{t('sales.payments')}</h2>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm min-w-[360px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="py-2 text-start">{t('sales.payment.date')}</th>
                  <th className="py-2 text-start">{t('sales.payment.method')}</th>
                  <th className="py-2 text-start">{t('sales.payment.reference')}</th>
                  <th className="py-2 text-end">{t('sales.payment.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}
                    className={`border-b border-gray-50 dark:border-gray-700 ${p.deletedAt ? 'opacity-50' : ''}`}>
                    <td className={`py-2 whitespace-nowrap ${p.deletedAt ? 'line-through text-gray-400' : ''}`}>{p.paidAt}</td>
                    <td className="py-2">
                      <Badge variant={p.deletedAt ? 'gray' : (methodBadge[p.method] ?? 'gray')}>
                        {p.deletedAt ? t('sales.payment.voided') : t(`sales.payment.methods.${p.method}`)}
                      </Badge>
                    </td>
                    <td className={`py-2 ${p.deletedAt ? 'line-through text-gray-400' : ''}`}>{p.reference ?? '—'}</td>
                    <td className={`py-2 text-end whitespace-nowrap ${p.deletedAt ? 'line-through text-gray-400' : ''}`}>
                      {p.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {returns && returns.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="font-medium mb-3">{t('sales.returns')}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="py-2 text-start">{t('sales.return.number')}</th>
                <th className="py-2 text-start">{t('sales.return.date')}</th>
                <th className="py-2 text-start">{t('sales.return.reason')}</th>
                <th className="py-2 text-end">{t('sales.return.refund')}</th>
              </tr>
            </thead>
            <tbody>
              {returns.map(r => (
                <tr key={r.id} className="border-b border-gray-50 dark:border-gray-700">
                  <td className="py-2 font-mono text-xs">{r.returnNumber}</td>
                  <td className="py-2">{r.returnDate}</td>
                  <td className="py-2">{r.reason ?? '—'}</td>
                  <td className="py-2 text-end">{r.totalRefund.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      </div>{/* end invoice-print-section */}
    </div>
  )
}

// ── Lab Order Slip (print only) ───────────────────────────────────────────────

function fmtRx(n: number | undefined): string {
  if (n == null) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2)
}

function LabOrderSlip({ sale, patient, prescription, items, clinicSettings, isRtl, t }: {
  sale: Sale
  patient: Patient | undefined
  prescription: Prescription | undefined
  items: SaleItem[]
  clinicSettings: Record<string, string> | undefined
  isRtl: boolean
  t: TFunction
}) {
  const customerName = patient?.fullName ?? sale.walkInName ?? t('sales.walkIn')
  const frameItems = items.filter(i => i.itemType === 'frame')
  const lensItems = items.filter(i => i.itemType === 'lens')

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '12px' }}>
        <div>
          <strong style={{ fontSize: '16pt' }}>{clinicSettings?.clinic_name ?? t('app.name')}</strong>
          {clinicSettings?.clinic_phone && <div style={{ fontSize: '10pt', color: '#555' }}>{clinicSettings.clinic_phone}</div>}
        </div>
        <div style={{ textAlign: isRtl ? 'left' : 'right' }}>
          <strong style={{ fontSize: '14pt' }}>{t('sales.labOrderSlip')}</strong>
          <div style={{ fontSize: '10pt' }}>{sale.saleNumber}</div>
          <div style={{ fontSize: '10pt' }}>{sale.saleDate}</div>
        </div>
      </div>

      {/* Customer */}
      <div style={{ marginBottom: '10px' }}>
        <span style={{ fontSize: '10pt', color: '#777' }}>{t('sales.customer')}: </span>
        <strong style={{ fontSize: '12pt' }}>{customerName}</strong>
        {patient?.phone && <span style={{ fontSize: '10pt', color: '#555', marginInlineStart: '12px' }}>{patient.phone}</span>}
      </div>

      {/* Prescription */}
      {prescription && (
        <div style={{ border: '1px solid #ccc', borderRadius: '6px', padding: '8px', marginBottom: '10px', backgroundColor: '#f9f9f9' }}>
          <strong style={{ fontSize: '10pt' }}>{t('sales.prescriptionRef')} — {prescription.prescriptionNumber}</strong>
          <table style={{ width: '100%', marginTop: '6px', fontSize: '10pt', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc' }}>
                <th style={{ textAlign: 'start', padding: '2px 4px' }}></th>
                <th style={{ padding: '2px 4px' }}>SPH</th>
                <th style={{ padding: '2px 4px' }}>CYL</th>
                <th style={{ padding: '2px 4px' }}>AXIS</th>
                <th style={{ padding: '2px 4px' }}>ADD</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '2px 4px' }}>OD</td>
                <td style={{ textAlign: 'center', padding: '2px 4px', fontFamily: 'monospace' }}>{fmtRx(prescription.reSphere)}</td>
                <td style={{ textAlign: 'center', padding: '2px 4px', fontFamily: 'monospace' }}>{fmtRx(prescription.reCylinder)}</td>
                <td style={{ textAlign: 'center', padding: '2px 4px', fontFamily: 'monospace' }}>{prescription.reAxis ?? '—'}°</td>
                <td style={{ textAlign: 'center', padding: '2px 4px', fontFamily: 'monospace' }}>{fmtRx(prescription.reAdd)}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '2px 4px' }}>OS</td>
                <td style={{ textAlign: 'center', padding: '2px 4px', fontFamily: 'monospace' }}>{fmtRx(prescription.leSphere)}</td>
                <td style={{ textAlign: 'center', padding: '2px 4px', fontFamily: 'monospace' }}>{fmtRx(prescription.leCylinder)}</td>
                <td style={{ textAlign: 'center', padding: '2px 4px', fontFamily: 'monospace' }}>{prescription.leAxis ?? '—'}°</td>
                <td style={{ textAlign: 'center', padding: '2px 4px', fontFamily: 'monospace' }}>{fmtRx(prescription.leAdd)}</td>
              </tr>
            </tbody>
          </table>
          {(prescription.pdDistance || prescription.rePd || prescription.lePd) && (
            <div style={{ marginTop: '4px', fontSize: '10pt' }}>
              PD: {prescription.pdDistance
                ? `${prescription.pdDistance}mm`
                : `OD ${prescription.rePd ?? '—'}mm / OS ${prescription.lePd ?? '—'}mm`}
            </div>
          )}
        </div>
      )}

      {/* Frame */}
      {frameItems.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <strong style={{ fontSize: '10pt' }}>{t('sales.frame')}:</strong>
          {frameItems.map(i => (
            <span key={i.id} style={{ fontSize: '10pt', marginInlineStart: '8px' }}>
              {i.description}{i.sku ? ` (${i.sku})` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Lens */}
      {lensItems.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <strong style={{ fontSize: '10pt' }}>{t('sales.lens')}:</strong>
          {lensItems.map(i => (
            <span key={i.id} style={{ fontSize: '10pt', marginInlineStart: '8px' }}>
              {i.description}{i.sku ? ` (${i.sku})` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Ready date + lab notes */}
      <div style={{ borderTop: '1px dashed #ccc', paddingTop: '8px', marginTop: '8px', fontSize: '10pt' }}>
        {sale.readyDate && (
          <div><strong>{t('sales.readyDate')}:</strong> {sale.readyDate}</div>
        )}
        {sale.labNotes && (
          <div style={{ marginTop: '4px' }}><strong>{t('sales.labNotes')}:</strong> {sale.labNotes}</div>
        )}
      </div>

      {/* Signature lines */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', fontSize: '10pt' }}>
        <div style={{ borderTop: '1px solid #000', paddingTop: '4px', width: '120px', textAlign: 'center' }}>
          {t('sales.labSignature')}
        </div>
        <div style={{ borderTop: '1px solid #000', paddingTop: '4px', width: '120px', textAlign: 'center' }}>
          {t('sales.customerSignature')}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono, children }: {
  label: string; value?: string; mono?: boolean; children?: React.ReactNode
}) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500">{label}</span>
      {children ?? <span className={mono ? 'font-mono text-xs' : ''}>{value ?? '—'}</span>}
    </div>
  )
}

function TotalRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex gap-8 justify-end text-sm ${bold ? 'font-semibold text-base' : ''}`}>
      <span className="text-gray-500 w-32 text-end">{label}</span>
      <span className="w-24 text-end">{value.toFixed(2)}</span>
    </div>
  )
}
