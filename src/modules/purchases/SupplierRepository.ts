import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../../database/db'
import type { Supplier } from '../../database/schema'
import type { SupplierFormValues } from './purchases.schema'

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createSupplier(
  data: SupplierFormValues,
  db: BarOptDB = globalDb,
): Promise<Supplier> {
  const now = new Date().toISOString()
  const supplier: Supplier = {
    id: uuidv4(),
    name: data.name,
    contactName: data.contactName || undefined,
    phone: data.phone || undefined,
    email: data.email || undefined,
    address: data.address || undefined,
    taxNumber: data.taxNumber || undefined,
    paymentTerms: data.paymentTerms || undefined,
    notes: data.notes || undefined,
    createdAt: now,
    updatedAt: now,
  }
  await db.suppliers.add(supplier)
  return supplier
}

export async function updateSupplier(
  id: string,
  data: SupplierFormValues,
  db: BarOptDB = globalDb,
): Promise<Supplier> {
  const now = new Date().toISOString()
  const patch: Partial<Supplier> = {
    name: data.name,
    contactName: data.contactName || undefined,
    phone: data.phone || undefined,
    email: data.email || undefined,
    address: data.address || undefined,
    taxNumber: data.taxNumber || undefined,
    paymentTerms: data.paymentTerms || undefined,
    notes: data.notes || undefined,
    updatedAt: now,
  }
  await db.suppliers.update(id, patch)
  const updated = await db.suppliers.get(id)
  if (!updated) throw new Error('Supplier not found')
  return updated
}

export async function getSupplierById(
  id: string,
  db: BarOptDB = globalDb,
): Promise<Supplier | undefined> {
  return db.suppliers.get(id)
}

export async function searchSuppliers(
  query?: string,
  includeArchived = false,
  db: BarOptDB = globalDb,
): Promise<Supplier[]> {
  let all = await db.suppliers.toArray()
  if (!includeArchived) all = all.filter(s => !s.deletedAt)
  if (query) {
    const q = query.toLowerCase()
    all = all.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.contactName ?? '').toLowerCase().includes(q) ||
      (s.phone ?? '').includes(q) ||
      (s.email ?? '').toLowerCase().includes(q)
    )
  }
  return all.sort((a, b) => a.name.localeCompare(b.name))
}

export async function archiveSupplier(id: string, db: BarOptDB = globalDb): Promise<void> {
  await db.suppliers.update(id, { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
}

export async function restoreSupplier(id: string, db: BarOptDB = globalDb): Promise<void> {
  await db.suppliers.update(id, { deletedAt: undefined, updatedAt: new Date().toISOString() })
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface SupplierStats {
  totalOrders: number
  totalReceived: number
  totalValue: number
  lastOrderDate?: string
}

export async function getSupplierStats(
  supplierId: string,
  db: BarOptDB = globalDb,
): Promise<SupplierStats> {
  const purchases = await db.purchases
    .where('supplierId').equals(supplierId)
    .filter(p => !p.deletedAt)
    .toArray()
  const received = purchases.filter(p => p.status === 'received' || p.status === 'partial')
  const totalValue = received.reduce((s, p) => s + (p.total ?? 0), 0)
  const sorted = [...purchases].sort((a, b) => (b.purchaseDate ?? b.createdAt).localeCompare(a.purchaseDate ?? a.createdAt))
  return {
    totalOrders: purchases.length,
    totalReceived: received.length,
    totalValue: Math.round(totalValue * 100) / 100,
    lastOrderDate: sorted[0]?.purchaseDate ?? sorted[0]?.createdAt,
  }
}
