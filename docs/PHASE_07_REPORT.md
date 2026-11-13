# BAROPT — PHASE 07 REPORT: Suppliers & Purchase Management

## Status: PASS

**All checks green:**
- `npx tsc -b` → 0 errors
- `npm test` → 252 tests passed (7 test files; 35 new tests in purchases.test.ts)
- `npm run build` → success

---

## What was built

### Database (v7)

| Change | Details |
|---|---|
| New table: `purchaseItems` | `id, purchaseId, productType, productId, [purchaseId+productType]` |
| Extended: `purchases` | Added `purchaseDate?`, `expectedDeliveryDate?`; `purchaseNumber` made unique (`&purchaseNumber`) |
| Extended: `inventoryMovements` | Added `referenceId` index for purchase linking |
| Upgrade migration | Backfills `purchaseDate = createdAt` on existing purchases |

### Business Logic

**`SupplierRepository.ts`**
- `createSupplier`, `updateSupplier`, `getSupplierById`, `searchSuppliers`
- `archiveSupplier`, `restoreSupplier` (soft delete via `deletedAt`)
- `getSupplierStats` — total orders, received count, total value, last order date

**`PurchaseRepository.ts`**
- `getNextPurchaseNumber` — atomic sequence via `settings` table, format `PO-000001`
- `createPurchase` — header + items, computes `lineTotal` and order totals
- `calculateTotals` — `itemsSubtotal = Σ(qty×cost − discount + tax)`; `total = subtotal − orderDiscount + orderTax`
- `getPurchaseById`, `getPurchaseItems`, `searchPurchases`, `getPurchasesBySupplier`
- `addItemToDraft`, `removeItemFromDraft`, `recalcPurchaseTotals` — draft mutations

**`PurchaseService.ts`**
- `markAsOrdered` — draft → ordered; requires at least one item
- `cancelPurchase` — guards against cancelling received/partial purchases
- `receivePurchaseItems` — single Dexie transaction spanning `purchases`, `purchaseItems`, `inventoryMovements`, `frames`, `lenses`:
  - Validates purchase status (must be ordered or partial)
  - Validates qty ≤ outstanding per item (over-receiving prevention)
  - Creates `stock_in` movement with `referenceType: 'purchase'`, `referenceId`, `referenceNumber`
  - Updates product `quantity` atomically
  - Updates `receivedQty` on each item
  - Auto-transitions: all received → `'received'`; some remaining → `'partial'`
- `getPurchaseMovements` — movements linked to a purchase via `referenceId`

### Schema (`purchases.schema.ts`)

Zod v4-compatible schemas: `SupplierFormSchema`, `PurchaseItemFormSchema`, `PurchaseFormSchema`, `ReceivingFormSchema`

### UI Pages

| Page | Route | Description |
|---|---|---|
| `SuppliersPage` | `/suppliers` | List with search, archive toggle, archive/restore actions |
| `SupplierFormPage` | `/suppliers/new`, `/suppliers/:id/edit` | Create/edit form with Zod validation |
| `SupplierDetailPage` | `/suppliers/:id` | Info panel, stats cards, purchase history table |
| `PurchasesPage` | `/purchases` | List with status filter and search |
| `PurchaseFormPage` | `/purchases/new` | Draft creation: header fields + dynamic items grid with live totals |
| `PurchaseDetailPage` | `/purchases/:id` | Header, items table, totals, action buttons, stock movements |
| `PurchaseReceivingPage` | `/purchases/:id/receive` | Outstanding items with qty inputs, confirm receiving |

### Navigation & i18n

- Sidebar: added `Suppliers (🏭)` and `Purchases (🛒)` nav items (active)
- Router: 9 new routes under `/suppliers` and `/purchases`
- `en.json` and `ar.json`: added `suppliers.*`, `purchases.*` namespaces and missing `common.*` keys

---

## Constraints enforced

| Constraint | Mechanism |
|---|---|
| Stock calculated from movements | `receivePurchaseItems` creates `stock_in` movement; `quantity` on frame/lens updated atomically in same transaction |
| Stocktaking unaffected | No changes to stocktaking tables or Phase 06 logic |
| Over-receiving prevention | `outstanding = orderedQty − receivedQty`; throws if `qty > outstanding` |
| Duplicate receiving prevention | Guards on `status === 'received'` and per-item outstanding check |
| Atomic receiving | Single Dexie transaction across 5 tables; rollback on any error |
| PO number uniqueness | `&purchaseNumber` Dexie unique index; sequence via `settings` table in its own transaction |
| No accounting/payments/sales | `paidAmount` and `balanceDue` fields stored but no payment flows implemented |

---

## Test coverage (35 tests)

| Suite | Tests |
|---|---|
| Supplier CRUD | 5 |
| PO Number Sequence | 3 |
| Purchase creation | 3 |
| `calculateTotals` helper | 1 |
| Draft item management | 3 |
| Status transitions | 4 |
| Receiving — full | 2 |
| Receiving — partial | 2 |
| Over-receiving prevention | 2 |
| Duplicate receiving prevention | 2 |
| Atomic inventory integration | 3 |
| Supplier stats | 1 |
| Search & filter | 3 |

---

## NOT implemented (per spec)

- Supplier payments, accounts payable, cash transactions
- Accounting, profit calculations
- Sales, customer payments
- External APIs, backend, cloud synchronization
