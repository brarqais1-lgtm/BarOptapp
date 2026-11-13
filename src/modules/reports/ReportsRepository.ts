import { db as globalDb, type BarOptDB } from '../../database/db'

const r2 = (n: number) => Math.round(n * 100) / 100

// ── Profit & Loss ─────────────────────────────────────────────────────────────

export interface ProfitLossReport {
  fromDate: string
  toDate: string
  // Revenue
  grossRevenue: number          // sum of sale.total (non-cancelled)
  totalReturns: number          // sum of return refunds
  netRevenue: number            // grossRevenue - totalReturns
  // Cost of Goods Sold
  cogs: number                  // sum of received purchase totals in period
  grossProfit: number           // netRevenue - cogs
  grossMarginPct: number        // grossProfit / netRevenue * 100
  // Operating Expenses
  expensesByCategory: Record<string, number>
  totalExpenses: number
  // Bottom line
  netProfit: number             // grossProfit - totalExpenses
  netMarginPct: number          // netProfit / netRevenue * 100
  // Counts
  invoiceCount: number
  returnCount: number
  expenseCount: number
}

export async function getProfitLossReport(
  fromDate: string,
  toDate: string,
  db: BarOptDB = globalDb,
): Promise<ProfitLossReport> {
  const [sales, allReturns, purchases, expenses] = await Promise.all([
    db.sales.filter(s => !s.deletedAt && s.status !== 'cancelled' && s.saleDate >= fromDate && s.saleDate <= toDate).toArray(),
    db.saleReturns.toArray(),
    db.purchases.filter(p => !p.deletedAt && (p.status === 'received' || p.status === 'partial')).toArray(),
    db.expenses.filter(e => !e.deletedAt && e.paidAt >= fromDate && e.paidAt <= toDate).toArray(),
  ])

  const saleIds = new Set(sales.map(s => s.id))
  const returns = allReturns.filter(r => saleIds.has(r.saleId))

  const grossRevenue = r2(sales.reduce((s, x) => s + x.total, 0))
  const totalReturns = r2(returns.reduce((s, r) => s + r.totalRefund, 0))
  const netRevenue = r2(grossRevenue - totalReturns)

  // COGS: purchases received/partial with purchaseDate in period
  const periodPurchases = purchases.filter(p => {
    const d = p.purchaseDate ?? p.createdAt?.slice(0, 10) ?? ''
    return d >= fromDate && d <= toDate
  })
  const cogs = r2(periodPurchases.reduce((s, p) => s + p.total, 0))
  const grossProfit = r2(netRevenue - cogs)
  const grossMarginPct = netRevenue > 0 ? r2((grossProfit / netRevenue) * 100) : 0

  const expensesByCategory: Record<string, number> = {}
  for (const e of expenses) {
    expensesByCategory[e.category] = r2((expensesByCategory[e.category] ?? 0) + e.amount)
  }
  const totalExpenses = r2(expenses.reduce((s, e) => s + e.amount, 0))
  const netProfit = r2(grossProfit - totalExpenses)
  const netMarginPct = netRevenue > 0 ? r2((netProfit / netRevenue) * 100) : 0

  return {
    fromDate, toDate,
    grossRevenue, totalReturns, netRevenue,
    cogs, grossProfit, grossMarginPct,
    expensesByCategory, totalExpenses,
    netProfit, netMarginPct,
    invoiceCount: sales.length,
    returnCount: returns.length,
    expenseCount: expenses.length,
  }
}

// ── Sales Summary ─────────────────────────────────────────────────────────────

export interface SalesSummaryRow {
  period: string        // YYYY-MM
  invoiceCount: number
  grossRevenue: number
  returnedAmount: number
  netRevenue: number
  collected: number
  outstanding: number
}

