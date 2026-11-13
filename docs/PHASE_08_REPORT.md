# Phase 08 Report — Sales & Invoicing

**Status: PASS**

## Verification

| Check | Result |
|-------|--------|
| `npx tsc -b` | 0 errors |
| `npm test` | 301 tests passed (49 new, 252 from prior phases) |
| `npm run build` | ✓ built in ~1.2s |

## What was delivered

### Database (v8 migration)
- Extended `Sales` table: added `saleDate`, `paymentStatus`, `walkInName?`, unique `saleNumber` index
- Extended `SaleItems` table: added `returnedQty`, `sku?`
- Added `SaleReturns` table: `returnNumber` (RT-000001), `saleId`, `returnDate`, `reason?`, `totalRefund`
- Added `SaleReturnItems` table: per-item return detail with `restockItem` flag
- Upgrade function backfills `saleDate`, `paymentStatus`, and `returnedQty=0` for existing records

### Business Logic
- **`sales.schema.ts`** — Zod v4 schemas: `SaleFormSchema`, `SaleItemFormSchema`, `PaymentFormSchema`, `ReturnFormSchema`
- **`SalesRepository.ts`** — sale sequence (INV-000001), create/update draft, confirm (atomic inventory deduction), cancel (inventory restore), search with filters, dashboard stats, report rows
- **`PaymentsRepository.ts`** — add payment (validates ≤ remaining balance, updates paymentStatus), get payments, delete payment (reverses paidAmount)
- **`ReturnsService.ts`** — return sequence (RT-000001), processReturn (atomic tx: validate qty, create SaleReturn+Items, update returnedQty, create `returned` inventory movements, restock frames/lenses), getReturns, getReturnItems

### UI Pages
- **`SalesPage.tsx`** — tabbed: Dashboard (stats tiles + recent invoices) | Invoices (filtered table) | Reports (summary + detail table)
- **`SaleFormPage.tsx`** — create/edit draft: patient or walk-in, item grid with live totals, order-level discount (fixed + %)
- **`SaleDetailPage.tsx`** — full invoice view, action buttons (confirm/cancel/payment/return/print), payments table, returns table
- **`SalePaymentPage.tsx`** — add payment form with balance guard
- **`SaleReturnPage.tsx`** — per-item return quantities, restock checkbox, estimated refund preview

### Wiring
- Router: 6 new routes under `/sales`
- Sidebar: Sales activated (🧾)
- i18n: `sales` namespace added in both `en.json` and `ar.json`

## Key invariants

- Inventory is deducted **only** on `confirmSale`, not on draft creation
- `cancelSale` restores inventory only if the sale was `confirmed` (not draft)
- Payment amount is validated to never exceed `sale.balanceDue`
- Return quantity is validated to never exceed `saleItem.quantity - saleItem.returnedQty`
- All multi-table mutations use a single Dexie transaction
- `paymentStatus` is always derived and kept in sync: `unpaid / partial / paid`
- No backend, no cloud services, no multi-user, no roles — pure IndexedDB PWA
