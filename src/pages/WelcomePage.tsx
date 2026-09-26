import React, { useState } from 'react'
import { useAuth } from '../AuthContext'
import { validateUsername } from '../services/supabase/auth'
import { THEME } from '../theme'

type Mode = 'signin' | 'signup'

const HIGHLIGHTS = [
  { ...THEME.train, label: 'Ejercicios y rutinas' },
  { ...THEME.planner, label: 'Planificación semanal' },
  { ...THEME.progress, label: 'Progreso visual' },
  { ...THEME.protein, label: 'Proteína diaria' },
]

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Usuario o contraseña incorrectos.'
  if (m.includes('email not confirmed')) {
    return 'La base de datos exige confirmar el email. Contacte con el administrador para arreglar el problema.'
  }
  if (m.includes('already registered')) return 'Ese nombre de usuario ya está en uso. Elige otro o inicia sesión.'
  if (m.includes('is invalid') || m.includes('email_address_invalid')) {
    return 'La base de datos ha rechazado el usuario.'
  }
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('rate limit')) return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.'
  if (m.includes('failed to fetch') || m.includes('networkerror')) return 'No se pudo conectar. Revisa tu conexión.'
  return message
}

export default function WelcomePage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
        setError('La base de datos exige confirmar el email. Contacte con el administrador para arreglar el problema.')
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
        <div className="landing-logo-row">
          <span className="landing-mark">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} width={60} height={60} alt="" />
          </span>
          <div>
            <h1 className="landing-wordmark">
              Gym<span className="landing-wordmark-accent">Tracker</span>
            </h1>
            <span className="landing-tagline">Tu entrenamiento en un solo lugar</span>
          </div>
        </div>
        <div className="landing-features">
          {HIGHLIGHTS.map(({ icon: Icon, fg, label }) => (
            <span key={label} className="landing-feature" style={{ color: fg }}>
              <Icon size={14} strokeWidth={2.4} /> {label}
            </span>
          ))}
        </div>
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
      </div>
    </div>
  )
}
