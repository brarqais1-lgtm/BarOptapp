import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../../database/db'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../contexts/ToastContext'
import { useCurrency } from '../../hooks/useCurrency'
import { createSale, confirmSale } from './SalesRepository'
import { addPayment } from './PaymentsRepository'
import type { Frame, Lens, LensVariant, Patient, PaymentMethod } from '../../database/schema'

type LensWithVariants = Lens & { variants: LensVariant[] }

function fmtDeg(n: number): string {
  if (n === 0) return 'PL'
  return (n > 0 ? '+' : '') + n.toFixed(2)
}

function fmtNum(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  patient: Patient
  onClose: () => void
  onComplete: (saleId: string) => void
}

export function GlassesSaleModal({ patient, onClose, onComplete }: Props) {
  const { toast } = useToast()
  const { t } = useTranslation()
  const { symbol: currencySymbol } = useCurrency()

  const [frames, setFrames] = useState<Frame[]>([])
  const [lenses, setLenses] = useState<LensWithVariants[]>([])

  const [frameId, setFrameId] = useState('')
  const [odLensId, setOdLensId] = useState('')
  const [odVariantId, setOdVariantId] = useState('')
  const [osLensId, setOsLensId] = useState('')
  const [osVariantId, setOsVariantId] = useState('')
  const [sameForBothEyes, setSameForBothEyes] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [paidNow, setPaidNow] = useState<number | ''>('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [readyDate, setReadyDate] = useState('')
  const [labNotes, setLabNotes] = useState('')
  const [saleDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    db.frames.filter(f => !f.deletedAt && (f.quantity ?? 0) > 0).toArray().then(setFrames)
    Promise.all([
      db.lenses.filter(l => !l.deletedAt).toArray(),
      db.lensVariants.toArray(),
    ]).then(([allLenses, allVariants]) => {
      const variantsByLens: Record<string, LensVariant[]> = {}
      for (const v of allVariants) {
        if (!variantsByLens[v.lensId]) variantsByLens[v.lensId] = []
        variantsByLens[v.lensId].push(v)
      }
      setLenses(
        allLenses
          .map(l => ({ ...l, variants: (variantsByLens[l.id] ?? []).filter(v => v.quantity > 0) }))
          .filter(l => l.variants.length > 0)
      )
    })
  }, [])

  const selectedFrame = frames.find(f => f.id === frameId)
  const selectedODLens = lenses.find(l => l.id === odLensId)
  const selectedODVariant = selectedODLens?.variants.find(v => v.id === odVariantId)
  const selectedOSLens = sameForBothEyes ? selectedODLens : lenses.find(l => l.id === osLensId)
  const selectedOSVariant = sameForBothEyes ? selectedODVariant : selectedOSLens?.variants.find(v => v.id === osVariantId)

  const framePrice = selectedFrame?.sellingPrice ?? 0
  const odPrice = selectedODVariant?.price ?? selectedODLens?.sellingPrice ?? 0
  const osPrice = sameForBothEyes ? odPrice : (selectedOSVariant?.price ?? selectedOSLens?.sellingPrice ?? 0)
  const subtotal = framePrice + odPrice + osPrice
  const total = Math.max(0, subtotal - discount)

  const handleSave = async () => {
    if (!frameId && !odLensId && !osLensId) { toast('يجب اختيار منتج واحد على الأقل', 'error'); return }

    setSaving(true)
    setSaveError('')
    try {
      const items = []
      if (selectedFrame) {
        items.push({
          itemType: 'frame' as const,
          itemId: selectedFrame.id,
          description: `${selectedFrame.brand} ${selectedFrame.model}`.trim(),
          quantity: 1,
          unitPrice: framePrice,
          discountAmount: 0,
        })
      }
      if (selectedODLens) {
        const degLabel = selectedODVariant
          ? ` (SPH ${fmtDeg(selectedODVariant.sph)} / CYL ${fmtDeg(selectedODVariant.cyl)})`
          : ''
        items.push({
          itemType: 'lens' as const,
          itemId: selectedODLens.id,
          description: `${selectedODLens.name}${degLabel} — عين يمنى`,
          quantity: 1,
          unitPrice: odPrice,
          discountAmount: 0,
        })
      }
      if (sameForBothEyes && selectedODLens) {
        const degLabel = selectedODVariant
          ? ` (SPH ${fmtDeg(selectedODVariant.sph)} / CYL ${fmtDeg(selectedODVariant.cyl)})`
          : ''
        items.push({
          itemType: 'lens' as const,
          itemId: selectedODLens.id,
          description: `${selectedODLens.name}${degLabel} — عين يسرى`,
          quantity: 1,
          unitPrice: odPrice,
          discountAmount: 0,
        })
      } else if (selectedOSLens) {
        const degLabel = selectedOSVariant
          ? ` (SPH ${fmtDeg(selectedOSVariant.sph)} / CYL ${fmtDeg(selectedOSVariant.cyl)})`
          : ''
        items.push({
          itemType: 'lens' as const,
          itemId: selectedOSLens.id,
          description: `${selectedOSLens.name}${degLabel} — عين يسرى`,
          quantity: 1,
          unitPrice: osPrice,
          discountAmount: 0,
        })
      }

      const sale = await createSale(
        {
          patientId: patient.id,
          saleDate,
          readyDate: readyDate || undefined,
          labNotes: labNotes || undefined,
          discountAmount: discount,
          discountPercent: 0,
        },
        items,
        db
      )
      await confirmSale(sale.id, db)
      const payAmount = paidNow === '' ? 0 : paidNow
      if (payAmount > 0) {
        await addPayment(sale.id, { amount: payAmount, method: payMethod, paidAt: saleDate }, db)
      }
      toast('تم إنشاء طلب النظارة بنجاح', 'success')
      onComplete(sale.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSaveError(msg)
      try { toast(`${t('common.error')}: ${msg}`, 'error') } catch { /* toast unavailable */ }
    } finally {
      setSaving(false)
    }
  }

  const selectClass = "w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelClass = "block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* sheet */}
      <div className="relative w-full sm:max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[90vh]">
        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🕶</span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">بيع نظارة</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">{patient.fullName}</span>
            <button onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors">
              ✕
            </button>
          </div>
        </div>

        {/* scrollable body */}
        <div className="overflow-y-auto px-5 pb-5 space-y-4 flex-1">

          {/* الإطار */}
          <section className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">الإطار</h3>
            <label className={labelClass}>اختر الإطار</label>
            <select value={frameId} onChange={e => setFrameId(e.target.value)} className={selectClass}>
              <option value="">— بدون إطار —</option>
              {frames.map(f => (
                <option key={f.id} value={f.id}>
                  {f.brand} {f.model} {f.sku ? `(${f.sku})` : ''}
                </option>
              ))}
            </select>
            {selectedFrame && (
              <p className="mt-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
                السعر: {fmtNum(framePrice)} {currencySymbol}
              </p>
            )}
          </section>

          {/* العدسات */}
          <section className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">العدسات</h3>

            {/* عين يمنى */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <label className="text-sm font-bold text-blue-700 dark:text-blue-400">عين يمنى (OD)</label>
              </div>
              <select value={odLensId} onChange={e => { setOdLensId(e.target.value); setOdVariantId('') }} className={selectClass}>
                <option value="">— بدون عدسة —</option>
                {lenses.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              {selectedODLens && (
                <select value={odVariantId} onChange={e => setOdVariantId(e.target.value)} className={`${selectClass} mt-2 font-mono text-xs`}>
                  <option value="">— اختر الدرجة —</option>
                  {selectedODLens.variants.sort((a, b) => a.sph - b.sph || a.cyl - b.cyl).map(v => (
                    <option key={v.id} value={v.id}>
                      {`SPH ${fmtDeg(v.sph)} / CYL ${fmtDeg(v.cyl)}  —  ${fmtNum(v.price)} ${currencySymbol}  (متاح: ${v.quantity})`}
                    </option>
                  ))}
                </select>
              )}
              {selectedODLens && (
                <p className="mt-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400">
                  السعر: {fmtNum(odPrice)} {currencySymbol}
                </p>
              )}
            </div>

            {/* نفس العدسة للعينين */}
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={sameForBothEyes}
                onChange={e => { setSameForBothEyes(e.target.checked); if (e.target.checked) setOsLensId('') }}
                className="w-4 h-4 rounded accent-blue-700" />
              <span className="text-sm text-slate-600 dark:text-slate-300">نفس العدسة للعينين</span>
            </label>

            {/* عين يسرى */}
            {!sameForBothEyes && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-600"></span>
                  <label className="text-sm font-bold text-green-700 dark:text-green-400">عين يسرى (OS)</label>
                </div>
                <select value={osLensId} onChange={e => { setOsLensId(e.target.value); setOsVariantId('') }} className={selectClass}>
                  <option value="">— بدون عدسة —</option>
                  {lenses.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                {selectedOSLens && (
                  <select value={osVariantId} onChange={e => setOsVariantId(e.target.value)} className={`${selectClass} mt-2 font-mono text-xs`}>
                    <option value="">— اختر الدرجة —</option>
                    {selectedOSLens.variants.sort((a, b) => a.sph - b.sph || a.cyl - b.cyl).map(v => (
                      <option key={v.id} value={v.id}>
                        {`SPH ${fmtDeg(v.sph)} / CYL ${fmtDeg(v.cyl)}  —  ${fmtNum(v.price)} ${currencySymbol}  (متاح: ${v.quantity})`}
                      </option>
                    ))}
                  </select>
                )}
                {selectedOSLens && (
                  <p className="mt-1.5 text-sm font-semibold text-green-700 dark:text-green-400">
                    السعر: {fmtNum(osPrice)} {currencySymbol}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* تفاصيل إضافية */}
          <section className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">تفاصيل إضافية</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>تاريخ التسليم</label>
                <input type="date" value={readyDate} onChange={e => setReadyDate(e.target.value)} dir="ltr" className={selectClass} />
              </div>
              <div>
                <label className={labelClass}>خصم ({currencySymbol})</label>
                <input type="number" min={0} value={discount}
                  onChange={e => setDiscount(Math.max(0, Number(e.target.value)))} className={selectClass} />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelClass}>ملاحظات المختبر</label>
              <textarea value={labNotes} onChange={e => setLabNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </section>

          {/* الدفع */}
          <section className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">الدفع</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>المبلغ المدفوع ({currencySymbol})</label>
                <div className="flex gap-2">
                  <input type="number" min={0} max={total} step="0.01" placeholder="0.00"
                    value={paidNow}
                    onChange={e => setPaidNow(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    className={selectClass} />
                  {total > 0 && (paidNow === '' || (typeof paidNow === 'number' && paidNow < total)) && (
                    <button type="button" onClick={() => setPaidNow(total)}
                      className="shrink-0 px-3 py-2 text-xs font-semibold rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 transition-colors">
                      كامل
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className={labelClass}>طريقة الدفع</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)} className={selectClass}>
                  <option value="cash">نقداً</option>
                  <option value="card">بطاقة</option>
                  <option value="transfer">تحويل</option>
                  <option value="cheque">شيك</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
            </div>
            {typeof paidNow === 'number' && paidNow > 0 && total > 0 && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                متبقي:{' '}
                <span className={paidNow >= total ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-500 font-semibold'}>
                  {fmtNum(Math.max(0, total - paidNow))} {currencySymbol}
                </span>
              </p>
            )}
          </section>

          {/* الملخص */}
          <section className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 p-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">الملخص</h3>
            <div className="space-y-2 text-sm">
              {selectedFrame && (
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>الإطار — {selectedFrame.brand} {selectedFrame.model}</span>
                  <span className="font-medium">{fmtNum(framePrice)} {currencySymbol}</span>
                </div>
              )}
              {selectedODLens && (
                <div className="flex justify-between text-blue-700 dark:text-blue-400">
                  <span>عين يمنى — {selectedODLens.name}{selectedODVariant ? ` (SPH ${fmtDeg(selectedODVariant.sph)})` : ''}</span>
                  <span className="font-medium">{fmtNum(odPrice)} {currencySymbol}</span>
                </div>
              )}
              {(sameForBothEyes ? selectedODLens : selectedOSLens) && (
                <div className="flex justify-between text-green-700 dark:text-green-400">
                  <span>عين يسرى — {sameForBothEyes ? selectedODLens?.name : selectedOSLens?.name}</span>
                  <span className="font-medium">{fmtNum(osPrice)} {currencySymbol}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>خصم</span>
                  <span>- {fmtNum(discount)} {currencySymbol}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base text-slate-900 dark:text-white pt-3 border-t border-blue-200 dark:border-blue-700 mt-2">
                <span>المجموع الكلي</span>
                <span className="text-blue-700 dark:text-blue-400">{fmtNum(total)} {currencySymbol}</span>
              </div>
            </div>
          </section>

          {/* خطأ في الحفظ */}
          {saveError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm">
              <p className="font-semibold mb-1">حدث خطأ</p>
              <p className="font-mono text-xs break-all">{saveError}</p>
            </div>
          )}

          {/* أزرار */}
          <div className="flex gap-3 justify-end pb-2">
            <Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button>
            <Button loading={saving} onClick={handleSave}>تأكيد البيع</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
