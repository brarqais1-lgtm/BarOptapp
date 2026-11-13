import { indexedDB, IDBKeyRange } from 'fake-indexeddb'
import '@testing-library/jest-dom'

// Polyfill IndexedDB for jsdom test environment
Object.defineProperty(globalThis, 'indexedDB', { value: indexedDB })
Object.defineProperty(globalThis, 'IDBKeyRange', { value: IDBKeyRange })

// Polyfill crypto.subtle for backup checksum tests
if (!globalThis.crypto?.subtle) {
  const { webcrypto } = await import('node:crypto')
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  })
}
