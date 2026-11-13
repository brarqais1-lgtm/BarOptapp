# BarOpt — Phase 05 Report: Optical Products & Lens Catalog Management

**Status:** PASS  
**Date:** 2026-11-10  
**Tests:** 172/172 (43 new, 129 existing)  
**Build:** ✓ Success  
**TypeScript:** 0 errors  

---

## What Was Implemented

### Database (DB v5)
- New table: `productCategories` (id, nameAr, nameEn, type, description, createdAt, updatedAt, deletedAt)
- Extended `frames`: added `name?`, `frameShape?`, `categoryId?`; made cost/price/quantity optional (deferred to inventory phase)
- Extended `lenses`: added `name?`, `model?`, `addMin?`, `addMax?`, `coatings?`, `categoryId?`; lensType typed as `LensType`
- v5 upgrade migration: auto-populates `name` for existing frames/lenses from brand+model/lensType

### New Module: `src/modules/catalog/`
| File | Purpose |
|------|---------|
| `schema.ts` | Zod schemas: `FrameFormSchema`, `LensFormSchema`, `ProductCategorySchema` |
| `FrameRepository.ts` | Frame CRUD, search/filter, SKU/barcode uniqueness, soft delete, brands list |
| `LensRepository.ts` | Lens CRUD, search/filter, SKU/barcode uniqueness, soft delete, brands list |
| `ProductCategoryRepository.ts` | Category CRUD, filter by type (frame/lens/both), soft delete |
| `FramesPage.tsx` | Frame list with search, brand/gender/type filters, archive/restore |
| `FrameFormPage.tsx` | Create/edit frame form with Zod validation |
| `LensesPage.tsx` | Lens list with search, brand/type filters, archive/restore |
| `LensFormPage.tsx` | Create/edit lens form with coatings checkboxes and power ranges |
| `ProductCategoriesPage.tsx` | Inline create/edit/archive for product categories |

### Shared UI
- `src/components/ui/FormField.tsx` — reusable label+error wrapper component
- `src/index.css` — added `.form-input` utility class

### Router Updates (`src/app/router.tsx`)
Routes activated: `/frames`, `/frames/new`, `/frames/:id/edit`, `/lenses`, `/lenses/new`, `/lenses/:id/edit`, `/categories`

### Sidebar Updates (`src/components/layout/Sidebar.tsx`)
Frames and Lenses nav items set to `active: true`

### i18n
Full `catalog` namespace added to both `ar.json` and `en.json` covering frames, lenses, and categories.

---

## Key Design Decisions

**SKU/Barcode uniqueness in repository layer:** Dexie unique indexes (`&sku`) prevent soft-deleted records from sharing a SKU with new active ones. Instead, uniqueness is enforced via `.filter(r => !r.deletedAt && r.id !== excludeId)` to allow reuse of archived SKUs.

**Optional inventory fields:** `costPrice`, `sellingPrice`, `quantity`, `reorderPoint` remain optional on Frame/Lens so Phase 06 (inventory) can add them without a breaking migration.

**Category type filter includes 'both':** When filtering for `frame` or `lens` categories, records with `type='both'` always appear in both query results.

---

## Test Coverage (43 new tests)

| Suite | Tests |
|-------|-------|
| FrameFormSchema validation | 5 |
| LensFormSchema validation | 5 |
| ProductCategorySchema validation | 3 |
| Frame CRUD | 9 |
| Frame SKU/Barcode uniqueness | 4 |
| Lens CRUD | 6 |
| Lens SKU/Barcode uniqueness | 3 |
| ProductCategory CRUD | 5 |
| DB v5 migration regression | 3 |

---

## NOT Implemented (Phase 06+)
- Inventory management (stock quantities, movements, reorder alerts)
- Sales / purchases / payment flows
- Supplier linking beyond optional `supplierId` field
- Price fields (deferred to inventory/sales phase)
