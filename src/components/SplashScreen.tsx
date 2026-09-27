import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'

const SPLASH_MS = 1800
const FADE_MS = 300

type Phase = 'hidden' | 'visible' | 'closing'

// Se muestra sobre ProtectedLayout cuando showSplash es true (ver AuthContext: recarga
// del navegador con sesión ya iniciada, o justo tras iniciar sesión/crear cuenta). Se
// autodesactiva una sola vez (con fundido de salida) y no vuelve a aparecer al navegar
// por la app.
export default function SplashScreen() {
  const { showSplash, dismissSplash, username } = useAuth()
  const [phase, setPhase] = useState<Phase>('hidden')

  useEffect(() => {
    if (showSplash) setPhase('visible')
  }, [showSplash])

  useEffect(() => {
    if (phase !== 'visible') return
    const id = window.setTimeout(() => setPhase('closing'), SPLASH_MS)
    return () => window.clearTimeout(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'closing') return
    const id = window.setTimeout(() => {
      setPhase('hidden')
      dismissSplash()
    }, FADE_MS)
    return () => window.clearTimeout(id)
  }, [phase, dismissSplash])

  if (phase === 'hidden') return null

  function requestClose() {
    if (phase === 'visible') setPhase('closing')
  }

  return (
    <div
      className={`splash-overlay${phase === 'closing' ? ' splash-overlay-closing' : ''}`}
      role="status"
      aria-live="polite"
      onClick={requestClose}
    >
      <div className="splash-mark">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} width={76} height={76} alt="" />
      </div>
      <h1 className="splash-wordmark">
        Gym<span className="landing-wordmark-accent">Tracker</span>
      </h1>
      <p className="splash-greeting">{username ? `¡Bienvenido, ${username}!` : '¡Bienvenido!'}</p>
    </div>
  )
}
