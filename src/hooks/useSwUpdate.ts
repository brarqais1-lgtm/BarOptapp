import { useEffect, useState } from 'react'

export function useSwUpdate() {
  const [needsReload, setNeedsReload] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // Fires when a new SW takes over (skipWaiting already set in workbox config)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      setNeedsReload(true)
    })
  }, [])

  const applyUpdate = () => window.location.reload()

  return { needsReload, applyUpdate }
}
