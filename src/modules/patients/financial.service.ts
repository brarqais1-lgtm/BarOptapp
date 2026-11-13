/**
 * PatientFinancialSummary
 *
 * Calculates financial totals from real IndexedDB records.
 * Returns zeros when sales/payments tables are empty.
 * Never fabricates or stores computed totals as a source of truth.
 */

import { db as globalDb, type BarOptDB } from '../../database/db'

export interface PatientFinancialSummary {
  totalSalesAmount: number      // sum of sale.total for non-cancelled sales
  totalDiscounts: number        // sum of sale.discountAmount
  totalPaid: number             // sum of payments for this patient's sales
  totalBalance: number          // totalSalesAmount - totalPaid
  purchaseCount: number         // count of non-cancelled sales
  lastPurchaseDate?: string     // ISO-8601 of latest sale
}

export async function getPatientFinancialSummary(
  patientId: string,
  db: BarOptDB = globalDb,
): Promise<PatientFinancialSummary> {
  // Load sales for this patient (non-cancelled, non-deleted)
  const sales = await db.sales
    .where('patientId')
    .equals(patientId)
    .filter(s => s.status !== 'cancelled' && !s.deletedAt)
    .toArray()

  if (sales.length === 0) {
    return {
      totalSalesAmount: 0, totalDiscounts: 0,
      totalPaid: 0, totalBalance: 0, purchaseCount: 0,
    }
  }

  const saleIds = sales.map(s => s.id)
  const totalSalesAmount = sales.reduce((sum, s) => sum + s.total, 0)
  const totalDiscounts = sales.reduce((sum, s) => sum + s.discountAmount, 0)
  const lastPurchaseDate = sales
    .map(s => s.createdAt)
    .sort((a, b) => b.localeCompare(a))[0]

  // Load payments for these sales (non-deleted)
  const payments = await db.payments
    .where('saleId')
    .anyOf(saleIds)
    .filter(p => !p.deletedAt)
    .toArray()

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const totalBalance = totalSalesAmount - totalPaid

  return {
    totalSalesAmount,
    totalDiscounts,
    totalPaid,
    totalBalance,
    purchaseCount: sales.length,
    lastPurchaseDate,
  }
}
