# Phase 11 Report — Dashboard

**Status: PASS**

## Verification

| Check | Result |
|-------|--------|
| `npx tsc -b` | 0 errors |
| `npm test` | 348 tests passed (11 new, 337 from prior phases) |
| `npm run build` | ✓ built in ~1.0s |

## What was delivered

### DashboardRepository (`src/modules/dashboard/DashboardRepository.ts`)
- **`getDashboardSummary(db)`** — aggregates data from all major modules into one `DashboardSummary`:
  - `sales`: today/month counts + revenue, collected, outstanding, refunds (from `getSalesDashboardStats`)
  - `patientsToday`: patients registered today
  - `pendingOrdersCount` / `pendingOrders` (top 6): confirmed + ready orders
  - `recentPatients` (top 5): most recently registered
  - `lowStockCount` / `outOfStockCount`: from `getInventoryStats`
- **`getLast7DaysRevenue(db)`** — returns `DayRevenue[]` (7 entries, date + revenue) for the bar chart

### DashboardPage (`src/modules/dashboard/DashboardPage.tsx`)

**KPI tiles (8 total in two rows):**
- Today's Revenue (with invoice count)
- Monthly Revenue (with invoice count)
- Pending Orders — teal if any, slate if zero
- Patients Today — teal if any, slate if zero
- Outstanding balance — amber if any
- Total Collected
- Total Invoices
- Returns (with refund total if > 0, red)

All tiles are clickable and navigate to the relevant section.

**Alert banner:**
- Shown when `lowStockCount + outOfStockCount > 0`
- Amber banner with product count, navigates to `/inventory`

**Revenue sparkline (pure CSS bars):**
- Last 7 days bar chart — no external chart library
- Today's bar label highlighted in blue
- Bar heights proportional to max day revenue

**Pending orders panel:**
- Table of up to 6 pending orders (confirmed / ready)
- Overdue orders (readyDate < today) highlighted in red with ⚠
- Clicking a row navigates to `SaleDetailPage`

**Recent patients panel:**
- Table of 5 most recently registered patients
- Clicking a row navigates to `PatientProfilePage`

**Quick actions:**
- "New Patient" (blue primary button)
- "New Sale" (secondary button)

**Root redirect:** `/` now redirects to `/dashboard` (was `/patients`)

### Router + Sidebar
- `/dashboard` route replaced from `ComingSoon` to `DashboardPage`
- Dashboard sidebar link activated (`active: true`)
- App lands on Dashboard on first open

### i18n
Both `en.json` and `ar.json` updated with `dashboard` namespace:
- `dashboard.{title, last7Days, pendingOrdersList, recentPatients, ...}`
- `dashboard.stockAlert` with `{{count}}` interpolation
- `dashboard.invoicesCount` with `{{count}}` interpolation

## Architecture notes
- Dashboard calls existing repository functions — no new DB queries or tables
- Pure CSS bar chart: no chart library dependency added
- All navigation is React Router `useNavigate` — works with HashRouter
