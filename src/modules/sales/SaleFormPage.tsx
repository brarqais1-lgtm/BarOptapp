import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import type { Prescription } from '../../database/schema'
import {
  SaleFormSchema, SaleItemFormSchema,
  type SaleFormValues, type SaleItemFormValues,
} from './sales.schema'
import { createSale, updateSaleDraft, getSaleById, getSaleItems } from './SalesRepository'

function fmt(n: number | undefined): string {
  if (n == null) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2)
}

function PrescriptionCard({ rx }: { rx: Prescription }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 text-sm font-mono">
      <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2 font-sans">
        {rx.prescriptionNumber} — {rx.prescriptionDate}
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <div>
          <span className="text-xs text-gray-500 font-sans">{t('prescriptions.rightEye')} (OD)</span>
          <p>SPH {fmt(rx.reSphere)} / CYL {fmt(rx.reCylinder)} / AXIS {rx.reAxis ?? '—'}°</p>
          {rx.reAdd != null && <p>ADD {fmt(rx.reAdd)}</p>}
        </div>
        <div>
          <span className="text-xs text-gray-500 font-sans">{t('prescriptions.leftEye')} (OS)</span>
          <p>SPH {fmt(rx.leSphere)} / CYL {fmt(rx.leCylinder)} / AXIS {rx.leAxis ?? '—'}°</p>
          {rx.leAdd != null && <p>ADD {fmt(rx.leAdd)}</p>}
        </div>
      </div>
      {(rx.pdDistance || rx.rePd || rx.lePd) && (
        <p className="mt-1 text-gray-600 dark:text-gray-400 font-sans text-xs">
          PD: {rx.pdDistance ? `${rx.pdDistance}mm` : `${rx.rePd ?? '—'}/${rx.lePd ?? '—'}mm`}
        </p>
      )}
    </div>
  )
}

type ItemType = 'frame' | 'lens' | 'service'

interface ItemRow extends SaleItemFormValues {
  _key: number
}

let _keySeq = 0

function emptyItem(): ItemRow {
  return {
    _key: ++_keySeq,
    itemType: 'frame',
    itemId: undefined,
    description: '',
    quantity: 1,
    unitPrice: 0,
    discountAmount: 0,
  }
}

function r2(n: number) { return Math.round(n * 100) / 100 }

