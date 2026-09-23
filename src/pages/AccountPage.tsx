import { RefreshCw } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { useAppData } from '../AppDataContext'
import { storageService } from '../services'
import { SyncInfo, useSyncInfo } from '../services/syncStatus'
import PageHeader from '../components/PageHeader'
import { THEME } from '../theme'

function syncLabel(sync: SyncInfo): string {
  switch (sync.state) {
    case 'synced': {
      const time = sync.lastSync
        ? new Date(sync.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : ''
      return time ? `Sincronizado a las ${time}` : 'Sincronizado'
    }
    case 'syncing': return 'Sincronizando…'
    case 'offline': return 'Sin conexión'
    case 'error': return 'Error de sincronización'
    default: return 'Solo en este dispositivo'
  }
}

// Con Supabase configurado, esta página solo es accesible con sesión iniciada (el login vive
// en WelcomePage). Aquí se ve el estado de la sincronización y se cierra la sesión.
export default function AccountPage() {
  const { configured, username, session, signOut } = useAuth()
  const { reload } = useAppData()
  const sync = useSyncInfo()

  async function handleSignOut() {
    await storageService.flush() // intenta subir lo pendiente antes de preguntar
    const warning = storageService.hasUnsyncedChanges
      ? 'Tienes cambios que aún no se han podido sincronizar y se perderán. '
      : ''
    const ok = window.confirm(
      `${warning}Al cerrar sesión se borran los datos de este dispositivo (seguirán guardados en tu cuenta). ¿Continuar?`,
    )
    if (!ok) return
    await storageService.clearDeviceData()
    await signOut() // sin sesión, el guardián de rutas te lleva a Bienvenida
  }

  return (
    <div className="page">
      <PageHeader title="Cuenta" icon={THEME.account.icon} color={THEME.account} />

      {!configured && (
        <div className="chart-card">
          <p style={{ marginTop: 0 }}><strong>La sincronización no está activada.</strong></p>
          <p className="muted" style={{ marginBottom: 0 }}>
            Tus datos se guardan solo en este dispositivo y no hace falta iniciar sesión. Para sincronizarlos, crea
            un proyecto en Supabase y rellena <code>SUPABASE_URL</code> y <code>SUPABASE_ANON_KEY</code> en{' '}
            <code>src/config.ts</code> (pasos en el README).
          </p>
        </div>
      )}

      {configured && session && (
        <>
          <div className="chart-card">
            <p className="muted small" style={{ marginTop: 0 }}>Sesión iniciada como</p>
            <p style={{ margin: '0 0 0.9rem', fontWeight: 700, wordBreak: 'break-all' }}>{username}</p>
            <span className={`sync-badge ${sync.state}`}>{syncLabel(sync)}</span>
            {sync.state === 'offline' && (
              <p className="muted small" style={{ marginBottom: 0 }}>
                Tus cambios se guardan en este dispositivo y se subirán al recuperar la conexión.
              </p>
            )}
            {sync.state === 'error' && sync.message && (
              <p className="form-error small" style={{ marginBottom: 0 }}>{sync.message}</p>
            )}
          </div>
          <div className="row">
            <button type="button" onClick={() => void reload()}>
              <RefreshCw size={16} className="inline-icon" /> Sincronizar ahora
            </button>
            <button type="button" className="danger" onClick={() => void handleSignOut()}>
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  )
}
