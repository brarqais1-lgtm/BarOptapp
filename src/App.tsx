import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { AppRouter } from './app/router'
import { ActivationGate } from './components/ActivationGate'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSwUpdate } from './hooks/useSwUpdate'

function UpdateBanner() {
  const { needsReload, applyUpdate } = useSwUpdate()
  if (!needsReload) return null
  return (
    <div className="fixed bottom-20 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="flex items-center gap-3 bg-blue-700 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-2xl pointer-events-auto">
        <span>🔄 يوجد إصدار جديد من التطبيق</span>
        <button
          onClick={applyUpdate}
          className="bg-white text-blue-700 font-bold px-4 py-1.5 rounded-xl hover:bg-blue-50 transition-colors text-xs"
        >
          تحديث الآن
        </button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <ActivationGate>
            <AppRouter />
          </ActivationGate>
          <UpdateBanner />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
