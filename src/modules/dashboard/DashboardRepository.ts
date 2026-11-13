import { db as globalDb, type BarOptDB } from '../../database/db'
import { getSalesDashboardStats, getPendingOrders, type SalesDashboardStats } from '../sales/SalesRepository'
import { getInventoryStats } from '../inventory/InventoryRepository'
import { getTodayPatientCount, getRecentPatients } from '../patients/PatientRepository'
import type { Sale } from '../../database/schema'
import type { Patient } from '../../database/schema'

export interface DashboardSummary {
  sales: SalesDashboardStats
  patientsToday: number
  pendingOrdersCount: number
  pendingOrders: Sale[]
  recentPatients: Patient[]
  lowStockCount: number
  outOfStockCount: number
  totalProducts: number
}

export async function getDashboardSummary(db: BarOptDB = globalDb): Promise<DashboardSummary> {
  const [sales, invStats, patientsToday, pendingOrders, recentPatients] = await Promise.all([
    getSalesDashboardStats(db),
    getInventoryStats(db),
    getTodayPatientCount(db),
    getPendingOrders(db),
    getRecentPatients(5, db),
  ])

  return {
    sales,
    patientsToday,
    pendingOrdersCount: pendingOrders.length,
    pendingOrders: pendingOrders.slice(0, 6),
    recentPatients,
    lowStockCount: invStats.lowStockCount,
    outOfStockCount: invStats.outOfStockCount,
    totalProducts: invStats.totalFrameProducts + invStats.totalLensProducts,
  }
}

// Last 7 days revenue for the sparkline chart
export interface DayRevenue {
  date: string   // YYYY-MM-DD
  revenue: number
}

export async function getLast7DaysRevenue(db: BarOptDB = globalDb): Promise<DayRevenue[]> {
  const days: DayRevenue[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({ date: d.toISOString().slice(0, 10), revenue: 0 })
  }

  const dateSet = new Set(days.map(d => d.date))
  const sales = await db.sales
    .filter(s => !s.deletedAt && s.status !== 'cancelled' && dateSet.has(s.saleDate))
    .toArray()

  for (const sale of sales) {
    const day = days.find(d => d.date === sale.saleDate)
    if (day) day.revenue = Math.round((day.revenue + sale.total) * 100) / 100
  }

  return days
}
