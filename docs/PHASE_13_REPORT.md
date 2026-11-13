# Phase 13 — Reports: PASS

**Date:** 2026-11-10  
**DB Version:** 10 (unchanged)  
**Tests:** 377 / 377 pass  
**Build:** Clean

## Deliverables

### New Files
- `src/modules/reports/ReportsRepository.ts` — P&L, monthly sales summary, inventory valuation queries
- `src/modules/reports/ReportsPage.tsx` — 3-tab Reports UI
- `src/hooks/useCurrency.ts` — reads currency from settings, formats numbers
- `tests/reports.test.ts` — 14 tests covering all three report functions

### Updated Files
- `src/app/router.tsx` — `/reports` route wired to ReportsPage
- `src/components/layout/Sidebar.tsx` — Reports nav item set active
- `src/i18n/locales/en.json` — `reports` namespace added
- `src/i18n/locales/ar.json` — `reports` namespace added (Arabic)

## Features

### Profit & Loss Tab
- Period selector: This Month / This Year / Custom date range
- Gross revenue, returns, net revenue
- COGS (via received/partial purchases in period)
- Gross profit and gross margin %
- Expense breakdown by category
- Net profit and net margin %
- Invoice count, return count, expense count

### Monthly Sales Summary Tab
- Year navigator (◀ 2026 ▶)
- 12-month table with invoices, gross revenue, returns, net revenue, collected, outstanding
- Totals footer row

### Inventory Valuation Tab
- 4 stat tiles: total cost value, total selling value, potential profit, total units
- Filter by product type (all / frames / lenses)
- Per-product rows with cost and selling values
- Excludes products with zero quantity

## Technical Notes
- `useLiveQuery` calls use no third argument to avoid TypeScript type collapsing to `{}`
- Explicit type annotations on reduce callbacks prevent `any` inference
- `useCurrency` hook reads from `settings` table via `useLiveQuery`
