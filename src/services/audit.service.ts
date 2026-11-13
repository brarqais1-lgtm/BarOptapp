import { v4 as uuidv4 } from 'uuid'
import { db as globalDb, type BarOptDB } from '../database/db'
import type { AuditAction } from '../database/schema'

export async function logAudit(opts: {
  action: AuditAction
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
  performedBy?: string
  db?: BarOptDB
}): Promise<void> {
  const database = opts.db ?? globalDb
  const now = new Date().toISOString()
  await database.auditLogs.add({
    id: uuidv4(),
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    before: opts.before ? JSON.stringify(opts.before) : undefined,
    after: opts.after ? JSON.stringify(opts.after) : undefined,
    performedBy: opts.performedBy,
    createdAt: now,
    updatedAt: now,
  })
}
