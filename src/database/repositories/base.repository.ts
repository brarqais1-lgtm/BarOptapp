import { type Table } from 'dexie'
import { v4 as uuidv4 } from 'uuid'
import type { BaseRecord } from '../schema'

export type CreateInput<T extends BaseRecord> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type UpdateInput<T extends BaseRecord> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>

export class BaseRepository<T extends BaseRecord> {
  protected table: Table<T>
  constructor(table: Table<T>) { this.table = table }

  async create(data: CreateInput<T>): Promise<T> {
    const now = new Date().toISOString()
    const record = {
      ...data,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    } as T
    await this.table.add(record)
    return record
  }

  async findById(id: string): Promise<T | undefined> {
    return this.table.get(id)
  }

  async findAll(includeDeleted = false): Promise<T[]> {
    if (includeDeleted) return this.table.toArray()
    return this.table.filter(r => !r.deletedAt).toArray()
  }

  async update(id: string, data: UpdateInput<T>): Promise<T> {
    const existing = await this.table.get(id)
    if (!existing) throw new Error(`Record ${id} not found`)
    const updated = {
      ...existing,
      ...data,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    } as T
    await this.table.put(updated)
    return updated
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.table.get(id)
    if (!existing) throw new Error(`Record ${id} not found`)
    await this.table.put({
      ...existing,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as T)
  }

  async restore(id: string): Promise<void> {
    const existing = await this.table.get(id)
    if (!existing) throw new Error(`Record ${id} not found`)
    const { deletedAt: _d, ...rest } = existing as T & { deletedAt?: string }
    await this.table.put({
      ...rest,
      updatedAt: new Date().toISOString(),
    } as T)
  }

  async hardDelete(id: string): Promise<void> {
    await this.table.delete(id)
  }

  async count(includeDeleted = false): Promise<number> {
    if (includeDeleted) return this.table.count()
    return this.table.filter(r => !r.deletedAt).count()
  }
}