export default function SaleFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const prePatientId = searchParams.get('patientId') ?? undefined
  const isEdit = Boolean(id)

  const [form, setForm] = useState<Partial<SaleFormValues>>({
    saleDate: new Date().toISOString().slice(0, 10),
    discountAmount: 0,
    discountPercent: 0,
    readyDate: '',
    labNotes: '',
    patientId: prePatientId,
  })
  const [items, setItems] = useState<ItemRow[]>([emptyItem()])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [itemErrors, setItemErrors] = useState<Record<number, Record<string, string>>>({})
  const [saving, setSaving] = useState(false)
  const [customerMode, setCustomerMode] = useState<'patient' | 'walkin'>('patient')

  const frames = useLiveQuery(() => db.frames.filter(f => !f.deletedAt).toArray(), [])
  const lenses = useLiveQuery(() => db.lenses.filter(l => !l.deletedAt).toArray(), [])
  const patients = useLiveQuery(() => db.patients.filter(p => !p.deletedAt).toArray(), [])

  const patientPrescriptions = useLiveQuery(async () => {
    if (!form.patientId) return []
    const all = await db.prescriptions
      .where('patientId').equals(form.patientId)
      .filter(rx => !rx.deletedAt)
      .toArray()
    return all.sort((a, b) => b.prescriptionDate.localeCompare(a.prescriptionDate))
  }, [form.patientId])

  const selectedRx = patientPrescriptions?.find(rx => rx.id === form.prescriptionId)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const sale = await getSaleById(id)
      if (!sale) return
      setCustomerMode(sale.patientId ? 'patient' : 'walkin')
      setForm({
        patientId: sale.patientId,
        walkInName: sale.walkInName,
        prescriptionId: sale.prescriptionId,
        saleDate: sale.saleDate,
        readyDate: sale.readyDate ?? '',
        labNotes: sale.labNotes ?? '',
        discountAmount: sale.discountAmount,
        discountPercent: sale.discountPercent,
        notes: sale.notes,
      })
      const saleItems = await getSaleItems(id)
      setItems(saleItems.map(i => ({
        _key: ++_keySeq,
        itemType: i.itemType,
        itemId: i.itemId,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountAmount: i.discountAmount,
      })))
    })()
  }, [id])

  function setField<K extends keyof SaleFormValues>(key: K, value: SaleFormValues[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function setItemField(key: number, field: keyof SaleItemFormValues, value: unknown) {
    setItems(prev => prev.map(item => {
      if (item._key !== key) return item
      const updated = { ...item, [field]: value }
      if (field === 'itemId' && value) {
        const type = item.itemType
        const product = type === 'frame'
          ? frames?.find(f => f.id === value)
          : lenses?.find(l => l.id === value)
        if (product) {
          return {
            ...updated,
            description: product.name ?? `${product.brand} ${product.model ?? ''}`.trim(),
            unitPrice: product.sellingPrice ?? 0,
          }
        }
      }
      return updated
    }))
  }

  function addItem() { setItems(prev => [...prev, emptyItem()]) }
  function removeItem(key: number) { setItems(prev => prev.filter(i => i._key !== key)) }

  function computeTotals() {
    const itemsSubtotal = r2(items.reduce((s, i) =>
      s + r2((i.quantity || 0) * (i.unitPrice || 0) - (i.discountAmount || 0)), 0))
    const pct = r2(itemsSubtotal * ((form.discountPercent || 0) / 100))
    const disc = r2((form.discountAmount || 0) + pct)
    const total = r2(Math.max(0, itemsSubtotal - disc))
    return { itemsSubtotal, disc, total }
  }

  async function handleSave() {
    const headerParsed = SaleFormSchema.safeParse(form)
    if (!headerParsed.success) {
      const errs: Record<string, string> = {}
      headerParsed.error.issues.forEach(e => {
        if (e.path.length) errs[String(e.path[0])] = e.message
      })
      setErrors(errs)
      return
    }

    const parsedItems: SaleItemFormValues[] = []
    const iErrs: Record<number, Record<string, string>> = {}
    let hasItemError = false
    for (const item of items) {
      const r = SaleItemFormSchema.safeParse(item)
      if (!r.success) {
        hasItemError = true
        const errs: Record<string, string> = {}
        r.error.issues.forEach(e => { if (e.path.length) errs[String(e.path[0])] = e.message })
        iErrs[item._key] = errs
      } else {
        parsedItems.push(r.data)
      }
    }
    if (hasItemError) { setItemErrors(iErrs); return }
    if (parsedItems.length === 0) { setErrors({ items: t('sales.errors.noItems') }); return }

    setErrors({})
    setItemErrors({})
    setSaving(true)
    try {
      if (isEdit && id) {
        await updateSaleDraft(id, headerParsed.data, parsedItems)
        navigate(`/sales/${id}`)
      } else {
        const sale = await createSale(headerParsed.data, parsedItems)
        navigate(`/sales/${sale.id}`)
      }
    } catch (err) {
      setErrors({ submit: String(err) })
    } finally {
      setSaving(false)
    }
  }

  const { itemsSubtotal, disc, total } = computeTotals()

  return (
    <div className="p-4 space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← {t('common.back')}</Button>
        <h1 className="text-xl font-semibold">
          {isEdit ? t('sales.editInvoice') : t('sales.newInvoice')}
        </h1>
      </div>

      {errors.submit && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg px-4 py-3 text-sm">
          {errors.submit}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h2 className="font-medium">{t('sales.customerInfo')}</h2>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="cmode" checked={customerMode === 'patient'}
              onChange={() => setCustomerMode('patient')} />
            {t('sales.patient')}
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="cmode" checked={customerMode === 'walkin'}
              onChange={() => setCustomerMode('walkin')} />
            {t('sales.walkInCustomer')}
          </label>
        </div>

        {customerMode === 'patient' ? (
          <>
            <FormField label={t('sales.patient')} error={errors.patientId}>
              <select className="form-input w-full"
                value={form.patientId ?? ''}
                onChange={e => {
                  setField('patientId', e.target.value || undefined)
                  setField('prescriptionId', undefined)
                }}>
                <option value="">{t('common.select')}</option>
                {patients?.map(p => (
                  <option key={p.id} value={p.id}>{p.fullName} — {p.fileNumber}</option>
                ))}
              </select>
            </FormField>

            {form.patientId && patientPrescriptions && patientPrescriptions.length > 0 && (
              <FormField label={t('sales.prescriptionRef')}>
                <select className="form-input w-full"
                  value={form.prescriptionId ?? ''}
                  onChange={e => setField('prescriptionId', e.target.value || undefined)}>
                  <option value="">{t('sales.noPrescription')}</option>
                  {patientPrescriptions.map(rx => (
                    <option key={rx.id} value={rx.id}>
                      {rx.prescriptionNumber} — {rx.prescriptionDate}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {selectedRx && <PrescriptionCard rx={selectedRx} />}
          </>
        ) : (
          <FormField label={t('sales.walkInName')} error={errors.walkInName}>
            <input className="form-input w-full"
              value={form.walkInName ?? ''}
              onChange={e => setField('walkInName', e.target.value)} />
          </FormField>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label={t('sales.date')} error={errors.saleDate}>
            <input type="date" className="form-input w-full"
              value={form.saleDate ?? ''}
              onChange={e => setField('saleDate', e.target.value)} />
          </FormField>

          <FormField label={t('sales.readyDate')}>
            <input type="date" className="form-input w-full"
              value={form.readyDate ?? ''}
              onChange={e => setField('readyDate', e.target.value)} />
          </FormField>

          <FormField label={t('common.notes')} error={errors.notes}>
            <input className="form-input w-full"
              value={form.notes ?? ''}
              onChange={e => setField('notes', e.target.value)} />
          </FormField>
        </div>

        <FormField label={t('sales.labNotes')}>
          <textarea className="form-input w-full" rows={2}
            value={form.labNotes ?? ''}
            onChange={e => setField('labNotes', e.target.value)} />
        </FormField>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{t('sales.items')}</h2>
          <Button size="sm" variant="secondary" onClick={addItem}>{t('sales.addItem')}</Button>
        </div>

        {errors.items && <p className="text-sm text-red-600">{errors.items}</p>}

        {items.map((item) => {
          const iErr = itemErrors[item._key] ?? {}
          return (
            <div key={item._key} className="rounded-lg border border-gray-100 dark:border-gray-700 p-3 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-gray-500">{t('sales.itemType')}</label>
                  <select className="form-input w-full text-sm mt-0.5"
                    value={item.itemType}
                    onChange={e => setItemField(item._key, 'itemType', e.target.value as ItemType)}>
                    <option value="frame">{t('sales.frame')}</option>
                    <option value="lens">{t('sales.lens')}</option>
                    <option value="service">{t('sales.service')}</option>
                  </select>
                </div>

                {item.itemType !== 'service' && (
                  <div>
                    <label className="text-xs text-gray-500">{t('sales.product')}</label>
                    <select className="form-input w-full text-sm mt-0.5"
                      value={item.itemId ?? ''}
                      onChange={e => setItemField(item._key, 'itemId', e.target.value || undefined)}>
                      <option value="">{t('common.select')}</option>
                      {(item.itemType === 'frame' ? frames : lenses)?.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name ?? `${p.brand} ${p.model ?? ''}`.trim()} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="col-span-2 md:col-span-1">
                  <label className="text-xs text-gray-500">{t('sales.description')}</label>
                  <input className={`form-input w-full text-sm mt-0.5 ${iErr.description ? 'border-red-400' : ''}`}
                    value={item.description}
                    onChange={e => setItemField(item._key, 'description', e.target.value)} />
                  {iErr.description && <p className="text-xs text-red-500">{iErr.description}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 items-end">
                <div>
                  <label className="text-xs text-gray-500">{t('sales.qty')}</label>
                  <input type="number" min="1" className={`form-input w-full text-sm mt-0.5 ${iErr.quantity ? 'border-red-400' : ''}`}
                    value={item.quantity}
                    onChange={e => setItemField(item._key, 'quantity', Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('sales.unitPrice')}</label>
                  <input type="number" min="0" step="0.01" className={`form-input w-full text-sm mt-0.5 ${iErr.unitPrice ? 'border-red-400' : ''}`}
                    value={item.unitPrice}
                    onChange={e => setItemField(item._key, 'unitPrice', Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t('sales.itemDiscount')}</label>
                  <input type="number" min="0" step="0.01" className="form-input w-full text-sm mt-0.5"
                    value={item.discountAmount}
                    onChange={e => setItemField(item._key, 'discountAmount', Number(e.target.value))} />
                </div>
                <div className="col-span-2 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{t('sales.lineTotal')}</p>
                    <p className="text-sm font-medium">
                      {r2(item.quantity * item.unitPrice - item.discountAmount).toFixed(2)}
                    </p>
                  </div>
                  {items.length > 1 && (
                    <Button size="sm" variant="danger" onClick={() => removeItem(item._key)}>✕</Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="font-medium mb-3">{t('sales.totals')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <FormField label={t('sales.orderDiscountAmount')}>
              <input type="number" min="0" step="0.01" className="form-input w-full"
                value={form.discountAmount ?? 0}
                onChange={e => setField('discountAmount', Number(e.target.value))} />
            </FormField>
            <FormField label={t('sales.discountPercent')}>
              <input type="number" min="0" max="100" step="0.1" className="form-input w-full"
                value={form.discountPercent ?? 0}
                onChange={e => setField('discountPercent', Number(e.target.value))} />
            </FormField>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('sales.subtotal')}</span>
              <span>{itemsSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('sales.discount')}</span>
              <span>-{disc.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base border-t pt-2 dark:border-gray-700">
              <span>{t('sales.total')}</span>
              <span>{total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
        <Button loading={saving} onClick={handleSave}>{t('common.save')}</Button>
      </div>
    </div>
  )
}
