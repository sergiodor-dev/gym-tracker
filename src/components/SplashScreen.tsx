import { useEffect, useState } from 'react'
import { Loader2, RotateCw, WifiOff } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { useAppData } from '../AppDataContext'
import { syncLabel, useSyncInfo } from '../services/syncStatus'

const SPLASH_MS = 1800
const FADE_MS = 300

type Phase = 'hidden' | 'visible' | 'closing'

// Se muestra sobre ProtectedLayout cuando showSplash es true (ver AuthContext: recarga del navegador
// con sesión ya iniciada, o justo tras iniciar sesión/crear cuenta). Se autodesactiva una sola vez
// (con fundido de salida) y no vuelve a aparecer al navegar por la app.
export default function SplashScreen() {
  const { showSplash, dismissSplash, username } = useAuth()
  const { loading, reload } = useAppData()
  const sync = useSyncInfo()
  const [phase, setPhase] = useState<Phase>('hidden')
  const [minElapsed, setMinElapsed] = useState(false)
  const [sawLoading, setSawLoading] = useState(false)

  useEffect(() => {
    if (!showSplash) return
    setMinElapsed(false)
    setSawLoading(loading)
    setPhase('visible')
  }, [showSplash])

  useEffect(() => {
    if (loading) setSawLoading(true)
  }, [loading])

  useEffect(() => {
    if (phase !== 'visible') return
    const id = window.setTimeout(() => setMinElapsed(true), SPLASH_MS)
    return () => window.clearTimeout(id)
  }, [phase])

  const settled = sawLoading && !loading
  const ready = settled && (sync.state === 'synced' || sync.state === 'local')
  const failed = settled && (sync.state === 'offline' || sync.state === 'error')

  useEffect(() => {
    if (phase === 'visible' && minElapsed && ready) setPhase('closing')
  }, [phase, minElapsed, ready])

  useEffect(() => {
    if (phase !== 'closing') return
    const id = window.setTimeout(() => {
      setPhase('hidden')
      dismissSplash()
    }, FADE_MS)
    return () => window.clearTimeout(id)
  }, [phase, dismissSplash])

  if (phase === 'hidden') return null

  const close = () => {
    if (phase === 'visible') setPhase('closing')
  }

  const skippable = ready

  return (
    <div
      className={`splash-overlay${phase === 'closing' ? ' splash-overlay-closing' : ''}${skippable ? ' splash-skippable' : ''}`}
      role="status"
      aria-live="polite"
      onClick={skippable ? close : undefined}
    >
      <div className="splash-mark">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} width={76} height={76} alt="" />
      </div>
      <h1 className="splash-wordmark">
        Gym<span className="landing-wordmark-accent">Tracker</span>
      </h1>
      <p className="splash-greeting">{username ? `¡Bienvenido/a, ${username}!` : '¡Bienvenido!'}</p>

      <div className="splash-status">
        {failed ? (
          <>
            <p className="splash-status-text">
              <WifiOff size={16} className="inline-icon" aria-hidden="true" /> {syncLabel(sync)}. Tus datos no se han
              podido sincronizar.
            </p>
            <div className="splash-actions">
              <button type="button" onClick={() => void reload()}>
                <RotateCw size={16} className="inline-icon" aria-hidden="true" /> Reintentar
              </button>
              <button type="button" className="button-like" onClick={close}>
                Continuar sin conexión
              </button>
            </div>
          </>
        ) : (
          !ready && (
            <span className="splash-loading">
              <Loader2 size={26} className="spin" aria-hidden="true" />
              <span className="visually-hidden">Sincronizando tus datos…</span>
            </span>
          )
        )}
      </div>
    </div>
  )
}
