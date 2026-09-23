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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<auth.AuthSession | null>(() =>
    isSupabaseConfigured ? auth.getSession() : null,
  )

  // Se entera de cambios de sesión venidos de fuera de React (p. ej. un refresh token
  // rechazado que cierra la sesión).
  useEffect(() => auth.onAuthChange(setSession), [])

  const value: AuthContextValue = {
    configured: isSupabaseConfigured,
    session,
    userId: session?.user.id ?? null,
    username: session ? auth.usernameOf(session) : null,
    signIn: auth.signIn,
    signUp: auth.signUp,
    signOut: auth.signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
