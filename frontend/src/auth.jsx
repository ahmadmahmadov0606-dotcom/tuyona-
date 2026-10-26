import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, setUnauthorizedHandler, tokenStore } from './api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!tokenStore.get()) { setReady(true); return }
    api.me().then(setUser).catch(() => tokenStore.clear()).finally(() => setReady(true))
  }, [logout])

  const accept = useCallback((res) => {
    tokenStore.set(res.access_token)
    setUser(res.user)
    return res.user
  }, [])

  const value = useMemo(() => ({
    user, ready, setUser, logout,
    login: async (email, password) => accept(await api.login({ email, password })),
    register: async (data) => accept(await api.register(data)),
    isVendor: user?.role === 'vendor' || user?.role === 'admin',
    isAdmin: user?.role === 'admin',
  }), [user, ready, logout, accept])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)

export function RequireAuth({ children, role }) {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <div className="page-loader"><span className="spinner" /></div>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if (role === 'vendor' && !(user.role === 'vendor' || user.role === 'admin')) return <Navigate to="/" replace />
  if (role === 'admin' && user.role !== 'admin') return <Navigate to="/" replace />
  return children
}
