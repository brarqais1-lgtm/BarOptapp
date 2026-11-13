# BarOpt — Phase 01 Report: Foundation & Offline Architecture

**Date:** 2026-11-09
**Status:** ✅ PASS

---

## 1. Summary of Accomplishments

Phase 01 delivers the complete technical foundation for BarOpt: a production-ready offline-first PWA scaffold with a fully version-controlled IndexedDB schema, a backup/restore service with SHA-256 integrity verification, i18n support for Arabic (RTL) and English (LTR), and a passing Vitest test suite covering all required scenarios.

---

## 2. Project Structure

```
BarOpt/
├── index.html                        # App shell, RTL/Arabic by default
├── vite.config.ts                    # Vite + React + Tailwind v4 + PWA
├── vitest.config.ts                  # Test config (jsdom + fake-indexeddb)
├── package.json
├── tsconfig.app.json / tsconfig.node.json
│
├── public/
│   └── icons/                        # 8 PWA icons (72–512 px, blue B logo)
│
├── src/
│   ├── main.tsx                      # Entry — React 19 + i18n bootstrap
│   ├── App.tsx                       # App shell — offline indicator + locale toggle
│   ├── index.css                     # Tailwind v4 + base styles
│   │
│   ├── database/
│   │   ├── schema.ts                 # 15 TypeScript interfaces (all entities)
│   │   ├── db.ts                     # BarOptDB class (Dexie, v1, all tables + indexes)
│   │   ├── migrations/index.ts       # Version registry
│   │   └── repositories/
│   │       └── base.repository.ts    # Generic CRUD + soft-delete + restore
│   │
│   ├── services/
│   │   └── backup.service.ts         # Export/import with SHA-256 + AES stub
│   │
│   ├── i18n/
│   │   ├── index.ts                  # i18next + react-i18next setup
│   │   └── locales/
│   │       ├── ar.json               # Arabic translations
│   │       └── en.json               # English translations
│   │
│   └── utils/uuid.ts                 # UUID v4 generator
│
├── tests/
│   ├── setup.ts                      # fake-indexeddb + crypto polyfills
│   └── database.test.ts              # 25 tests across 6 suites
│
└── docs/
    └── PHASE_01_REPORT.md            # This file
```

---

## 3. Technologies Used

| Technology | Version | Role |
|---|---|---|
| React | 19.3.1 | UI framework |
| TypeScript | 7.0.2 | Type safety |
| Vite | 8.3.6 | Build tool |
| Tailwind CSS | 4.3.5 | Styling (v4, CSS-based config) |
| Dexie.js | 4.4.7 | IndexedDB ORM |
| Zod | 4.6.7 | Runtime validation |
| i18next + react-i18next | 27 / 18 | Internationalization |
| uuid | 14.0.3 | UUID v4 generation |
| vite-plugin-pwa | 2.0.0 | Service Worker + manifest |
| Vitest | 5.1.0 | Tests |
| fake-indexeddb | 6.2.8 | In-memory IndexedDB for tests |

**Prohibited dependencies:** ✅ No backend server, no cloud database, no external API, no fetch to remote on startup.

---

## 4. Database Schema

**Database name:** `BarOptDB`  
**Current version:** 1  
**Engine:** IndexedDB via Dexie.js

### Tables (15 total)

| Table | Key fields | Soft-delete |
|---|---|---|
| `patients` | id, phone, createdAt | ✅ |
| `eyeExaminations` | id, patientId, examinationDate | ✅ |
| `prescriptions` | id, patientId, examinationId | ✅ |
| `frames` | id, sku, brand, supplierId, barcode | ✅ |
| `lenses` | id, sku, brand, supplierId, barcode | ✅ |
| `inventoryMovements` | id, itemType, itemId, movementType | ❌ (ledger) |
| `sales` | id, saleNumber, patientId, status | ✅ |
| `saleItems` | id, saleId, itemType, itemId | ❌ |
| `payments` | id, saleId, method, paidAt | ✅ |
| `expenses` | id, category, paidAt | ✅ |
| `suppliers` | id, name | ✅ |
| `purchases` | id, purchaseNumber, supplierId, status | ✅ |
| `cashTransactions` | id, type, transactedAt | ❌ (ledger) |
| `settings` | id, key, [key+group] (unique) | ❌ |
| `auditLogs` | id, entityType, entityId, action | ❌ (append-only) |

### Design decisions
- All IDs: UUID v4
- All records: `createdAt`, `updatedAt` (ISO-8601)
- Soft-delete: `deletedAt` field (null = active)
- Financial/audit tables are **hard ledgers** — no soft-delete
- Compound indexes for common query patterns
- `BaseRepository<T>` provides generic CRUD without business logic

---

## 5. Offline First Mechanism

### How it works

1. **First load (online):** Vite PWA plugin generates `sw.js` via Workbox `generateSW` strategy. The Service Worker precaches all static assets (JS, CSS, HTML, icons — 23 entries, ~330 KB).

2. **Installation:** Browser installs the PWA. User can add to home screen on iOS/Safari, Android/Chrome, Windows/Edge, macOS/Chrome.

3. **Subsequent loads (offline):** Service Worker intercepts all requests. Cached assets are served from Cache Storage. IndexedDB (Dexie) persists all application data locally.

4. **Data flow:** 100% local — no fetch calls to any server. All reads/writes go directly to IndexedDB.

