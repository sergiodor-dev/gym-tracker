import React, { useState } from 'react'
import { useAuth } from '../AuthContext'
import { validateUsername } from '../services/supabase/auth'
import { THEME } from '../theme'

type Mode = 'signin' | 'signup'

// Supabase responde en inglés; se traducen los errores más habituales.
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Usuario o contraseña incorrectos.'
  if (m.includes('email not confirmed')) {
    return 'Tu proyecto de Supabase exige confirmar el email. Desactiva "Confirm email" (ver README) y crea la cuenta de nuevo.'
  }
  if (m.includes('already registered')) return 'Ese nombre de usuario ya está en uso. Elige otro o inicia sesión.'
  if (m.includes('is invalid') || m.includes('email_address_invalid')) {
    return 'Supabase ha rechazado el dominio interno del usuario. Cambia USERNAME_EMAIL_DOMAIN en src/config.ts.'
  }
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('rate limit')) return 'Demasiados intentos. Espera un momento y vuelve a probar.'
  if (m.includes('failed to fetch') || m.includes('networkerror')) return 'No se pudo conectar. Revisa tu conexión.'
  return message
}

// Puerta de entrada de la app. Al iniciar sesión o crear la cuenta, el guardián de rutas
// (components/RouteGuards.tsx) redirige solo a Inicio: aquí no hace falta navegar.
export default function WelcomePage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const Mark = THEME.train.icon

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setConfirm('')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (mode === 'signup') {
      const invalid = validateUsername(username)
      if (invalid) return setError(invalid)
      if (password !== confirm) return setError('Las contraseñas no coinciden.')
    }
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(username, password)
      } else if ((await signUp(username, password)) === 'confirm-email') {
        setError('Tu proyecto de Supabase exige confirmar el email, y aquí no se envía ninguno. Desactiva "Confirm email" (ver README).')
      }
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  const signup = mode === 'signup'

  return (
    <div className="landing">
      <div className="landing-brand">
        <span className="landing-mark" style={{ background: THEME.train.bg, color: THEME.train.fg }}>
          <Mark size={28} strokeWidth={2.2} />
        </span>
        <h1>Gym Tracker</h1>
        <p className="muted">Registra tus entrenamientos y consúltalos desde cualquier dispositivo.</p>
      </div>

      <div className="chart-card">
        <div className="auth-tabs" role="tablist" aria-label="Acceso">
          <button
            type="button"
            role="tab"
            aria-selected={!signup}
            className={`auth-tab${!signup ? ' active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={signup}
            className={`auth-tab${signup ? ' active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="form-field">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {signup && (
            <div className="form-field">
              <label htmlFor="confirm">Repite la contraseña</label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? 'Un momento…' : signup ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="muted small" style={{ marginBottom: 0 }}>
          {signup
            ? 'Sin email no hay recuperación de contraseña: si la olvidas, no podrás recuperar la cuenta. '
            : ''}
          Si ya tenías datos en este dispositivo, se subirán a tu cuenta la primera vez.
        </p>
      </div>
    </div>
  )
}
