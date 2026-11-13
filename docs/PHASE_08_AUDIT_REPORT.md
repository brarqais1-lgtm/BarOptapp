# Phase 08 Audit Report — Sales & Invoicing

**Date:** 2026-11-10  
**Status: PASS**

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc -b` | 0 errors |
| `npm test` | 307 tests passed (6 new audit tests added) |
| `npm run build` | ✓ built in ~1.1s |

---

## Audit Checklist

### 1. Payment History — Audit Trail ✅ PASS

**Requirement:** `deletePayment` must not permanently delete payments. Voided payments must remain visible in the payment history for audit purposes.

**Finding:** `deletePayment` in `PaymentsRepository.ts` was already performing a soft-delete (sets `deletedAt`, reverses `sale.paidAmount`). No permanent deletion occurred. However, `getPayments` was filtering out soft-deleted payments with `.filter(p => !p.deletedAt)`, hiding voided payments from the UI — a gap in the audit trail.

**Fix applied to `PaymentsRepository.ts`:**
- `getPayments` now returns ALL payments (active + voided), sorted by `paidAt`
- UI in `SaleDetailPage.tsx` distinguishes voided payments: strikethrough text, `opacity-50`, "Voided" badge (grey) instead of method badge

**Tests added:** `getPayments (audit: includes voided)` — 2 tests covering voided visibility and sort order.

---

### 2. Inventory Returns — Correct Restock on Cancel ✅ PASS

**Requirement:** All product types must restore stock correctly. Must prevent duplicate stock restoration when a sale with prior partial returns is cancelled.

**Finding (critical bug):** `cancelSale` was restoring `item.quantity` (the full original quantity sold) instead of `item.quantity - item.returnedQty` (what is still held by the customer). If 3 units were sold and 1 had already been returned and restocked, cancelling the sale would restore 3 units again — resulting in a +1 overcount.

**Fix applied to `SalesRepository.ts`:**
```typescript
const netQty = item.quantity - item.returnedQty
if (netQty <= 0) continue          // skip items already fully returned
const qtyAfter = qtyBefore + netQty
```
- Also uses `netQty` in the inventory movement quantity field
- Items with `netQty <= 0` (fully returned before cancel) are skipped entirely

**Tests added:** `cancelSale (audit: net qty after partial return)` — 2 tests:
1. Partial return (1 of 3) then cancel → restores exactly 2, total back to original 10
2. Full return (2 of 2) then cancel → no additional restore, quantity unchanged

---

### 3. Invoice Printing — Professional A4, RTL/LTR ✅ PASS

**Requirement:** Professional A4 invoice printing. Arabic RTL and English LTR. All invoice totals, discounts, payments, and remaining balances visible on print.

**Changes applied to `SaleDetailPage.tsx`:**
- Added `@media print` CSS: `@page { size: A4; margin: 15mm }`, white background, black text, 11pt font
- Added `const isRtl = i18n.language === 'ar'` and `dir={isRtl ? 'rtl' : 'ltr'}` on the outer container
- Added hidden-on-screen / print-only clinic header block:
  - Clinic name, address, phone (loaded from `settings` table via `useLiveQuery`)
  - "Invoice" label + sale number + date (right side, RTL-aware)
  - Separated from body by a 2px border
- Action buttons have `print:hidden` class — do not print
- Error banner has `print:hidden` — does not print
- **Returns section**: removed erroneous `print:hidden` — returns ARE visible on print
- Items table, totals, payment history, and returns all render on the printed page
- Voided payments shown with strikethrough/reduced-opacity on screen and print

**i18n keys added:**
- `sales.invoice` → "Invoice" / "فاتورة" (used in print header)
- `sales.payment.voided` → "Voided" / "ملغى" (used in voided payment badge)

---

### 4. Financial Integrity — Returns Not Counted as Revenue ✅ PASS

**Requirement:** Partial payments, multiple payments, refunds, and cancellations must maintain accurate balances. Returned amounts must NOT be counted as revenue in reports.

**Finding:** Reports (`getSalesReport`, `getSalesDashboardStats`) did not subtract refund amounts from revenue figures.

**Fix applied to `SalesRepository.ts`:**

Dashboard stats extended:
```typescript
totalRefundsIssued: number  // sum of all SaleReturn.totalRefund
```
Loaded by batch-fetching all `saleReturns` records.

Report rows extended:
```typescript
returnedAmount: number  // sum of SaleReturn.totalRefund for this sale
netRevenue: number      // total - returnedAmount
```
Loaded by batch-fetching all returns and mapping by `saleId`.

**`SalesPage.tsx` reports tab updated:**
- Dashboard stats tile added for "Total Refunds"
- Reports summary section shows Gross Revenue, Total Refunds, Net Revenue, Collected, Outstanding
- Reports detail table adds "Returned" (red, negated) and "Net Revenue" (bold) columns

**Tests added:** `getSalesReport (audit: net revenue)` — 2 tests:
1. 1 of 2 items returned → `returnedAmount = 100`, `netRevenue = 100`
2. No returns → `returnedAmount = 0`, `netRevenue = gross total`

---

### 5. Regression — All Tests Pass ✅ PASS

| Metric | Value |
|--------|-------|
| Total tests | 307 |
| New audit tests | 6 |
| Prior tests | 301 |
| Failures | 0 |
| TypeScript errors | 0 |
| Build | ✓ |

No regressions. All prior phase tests (01–07) continue to pass.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/modules/sales/PaymentsRepository.ts` | `getPayments` returns all payments including voided |
| `src/modules/sales/SalesRepository.ts` | `cancelSale` uses net qty; dashboard stats + report rows include return/refund fields |
| `src/modules/sales/SaleDetailPage.tsx` | Print layout (A4, RTL/LTR, clinic header); voided payment display; returns visible on print |
| `src/modules/sales/SalesPage.tsx` | Dashboard totalRefunds tile; reports summary + detail columns for returnedAmount/netRevenue |
| `src/i18n/locales/en.json` | Added `sales.invoice`, `sales.payment.voided`, `sales.stats.totalRefunds`, `sales.stats.netRevenue`, `sales.stats.returned` |
| `src/i18n/locales/ar.json` | Same keys in Arabic |
| `tests/sales.test.ts` | 6 new audit tests (groups 10–12) |
