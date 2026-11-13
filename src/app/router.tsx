import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { PatientsPage } from '../modules/patients/PatientsPage'
import { PatientFormPage } from '../modules/patients/PatientFormPage'
import { PatientProfilePage } from '../modules/patients/PatientProfilePage'
import { ExaminationsPage } from '../modules/examinations/ExaminationsPage'
import { ExaminationFormPage } from '../modules/examinations/ExaminationFormPage'
import { ExaminationDetailPage } from '../modules/examinations/ExaminationDetailPage'
import { FramesPage } from '../modules/catalog/FramesPage'
import { FrameFormPage } from '../modules/catalog/FrameFormPage'
import { LensesPage } from '../modules/catalog/LensesPage'
import { LensFormPage } from '../modules/catalog/LensFormPage'
import { ProductCategoriesPage } from '../modules/catalog/ProductCategoriesPage'
import { InventoryPage } from '../modules/inventory/InventoryPage'
import SuppliersPage from '../modules/purchases/SuppliersPage'
import SupplierFormPage from '../modules/purchases/SupplierFormPage'
import SupplierDetailPage from '../modules/purchases/SupplierDetailPage'
import PurchasesPage from '../modules/purchases/PurchasesPage'
import PurchaseFormPage from '../modules/purchases/PurchaseFormPage'
import PurchaseDetailPage from '../modules/purchases/PurchaseDetailPage'
import PurchaseReceivingPage from '../modules/purchases/PurchaseReceivingPage'
import SalesPage from '../modules/sales/SalesPage'
import SaleFormPage from '../modules/sales/SaleFormPage'
import SaleDetailPage from '../modules/sales/SaleDetailPage'
import SalePaymentPage from '../modules/sales/SalePaymentPage'
import SaleReturnPage from '../modules/sales/SaleReturnPage'
import SettingsPage from '../modules/settings/SettingsPage'
import DashboardPage from '../modules/dashboard/DashboardPage'
import ExpensesPage from '../modules/expenses/ExpensesPage'
import ExpenseFormPage from '../modules/expenses/ExpenseFormPage'
import ReportsPage from '../modules/reports/ReportsPage'
import GlassesSalePage from '../modules/sales/GlassesSalePage'

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 text-center px-4">
      <div className="text-5xl mb-4 opacity-30">🚧</div>
      <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">{label}</h2>
      <p className="text-sm text-slate-400 mt-1">قريباً / Coming Soon</p>
    </div>
  )
}

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="patients/new" element={<PatientFormPage />} />
          <Route path="patients/:id" element={<PatientProfilePage />} />
          <Route path="patients/:id/edit" element={<PatientFormPage />} />
          <Route path="dashboard"    element={<DashboardPage />} />
          <Route path="examinations" element={<ExaminationsPage />} />
          <Route path="examinations/new" element={<ExaminationFormPage />} />
          <Route path="examinations/:id" element={<ExaminationDetailPage />} />
          <Route path="examinations/:id/edit" element={<ExaminationFormPage />} />
          <Route path="frames"       element={<FramesPage />} />
          <Route path="frames/new"   element={<FrameFormPage />} />
          <Route path="frames/:id/edit" element={<FrameFormPage />} />
          <Route path="lenses"       element={<LensesPage />} />
          <Route path="lenses/new"   element={<LensFormPage />} />
          <Route path="lenses/:id/edit" element={<LensFormPage />} />
          <Route path="categories"   element={<ProductCategoriesPage />} />
          <Route path="inventory"    element={<InventoryPage />} />
          <Route path="suppliers"    element={<SuppliersPage />} />
          <Route path="suppliers/new" element={<SupplierFormPage />} />
          <Route path="suppliers/:id" element={<SupplierDetailPage />} />
          <Route path="suppliers/:id/edit" element={<SupplierFormPage />} />
          <Route path="purchases"    element={<PurchasesPage />} />
          <Route path="purchases/new" element={<PurchaseFormPage />} />
          <Route path="purchases/:id" element={<PurchaseDetailPage />} />
          <Route path="purchases/:id/receive" element={<PurchaseReceivingPage />} />
          <Route path="glasses-sale/new" element={<GlassesSalePage />} />
          <Route path="sales"           element={<SalesPage />} />
          <Route path="sales/new"       element={<SaleFormPage />} />
          <Route path="sales/:id"       element={<SaleDetailPage />} />
          <Route path="sales/:id/edit"  element={<SaleFormPage />} />
          <Route path="sales/:id/payment" element={<SalePaymentPage />} />
          <Route path="sales/:id/return"  element={<SaleReturnPage />} />
          <Route path="accounts"     element={<ComingSoon label="الحسابات — Accounts" />} />
          <Route path="expenses"         element={<ExpensesPage />} />
          <Route path="expenses/new"     element={<ExpenseFormPage />} />
          <Route path="expenses/:id/edit" element={<ExpenseFormPage />} />
          <Route path="reports"      element={<ReportsPage />} />
          <Route path="settings"     element={<SettingsPage />} />
          <Route path="*"            element={<Navigate to="/patients" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
