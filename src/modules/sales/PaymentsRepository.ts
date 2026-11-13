import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { Payment } from '../../database/schema'
import type { PaymentFormValues } from './sales.schema'

function r2(n: number): number { return Math.round(n * 100) / 100 }

function derivePaymentStatus(paid: number, total: number): 'unpaid' | 'partial' | 'paid' {
  if (paid <= 0) return 'unpaid'
  if (paid >= total) return 'paid'
  return 'partial'
}

export async function addPayment(
  saleId: string,
  data: PaymentFormValues,
  db: BarOptDB = globalDb,
): Promise<Payment> {
  return db.transaction('rw', [db.sales, db.payments], async () => {
    const sale = await db.sales.get(saleId)
    if (!sale) throw new Error('Sale not found')
    if (sale.status === 'cancelled') throw new Error('Cannot add payment to a cancelled sale')
    if (sale.status === 'draft') throw new Error('Confirm the sale before accepting payment')

    const remaining = r2(sale.total - sale.paidAmount)
    if (data.amount > remaining + 0.001) {
      throw new Error(`Payment amount (${data.amount}) exceeds remaining balance (${remaining.toFixed(2)})`)
    }

    const now = new Date().toISOString()
    const payment: Payment = {
      id: uuidv4(),
      saleId,
      amount: r2(data.amount),
      method: data.method,
      reference: data.reference || undefined,
      paidAt: data.paidAt,
      notes: data.notes || undefined,
      createdAt: now,
      updatedAt: now,
    }
    await db.payments.add(payment)

    const newPaid = r2(sale.paidAmount + payment.amount)
    const newBalance = r2(sale.total - newPaid)
    await db.sales.update(saleId, {
      paidAmount: newPaid,
      balanceDue: newBalance,
      paymentStatus: derivePaymentStatus(newPaid, sale.total),
      updatedAt: now,
    })

    return payment
  })
}

export async function getPayments(saleId: string, db: BarOptDB = globalDb): Promise<Payment[]> {
  // Returns ALL payment records (active + voided) sorted by paidAt so the full audit trail is visible.
  // Voided payments have deletedAt set; callers can inspect that field.
  const all = await db.payments.where('saleId').equals(saleId).toArray()
  return all.sort((a, b) => a.paidAt.localeCompare(b.paidAt))
}

export async function deletePayment(paymentId: string, db: BarOptDB = globalDb): Promise<void> {
  return db.transaction('rw', [db.sales, db.payments], async () => {
    const payment = await db.payments.get(paymentId)
    if (!payment) throw new Error('Payment not found')

    const sale = await db.sales.get(payment.saleId)
    if (!sale) throw new Error('Sale not found')
    if (sale.status === 'cancelled') throw new Error('Cannot remove payment from a cancelled sale')

    const now = new Date().toISOString()
    await db.payments.update(paymentId, { deletedAt: now, updatedAt: now })

    const newPaid = r2(Math.max(0, sale.paidAmount - payment.amount))
    const newBalance = r2(sale.total - newPaid)
    await db.sales.update(payment.saleId, {
      paidAmount: newPaid,
      balanceDue: newBalance,
      paymentStatus: derivePaymentStatus(newPaid, sale.total),
      updatedAt: now,
    })
  })
}
