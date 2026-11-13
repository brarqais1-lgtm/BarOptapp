# Phase 09 Report — Glasses Order Management

**Status: PASS**

## Verification

| Check | Result |
|-------|--------|
| `npx tsc -b` | 0 errors |
| `npm test` | 324 tests passed (17 new, 307 from prior phases) |
| `npm run build` | ✓ built in ~1.3s |

## What was delivered

### Database (v9 migration)
- Extended `Sale` with `readyDate?` (expected glasses pickup date) and `labNotes?` (instructions for the lab)
- Added `readyDate` index on `sales` table for efficient order queries

### Business Logic
- **`markSaleReady(saleId, readyDate?, db)`** — transitions `confirmed → ready`, sets `readyDate`
- **`markSaleDelivered(saleId, db)`** — transitions `ready → delivered`, stamps `deliveryDate`
- **`getPendingOrders(db)`** — returns all `confirmed + ready` sales sorted by `readyDate` (soonest first, undated last)
- `createSale` and `updateSaleDraft` now persist `readyDate` and `labNotes`

### UI

#### SaleFormPage
- Added **Expected Ready Date** (`readyDate`) date input
- Added **Lab Notes** (`labNotes`) textarea
- When patient is selected: shows prescription dropdown (most recent first)
- When prescription is selected: displays **Prescription Reference Card** inline — OD/OS sphere/cylinder/axis/add + PD values in monospace font

#### SaleDetailPage
- Shows `readyDate` and `labNotes` in the invoice info panel
- Status badges now include `ready` (teal) and `delivered` (green)
- **Mark Ready** button — appears on `confirmed` orders
- **Mark Delivered** button — appears on `ready` orders
- **Print Lab Order** button — appears on `confirmed` and `ready` orders
- Lab order slip: switches to lab print mode via `body.lab-print-mode` CSS class:
  - Invoice content hidden, lab slip shown
  - Clinic header, order number + date, customer name
  - Prescription table (OD/OS × SPH/CYL/AXIS/ADD) if prescription linked
  - Frame item, Lens item with SKU
  - Expected ready date, lab notes
  - Signature lines for lab technician and customer
  - RTL/LTR aware layout

#### SalesPage — Orders Tab (default)
- New **Orders** tab is now the default landing tab
- Shows all confirmed + ready orders in a table
- **Overdue** orders (readyDate < today) highlighted in red
- Inline **Mark Ready** / **Mark Delivered** actions per row
- Empty state when all orders are delivered

### i18n
Both `en.json` and `ar.json` updated with:
- `sales.readyDate`, `sales.labNotes`, `sales.deliveryDate`
- `sales.markReady`, `sales.markDelivered`
- `sales.printLabOrder`, `sales.labOrderSlip`
- `sales.prescriptionRef`, `sales.noPrescription`
- `sales.ordersEmpty`, `sales.ordersEmptyHint`
- `sales.labSignature`, `sales.customerSignature`
- `sales.tabs.orders`
- `sales.status.ready`, `sales.status.delivered`

## Order Status Flow

```
draft → confirmed → ready → delivered
                 ↘ cancelled
```

## Key invariants
- `readyDate` and `labNotes` are optional — backward compatible with existing invoices
- `markSaleReady` only allowed from `confirmed` status
- `markSaleDelivered` only allowed from `ready` status
- Lab print does not affect invoice print — separate body-class-based CSS mode
- Prescription reference card is display-only; lens is still selected from inventory