### Platform notes

| Platform | Install method | Limitation |
|---|---|---|
| Android Chrome | "Add to Home Screen" prompt | Full PWA support |
| Windows Chrome/Edge | Install button in address bar | Full PWA support |
| macOS Chrome/Safari | "Add to Dock" / "Add to Home Screen" | Full support |
| iOS Safari | Share → "Add to Home Screen" | No install prompt API; must be triggered manually |
| iOS Chrome/Firefox | ❌ | iOS forces all browsers to use WebKit; only Safari can install PWAs |

**PWA limitations vs native apps:**
- No push notifications on iOS (iOS 16.4+ added limited support)
- No background sync on iOS Safari
- No access to native file system beyond user-initiated downloads
- Storage quota varies by platform/browser (typically 50–80% of disk)

---

## 6. Backup & Restore Mechanism

### Export flow
1. Read all 15 tables from IndexedDB via Dexie
2. Build a `BackupFile` = `{ manifest, data }`
3. Compute SHA-256 of `JSON.stringify(data)` via `crypto.subtle`
4. Embed checksum, schema version, record counts, timestamp in manifest
5. Download as `BarOpt_backup_YYYY-MM-DD.json`

### Import flow
1. User selects a `.json` file
2. `validateBackupFile()` checks:
   - `appName === 'BarOpt'`
   - `schemaVersion <= CURRENT_DB_VERSION`
   - SHA-256 recomputed and matched against `manifest.checksum`
3. If DB is non-empty and `overwrite: false` → refuse with error message
4. If `overwrite: true` → open Dexie transaction, `clear()` all tables, `bulkAdd()` from backup
5. Return `{ success: true, recordCounts }` or `{ success: false, error }`

### Security design
- Encryption stub `encryptPayload()` exported — ready for AES-256-GCM in Phase 03
- `manifest.encrypted: false` flag distinguishes plain vs encrypted backups
- No localStorage used as a database

---

## 7. Test Results

```
 Test Files  1 passed (1)
 Tests       25 passed (25)
 Duration    851ms
```

### Test breakdown

| Suite | Tests | Status |
|---|---|---|
| Database Schema | 4 | ✅ |
| Patient CRUD | 8 | ✅ |
| Multi-table operations | 2 | ✅ |
| Data persistence across DB re-open | 1 | ✅ |
| Backup Service | 9 | ✅ |
| Input validation with Zod | 1 | ✅ |
| **Total** | **25** | **✅ 25/25** |

### What was tested
- DB opens at correct schema version
- All 15 tables present
- Migration registry consistent
- UUID v4 format on create
- createdAt/updatedAt populated
- Read by ID
- Update (field change)
- Soft-delete (sets deletedAt, record kept)
- Soft-deleted excluded from findAll
- Restore removes deletedAt
- count() active vs all
- Hard delete (permanent)
- Multi-table cross-reference
- Settings key-value
- DB re-open data persistence (fake-indexeddb)
- Backup manifest validity
- Backup covers all 15 tables
- Backup validate — valid
- Backup validate — wrong appName rejection
- Backup validate — future schema version rejection
- Backup validate — tampered checksum rejection
- Restore data (overwrite)
- Restore refused when non-empty without flag
- Backup record counts accuracy
- Zod validation (required fields, enum)

---

## 8. Remaining Issues

None critical. Known notes:

- `fake-indexeddb` is in-memory per process; persistence simulation is within-process only. Real IndexedDB persistence testing requires a browser environment.
- The `encryptPayload` stub throws intentionally — encryption is deferred to Phase 03.
- PWA offline behavior can only be fully verified in a browser with Network tab throttled to offline (not automated in this test suite).

---

## 9. Technical Constraints

1. **iOS Safari PWA:** No programmatic install prompt (`beforeinstallprompt` not supported). Users must manually use Share → Add to Home Screen.
2. **IndexedDB storage quotas:** Browsers may evict data under storage pressure. Phase 02 should guide users to request persistent storage (`navigator.storage.persist()`).
3. **Tailwind v4:** No `tailwind.config.js` — configuration is CSS-based. Component library (if added later) must be Tailwind v4 compatible.
4. **TypeScript `erasableSyntaxOnly`:** Vite 8 / TS 7 strict mode. Constructor parameter properties disallowed; standard property declarations used instead.
5. **No Server-Sent Events / WebSockets:** Intentional — the app is 100% local. Multi-device sync is out of scope for Phase 01.

---

## 10. Phase 02 Readiness Verdict

> **PASS**

All Phase 01 requirements met:
- ✅ Project scaffolded (React 19 + TS + Vite + Tailwind v4)
- ✅ Offline-first architecture with Service Worker + PWA manifest
- ✅ 15-table IndexedDB schema with versioning, soft-delete, UUID
- ✅ BaseRepository with full CRUD
- ✅ Backup/restore with SHA-256 integrity check
- ✅ i18n skeleton (AR + EN, RTL/LTR)
- ✅ 25 Vitest tests, all passing
- ✅ TypeScript build clean (0 errors)
- ✅ No mock data as DB substitute
- ✅ No backend, no cloud, no external API

**Phase 02 may proceed.** Recommended first steps: implement the Patients module UI (list, create, edit, detail view) using the existing `BaseRepository<Patient>` and i18n infrastructure.
