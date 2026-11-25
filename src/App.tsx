import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { AppRouter } from './app/router'
import { ActivationGate } from './components/ActivationGate'
import { ErrorBoundary } from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <ActivationGate>
            <AppRouter />
          </ActivationGate>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
