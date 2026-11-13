import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../../database/db'
import {
  createExpense, updateExpense, getExpenseById, EXPENSE_CATEGORIES,
  type ExpenseFormValues,
} from './ExpenseRepository'

function today() { return new Date().toISOString().slice(0, 10) }

export default function ExpenseFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [category, setCategory] = useState('other')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(today())
  const [paymentMethod, setPaymentMethod] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!id) return
    getExpenseById(id, db).then(e => {
      if (!e) return
      setCategory(e.category)
      setDescription(e.description)
      setAmount(String(e.amount))
      setPaidAt(e.paidAt)
      setPaymentMethod(e.paymentMethod ?? '')
      setReceiptNumber(e.receiptNumber ?? '')
      setNotes(e.notes ?? '')
    })
  }, [id])

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!description.trim()) errs.description = t('common.required')
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) errs.amount = t('expenses.errors.invalidAmount')
    if (!paidAt) errs.paidAt = t('common.required')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    const values: ExpenseFormValues = {
      category,
      description: description.trim(),
      amount: parseFloat(amount),
      paidAt,
      paymentMethod: paymentMethod as ExpenseFormValues['paymentMethod'] || undefined,
      receiptNumber: receiptNumber.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    try {
      if (isEdit && id) {
        await updateExpense(id, values, db)
      } else {
        await createExpense(values, db)
      }
      navigate('/expenses')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/expenses')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-lg">←</button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {isEdit ? t('expenses.edit') : t('expenses.new')}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('expenses.category')}
          </label>
          <select
            className="form-input"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{t(`expenses.categories.${cat}`)}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('expenses.description')} <span className="text-red-500">*</span>
          </label>
          <input
            className={`form-input ${errors.description ? 'border-red-400' : ''}`}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('expenses.descriptionPlaceholder')}
          />
          {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
        </div>

        {/* Amount + Date row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('expenses.amount')} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={`form-input ${errors.amount ? 'border-red-400' : ''}`}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              dir="ltr"
            />
            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('expenses.date')} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className={`form-input ${errors.paidAt ? 'border-red-400' : ''}`}
              value={paidAt}
              onChange={e => setPaidAt(e.target.value)}
            />
          </div>
        </div>

        {/* Payment Method + Receipt row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('expenses.paymentMethod')}
            </label>
            <select
              className="form-input"
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
            >
              <option value="">{t('common.select')}</option>
              {(['cash', 'card', 'transfer', 'cheque', 'other'] as const).map(m => (
                <option key={m} value={m}>{t(`sales.payment.methods.${m}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('expenses.receiptNumber')}
            </label>
            <input
              className="form-input"
              value={receiptNumber}
              onChange={e => setReceiptNumber(e.target.value)}
              placeholder={t('expenses.receiptPlaceholder')}
              dir="ltr"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('common.notes')}
          </label>
          <textarea
            className="form-input min-h-[72px] resize-none"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
