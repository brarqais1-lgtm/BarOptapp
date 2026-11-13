import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App'

try {
  const saved = localStorage.getItem('baropt-font-size')
  if (saved) document.documentElement.setAttribute('data-font-size', saved)
} catch { /* ignore */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
