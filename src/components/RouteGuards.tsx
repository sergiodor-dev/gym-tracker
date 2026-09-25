import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import BottomNav from './BottomNav'
import SyncErrorToast from './SyncErrorToast'

// Solo se exige iniciar sesión si Supabase está configurado (src/config.ts). Sin configurar,
// la app sigue funcionando solo en local, como en la Fase 1.
// La sesión se lee de localStorage al arrancar, así que no hay parpadeo: quien ya tiene
// sesión entra directo y quien no, va a Bienvenida desde el primer render.
function useNeedsLogin(): boolean {
  const { configured, session } = useAuth()
  return configured && !session
}

// Envuelve todas las rutas privadas: sin sesión → /welcome (también al cerrar sesión,
// porque este componente se vuelve a evaluar cuando la sesión desaparece).
export function ProtectedLayout() {
  if (useNeedsLogin()) return <Navigate to="/welcome" replace />
  return (
    <div className="app-shell">
      <main className="main">
        <div className="app">
          <Outlet />
        </div>
      </main>
      <SyncErrorToast />
      <BottomNav />
    </div>
  )
}

// Solo se ve la bienvenida sin sesión; con sesión se salta directo a Inicio.
export function WelcomeLayout({ children }: { children: React.ReactNode }) {
  if (!useNeedsLogin()) return <Navigate to="/" replace />
  return (
    <div className="app-shell">
      <main className="main">
        <div className="app">{children}</div>
      </main>
    </div>
  )
}