export async function getMonthlySalesSummary(
  year: number,
  db: BarOptDB = globalDb,
): Promise<SalesSummaryRow[]> {
  const yearStr = String(year)
  const sales = await db.sales
    .filter(s => !s.deletedAt && s.status !== 'cancelled' && s.saleDate.startsWith(yearStr))
    .toArray()
  const allReturns = await db.saleReturns.toArray()
  const returnsBySale = new Map<string, number>()
  for (const ret of allReturns) {
    returnsBySale.set(ret.saleId, r2((returnsBySale.get(ret.saleId) ?? 0) + ret.totalRefund))
  }

  const monthMap = new Map<string, SalesSummaryRow>()
  for (let m = 1; m <= 12; m++) {
    const period = `${yearStr}-${String(m).padStart(2, '0')}`
    monthMap.set(period, {
      period, invoiceCount: 0,
      grossRevenue: 0, returnedAmount: 0, netRevenue: 0,
      collected: 0, outstanding: 0,
    })
  }

  for (const s of sales) {
    const period = s.saleDate.slice(0, 7)
    const row = monthMap.get(period)
    if (!row) continue
    const returned = returnsBySale.get(s.id) ?? 0
    row.invoiceCount++
    row.grossRevenue = r2(row.grossRevenue + s.total)
    row.returnedAmount = r2(row.returnedAmount + returned)
    row.netRevenue = r2(row.netRevenue + s.total - returned)
    row.collected = r2(row.collected + s.paidAmount)
    row.outstanding = r2(row.outstanding + s.balanceDue)
  }

  return Array.from(monthMap.values())
}

// ── Inventory Valuation ───────────────────────────────────────────────────────

export interface InventoryValuationRow {
  productType: 'frame' | 'lens'
  productId: string
  name: string
  sku: string
  quantity: number
  costPrice: number
  sellingPrice: number
  totalCostValue: number
  totalSellingValue: number
}

export interface InventoryValuationSummary {
  rows: InventoryValuationRow[]
  totalCostValue: number
  totalSellingValue: number
  potentialProfit: number
  frameCount: number
  lensCount: number
  totalUnits: number
}

export async function getInventoryValuation(db: BarOptDB = globalDb): Promise<InventoryValuationSummary> {
  const [frames, lenses] = await Promise.all([
    db.frames.filter(f => !f.deletedAt && (f.quantity ?? 0) > 0).toArray(),
    db.lenses.filter(l => !l.deletedAt && (l.quantity ?? 0) > 0).toArray(),
  ])

  const rows: InventoryValuationRow[] = [
    ...frames.map(f => ({
      productType: 'frame' as const,
      productId: f.id,
      name: f.name ?? [f.brand, f.model].filter(Boolean).join(' '),
      sku: f.sku,
      quantity: f.quantity ?? 0,
      costPrice: f.costPrice ?? 0,
      sellingPrice: f.sellingPrice ?? 0,
      totalCostValue: r2((f.quantity ?? 0) * (f.costPrice ?? 0)),
      totalSellingValue: r2((f.quantity ?? 0) * (f.sellingPrice ?? 0)),
    })),
    ...lenses.map(l => ({
      productType: 'lens' as const,
      productId: l.id,
      name: l.name ?? [l.brand, l.lensType].filter(Boolean).join(' '),
      sku: l.sku,
      quantity: l.quantity ?? 0,
      costPrice: l.costPrice ?? 0,
      sellingPrice: l.sellingPrice ?? 0,
      totalCostValue: r2((l.quantity ?? 0) * (l.costPrice ?? 0)),
      totalSellingValue: r2((l.quantity ?? 0) * (l.sellingPrice ?? 0)),
    })),
  ].sort((a, b) => b.totalCostValue - a.totalCostValue)

  const totalCostValue = r2(rows.reduce((s, r) => s + r.totalCostValue, 0))
  const totalSellingValue = r2(rows.reduce((s, r) => s + r.totalSellingValue, 0))

  return {
    rows,
    totalCostValue,
    totalSellingValue,
    potentialProfit: r2(totalSellingValue - totalCostValue),
    frameCount: frames.length,
    lensCount: lenses.length,
    totalUnits: rows.reduce((s, r) => s + r.quantity, 0),
  }
}
