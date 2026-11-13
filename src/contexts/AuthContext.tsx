import { createContext, useContext, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'baropt_auth'
const SESSION_KEY = 'baropt_session'

interface Credentials { username: string; passhash: string }

function getCredentials(): Credentials {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Credentials
  } catch { /* ignore */ }
  // بيانات افتراضية: admin / 1234
  return { username: 'admin', passhash: btoa('1234') }
}

function saveCredentials(username: string, password: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ username, passhash: btoa(password) }))
}

interface AuthContextType {
  isLoggedIn: boolean
  currentUser: string
  login: (username: string, password: string) => boolean
  logout: () => void
  changeCredentials: (username: string, oldPassword: string, newPassword: string) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  })
  const [currentUser, setCurrentUser] = useState(() => {
    return sessionStorage.getItem(SESSION_KEY + '_user') ?? ''
  })

  const login = (username: string, password: string): boolean => {
    const creds = getCredentials()
    if (username === creds.username && btoa(password) === creds.passhash) {
      sessionStorage.setItem(SESSION_KEY, '1')
      sessionStorage.setItem(SESSION_KEY + '_user', username)
      setIsLoggedIn(true)
      setCurrentUser(username)
      return true
    }
    return false
  }

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY + '_user')
    setIsLoggedIn(false)
    setCurrentUser('')
  }

  const changeCredentials = (username: string, oldPassword: string, newPassword: string): boolean => {
    const creds = getCredentials()
    if (btoa(oldPassword) !== creds.passhash) return false
    saveCredentials(username, newPassword)
    setCurrentUser(username)
    sessionStorage.setItem(SESSION_KEY + '_user', username)
    return true
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, currentUser, login, logout, changeCredentials }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
