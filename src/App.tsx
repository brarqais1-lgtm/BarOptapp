import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { AppRouter } from './app/router'
import { ActivationGate } from './components/ActivationGate'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ActivationGate>
          <AppRouter />
        </ActivationGate>
      </ToastProvider>
    </ThemeProvider>
  )
}
