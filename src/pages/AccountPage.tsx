import { useState } from 'react'
import { RefreshCw, LogOut, UserX } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { useAppData } from '../AppDataContext'
import { storageService } from '../services'
import { syncLabel, useSyncInfo } from '../services/syncStatus'
import PageHeader from '../components/PageHeader'
import ConfirmModal from '../components/ConfirmModal'
import { THEME } from '../theme'

// Con Supabase configurado, esta página solo es accesible con sesión iniciada (el login vive
// en WelcomePage). Aquí se ve el estado de la sincronización y se cierra la sesión.
export default function AccountPage() {
  const { configured, username, session, signOut } = useAuth()
  const { reload } = useAppData()
  const sync = useSyncInfo()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [preparingSignOut, setPreparingSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutHasUnsynced, setSignOutHasUnsynced] = useState(false)

  // Intenta subir lo pendiente antes de preguntar, para que el aviso de cambios sin
  // sincronizar (si aparece) refleje el estado real y no uno que un flush a tiempo habría evitado.
  async function openSignOutConfirm() {
    setPreparingSignOut(true)
    await storageService.flush()
    setPreparingSignOut(false)
    setSignOutHasUnsynced(storageService.hasUnsyncedChanges)
    setConfirmingSignOut(true)
  }

  function closeSignOutConfirm() {
    if (signingOut) return // no se cierra a mitad de un cierre de sesión en curso
    setConfirmingSignOut(false)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await storageService.clearDeviceData()
    await signOut() // sin sesión, el guardián de rutas te lleva a Bienvenida
  }

  function openDeleteConfirm() {
    setDeleteError(null)
    setConfirmingDelete(true)
  }

  function closeDeleteConfirm() {
    if (deleting) return // no se cierra a mitad de un borrado en curso
    setConfirmingDelete(false)
  }

  // Borra la cuenta y todos sus datos en Supabase (ver supabase/account_deletion.sql),
  // luego la caché local, y por último cierra la sesión en el cliente: con la cuenta ya
  // borrada, el access token deja de servir para nada, así que solo queda invalidarlo
  // localmente. Si algo falla (sin conexión, etc.), no se toca nada más y se puede reintentar.
  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await storageService.deleteAccount()
      await signOut()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta.')
      setDeleting(false)
    }
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
            <button
              type="button"
              className="danger"
              onClick={() => void openSignOutConfirm()}
              disabled={preparingSignOut}
            >
              <LogOut size={16} className="inline-icon" /> {preparingSignOut ? 'Comprobando…' : 'Cerrar sesión'}
            </button>
          </div>
          <div className="row">
            <button type="button" className="danger" onClick={openDeleteConfirm}>
              <UserX size={16} className="inline-icon" /> Eliminar cuenta
            </button>
          </div>
        </>
      )}

      {confirmingSignOut && (
        <ConfirmModal
          title="Cerrar sesión"
          icon={LogOut}
          message={
            <>
              <p>
                Al cerrar sesión se borran los datos de este dispositivo (seguirán guardados en tu cuenta).
              </p>
              {signOutHasUnsynced && (
                <p className="form-error small">
                  Tienes cambios que aún no se han podido sincronizar y se perderán.
                </p>
              )}
            </>
          }
          confirmLabel="Cerrar sesión"
          confirmingLabel="Cerrando…"
          confirming={signingOut}
          onConfirm={() => void handleSignOut()}
          onClose={closeSignOutConfirm}
        />
      )}

      {confirmingDelete && (
        <ConfirmModal
          title="Eliminar cuenta"
          icon={UserX}
          message={
            <>
              <p>
                Esto borra tu cuenta <strong>{username}</strong> y todos tus datos: ejercicios, rutinas,
                planificación semanal, progreso registrado y proteína.
              </p>
              <p className="muted small">
                Es permanente y no se puede deshacer, ni siquiera contactando con soporte: no hay ninguna
                copia que recuperar. Si quieres conservar algo, expórtalo antes en Backup.
              </p>
            </>
          }
          confirmLabel="Eliminar cuenta"
          confirmingLabel="Eliminando…"
          confirming={deleting}
          error={deleteError}
          onConfirm={() => void handleDeleteAccount()}
          onClose={closeDeleteConfirm}
        />
      )}
    </div>
  )
}
