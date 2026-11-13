import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../../database/db'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../contexts/ToastContext'
import { useCurrency } from '../../hooks/useCurrency'
import { createSale, confirmSale } from './SalesRepository'
import type { Frame, Lens, Patient } from '../../database/schema'

function PatientSearch({ onSelect }: { onSelect: (p: Patient) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Patient[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      const q = query.trim().toLowerCase()
      const all = await db.patients.filter(p =>
        !p.deletedAt && (
          p.fullName.toLowerCase().includes(q) ||
          (p.phone ?? '').includes(q) ||
          (p.fileNumber ?? '').toLowerCase().includes(q)
        )
      ).limit(8).toArray()
      setResults(all)
      setOpen(true)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        placeholder="ابحث باسم المريض أو رقم الهاتف أو رقم الملف..."
        autoFocus
        className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          {results.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onSelect(p); setQuery(p.fullName); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-start transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {p.fullName.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{p.fullName}</p>
                <p className="text-xs text-slate-400">{p.fileNumber}{p.phone ? ` · ${p.phone}` : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-400 shadow-lg">
          لا توجد نتائج
        </div>
      )}
    </div>
  )
}

function fmtNum(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function GlassesSalePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prePatientId = searchParams.get('patientId')
  const { toast } = useToast()
  const { t } = useTranslation()
  const { symbol: currencySymbol } = useCurrency()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [frames, setFrames] = useState<Frame[]>([])
  const [lenses, setLenses] = useState<Lens[]>([])

  const [frameId, setFrameId] = useState('')
  const [odLensId, setOdLensId] = useState('')
  const [osLensId, setOsLensId] = useState('')
  const [sameForBothEyes, setSameForBothEyes] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [readyDate, setReadyDate] = useState('')
  const [labNotes, setLabNotes] = useState('')
  const [saleDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    db.frames.filter(f => !f.deletedAt && (f.quantity ?? 0) > 0).toArray().then(setFrames)
    db.lenses.filter(l => !l.deletedAt && (l.quantity ?? 0) > 0).toArray().then(setLenses)
    if (prePatientId) {
      db.patients.get(prePatientId).then(p => { if (p) setPatient(p) })
    }
  }, [prePatientId])

  const selectedFrame = frames.find(f => f.id === frameId)
  const selectedOD = lenses.find(l => l.id === odLensId)
  const selectedOS = sameForBothEyes ? selectedOD : lenses.find(l => l.id === osLensId)

  const framePrice = selectedFrame?.sellingPrice ?? 0
  const odPrice = selectedOD?.sellingPrice ?? 0
  const osPrice = sameForBothEyes ? odPrice : (selectedOS?.sellingPrice ?? 0)
  const subtotal = framePrice + odPrice + osPrice
  const total = Math.max(0, subtotal - discount)

  const handleSave = async () => {
    if (!patient) { toast('يجب اختيار المريض', 'error'); return }
    if (!frameId && !odLensId && !osLensId) { toast('يجب اختيار منتج واحد على الأقل', 'error'); return }

    setSaving(true)
    try {
      const items = []
      if (selectedFrame) {
        items.push({
          itemType: 'frame' as const,
          itemId: selectedFrame.id,
          description: `${selectedFrame.brand} ${selectedFrame.model}`,
          quantity: 1,
          unitPrice: framePrice,
          discountAmount: 0,
        })
      }
      if (selectedOD) {
        items.push({
          itemType: 'lens' as const,
          itemId: selectedOD.id,
          description: `${selectedOD.name} — عين يمنى`,
          quantity: 1,
          unitPrice: odPrice,
          discountAmount: 0,
        })
      }
      if (sameForBothEyes && selectedOD) {
        items.push({
          itemType: 'lens' as const,
          itemId: selectedOD.id,
          description: `${selectedOD.name} — عين يسرى`,
          quantity: 1,
          unitPrice: odPrice,
          discountAmount: 0,
        })
      } else if (selectedOS) {
        items.push({
          itemType: 'lens' as const,
          itemId: selectedOS.id,
          description: `${selectedOS.name} — عين يسرى`,
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
      toast('تم إنشاء طلب النظارة بنجاح', 'success')
      navigate(`/sales/${sale.id}`)
    } catch (err) {
      toast(`${t('common.error')}: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const selectClass = "w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelClass = "block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5"

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">🕶 بيع نظارة</h1>
        </div>
      </div>

      <div className="space-y-4">

        {/* المريض */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">المريض</h2>
          {patient ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-700 flex items-center justify-center text-white font-bold shrink-0">
                {patient.fullName.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-900 dark:text-white">{patient.fullName}</p>
                <p className="text-xs text-slate-400">{patient.fileNumber}</p>
              </div>
              <button onClick={() => setPatient(null)}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                تغيير
              </button>
            </div>
          ) : (
            <PatientSearch onSelect={setPatient} />
          )}
        </section>

        {/* الإطار */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">الإطار</h2>
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
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">العدسات</h2>

          {/* عين يمنى */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <label className="text-sm font-bold text-blue-700 dark:text-blue-400">عين يمنى (OD)</label>
            </div>
            <select value={odLensId} onChange={e => setOdLensId(e.target.value)} className={selectClass}>
              <option value="">— بدون عدسة —</option>
              {lenses.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            {selectedOD && (
              <p className="mt-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400">
                السعر: {fmtNum(odPrice)} {currencySymbol}
              </p>
            )}
          </div>

          {/* نفس العدسة للعينين */}
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={sameForBothEyes}
              onChange={e => { setSameForBothEyes(e.target.checked); if (e.target.checked) setOsLensId('') }}
              className="w-4 h-4 rounded accent-blue-700"
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">نفس العدسة للعينين</span>
          </label>

          {/* عين يسرى */}
          {!sameForBothEyes && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-600"></span>
                <label className="text-sm font-bold text-green-700 dark:text-green-400">عين يسرى (OS)</label>
              </div>
              <select value={osLensId} onChange={e => setOsLensId(e.target.value)} className={selectClass}>
                <option value="">— بدون عدسة —</option>
                {lenses.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              {selectedOS && (
                <p className="mt-1.5 text-sm font-semibold text-green-700 dark:text-green-400">
                  السعر: {fmtNum(osPrice)} {currencySymbol}
                </p>
              )}
            </div>
          )}
        </section>

        {/* تفاصيل إضافية */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">تفاصيل إضافية</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>تاريخ التسليم المتوقع</label>
              <input type="date" value={readyDate} onChange={e => setReadyDate(e.target.value)} dir="ltr"
                className={selectClass} />
            </div>
            <div>
              <label className={labelClass}>خصم ({currencySymbol})</label>
              <input type="number" min={0} value={discount}
                onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
                className={selectClass} />
            </div>
          </div>
          <div className="mt-4">
            <label className={labelClass}>ملاحظات المختبر</label>
            <textarea value={labNotes} onChange={e => setLabNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </section>

        {/* الملخص */}
        <section className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">الملخص</h2>
          <div className="space-y-2 text-sm">
            {selectedFrame && (
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>الإطار — {selectedFrame.brand} {selectedFrame.model}</span>
                <span className="font-medium">{fmtNum(framePrice)} {currencySymbol}</span>
              </div>
            )}
            {selectedOD && (
              <div className="flex justify-between text-blue-700 dark:text-blue-400">
                <span>عين يمنى — {selectedOD.name}</span>
                <span className="font-medium">{fmtNum(odPrice)} {currencySymbol}</span>
              </div>
            )}
            {selectedOS && !sameForBothEyes && (
              <div className="flex justify-between text-green-700 dark:text-green-400">
                <span>عين يسرى — {selectedOS.name}</span>
                <span className="font-medium">{fmtNum(osPrice)} {currencySymbol}</span>
              </div>
            )}
            {sameForBothEyes && selectedOD && (
              <div className="flex justify-between text-green-700 dark:text-green-400">
                <span>عين يسرى — {selectedOD.name}</span>
                <span className="font-medium">{fmtNum(odPrice)} {currencySymbol}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>خصم</span>
                <span>- {fmtNum(discount)} {currencySymbol}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-slate-900 dark:text-white pt-3 border-t border-slate-200 dark:border-slate-700 mt-2">
              <span>المجموع الكلي</span>
              <span className="text-blue-700 dark:text-blue-400">{fmtNum(total)} {currencySymbol}</span>
            </div>
          </div>
        </section>

        {/* أزرار */}
        <div className="flex gap-3 justify-end pb-4">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
            إلغاء
          </Button>
          <Button loading={saving} onClick={handleSave}>
            تأكيد البيع
          </Button>
        </div>
      </div>
    </div>
  )
}
