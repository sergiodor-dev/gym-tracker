import { NavLink } from 'react-router-dom'
import { Home, CalendarDays, TrendingUp, Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { syncLabel, useSyncInfo } from '../services/syncStatus'

const tabs = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/planner', label: 'Planificación', icon: CalendarDays },
  { to: '/progress', label: 'Progreso', icon: TrendingUp },
]

// Icono del estado de sincronización: el color lo pone el punto (ver CSS), el
// icono en sí solo distingue "subiendo" (giratorio) de "hay un problema" (aviso).
const SYNC_ICON = {
  synced: Cloud,
  syncing: RefreshCw,
  offline: CloudOff,
  error: AlertTriangle,
} as const

export default function BottomNav() {
  const { configured } = useAuth()
  const sync = useSyncInfo()
  // Sin Supabase configurado no hay nada que sincronizar, así que no tiene sentido
  // mostrar el indicador (el estado sería siempre "local").
  const SyncIcon = sync.state === 'local' ? null : SYNC_ICON[sync.state]

  return (
    <nav className="bottom-nav">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
          <Icon size={22} strokeWidth={2.2} />
          <span>{label}</span>
        </NavLink>
      ))}
      {configured && SyncIcon && (
        <NavLink
          to="/account"
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          aria-label={`Cuenta — ${syncLabel(sync)}`}
          title={syncLabel(sync)}
        >
          <span className="bottom-nav-sync-icon">
            <SyncIcon size={22} strokeWidth={2.2} className={sync.state === 'syncing' ? 'spin' : undefined} />
            <span className={`bottom-nav-sync-dot ${sync.state}`} />
          </span>
          <span>Cuenta</span>
        </NavLink>
      )}
    </nav>
  )
}
