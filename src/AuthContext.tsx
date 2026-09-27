import React, { createContext, useContext, useEffect, useState } from 'react'
import { isSupabaseConfigured } from './config'
import * as auth from './services/supabase/auth'

interface AuthContextValue {
  configured: boolean // ¿hay Supabase configurado en src/config.ts?
  session: auth.AuthSession | null
  userId: string | null
  username: string | null
  signIn: (username: string, password: string) => Promise<void>
  signUp: (username: string, password: string) => Promise<'signed-in' | 'confirm-email'>
  signOut: () => Promise<void>
  showSplash: boolean
  dismissSplash: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<auth.AuthSession | null>(() =>
    isSupabaseConfigured ? auth.getSession() : null,
  )

  // La splash de bienvenida debe verse una vez por carga de página: al recargar el
  // navegador con una sesión ya iniciada (se detecta aquí, en el primer render) o justo
  // después de iniciar sesión/crear cuenta con éxito (se activa en signIn/signUp más abajo).
  // Al ser un estado normal de React, navegar por la app (sin recargar) nunca lo reactiva.
  const [showSplash, setShowSplash] = useState(() => session !== null)

  // Se entera de cambios de sesión venidos de fuera de React (p. ej. un refresh token
  // rechazado que cierra la sesión).
  useEffect(() => auth.onAuthChange(setSession), [])

  async function signIn(username: string, password: string) {
    await auth.signIn(username, password)
    setShowSplash(true)
  }

  async function signUp(username: string, password: string) {
    const result = await auth.signUp(username, password)
    if (result === 'signed-in') setShowSplash(true)
    return result
  }

  async function signOut() {
    setShowSplash(false)
    await auth.signOut()
  }

  const value: AuthContextValue = {
    configured: isSupabaseConfigured,
    session,
    userId: session?.user.id ?? null,
    username: session ? auth.usernameOf(session) : null,
    signIn,
    signUp,
    signOut,
    showSplash,
    dismissSplash: () => setShowSplash(false),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
