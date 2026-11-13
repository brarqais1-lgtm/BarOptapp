# Phase 12 Report — Expenses

**Status: PASS**

## Verification

| Check | Result |
|-------|--------|
| `npx tsc -b` | 0 errors |
| `npm test` | 363 tests passed (15 new, 348 from prior phases) |
| `npm run build` | ✓ built clean |

## What was delivered

### Database (v10 migration)
- Extended `Expense` interface with `expenseNumber` (EX-000001 auto-sequence) and `paymentMethod`
- Added `&expenseNumber` unique index on `expenses` table (expenses table existed since v1)

### ExpenseRepository (`src/modules/expenses/ExpenseRepository.ts`)
- **`EXPENSE_CATEGORIES`** — predefined slugs: rent, salary, utilities, maintenance, supplies, marketing, transport, other
- **`createExpense(values, db)`** — creates with auto EX-xxxxxx sequence, rounds amount to 2dp
- **`updateExpense(id, values, db)`** — updates all fields, preserves expenseNumber
- **`deleteExpense(id, db)`** — soft delete (sets deletedAt)
- **`searchExpenses(filters, db)`** — filters by category, fromDate, toDate; sorted by date desc
- **`getExpenseStats(db)`** — returns: `totalThisMonth`, `totalThisYear`, `totalAllTime`, `byCategory` map, `recentCount`

### ExpensesPage (`src/modules/expenses/ExpensesPage.tsx`)
- **3 stat tiles**: This Month / This Year / All Time totals
- **Category breakdown**: sorted by amount desc, colored badges per category
- **Date range + category filter** with Search/Reset buttons
- **Expenses table**: #, date, category badge, description, amount (red), payment method, edit/delete actions (hover-revealed)
- **Table footer**: running total of filtered results
- **Delete confirmation modal**
- Empty state with 📉 icon

### ExpenseFormPage (`src/modules/expenses/ExpenseFormPage.tsx`)
- Category select (all 8 predefined categories)
- Description, Amount, Date (required fields with validation)
- Payment method select (reuses `sales.payment.methods.*` i18n keys)
- Receipt number, Notes (optional)
- Works for both create and edit (`/expenses/new` and `/expenses/:id/edit`)

### Router + Sidebar
- `/expenses`, `/expenses/new`, `/expenses/:id/edit` routes active
- Expenses sidebar link activated

### i18n
Both `en.json` and `ar.json` updated with `expenses` namespace (title, categories, stats, errors, field labels).

## Category colors
| Category | Color |
|----------|-------|
| rent | purple |
| salary | blue |
| utilities | amber |
| maintenance | orange |
| supplies | teal |
| marketing | pink |
| transport | cyan |
| other | slate |
