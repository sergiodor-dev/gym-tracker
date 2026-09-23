import { SUPABASE_ANON_KEY, SUPABASE_URL, USERNAME_EMAIL_DOMAIN } from '../../config'

// Cliente mínimo de la API de Auth de Supabase (GoTrue), sin supabase-js.
// Endpoints usados (todos bajo {SUPABASE_URL}/auth/v1):
//   POST /signup                              → crear cuenta
//   POST /token?grant_type=password           → iniciar sesión
//   POST /token?grant_type=refresh_token      → renovar el access token (caduca en ~1 h)
//   POST /logout                              → invalidar la sesión

export interface AuthSession {
  accessToken: string
  refreshToken: string
  expiresAt: number // segundos desde epoch
  user: { id: string; email: string }
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at?: number
  user: { id: string; email?: string }
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const SESSION_KEY = 'gym-tracker-auth'

type Listener = (session: AuthSession | null) => void
const listeners = new Set<Listener>()

function readStored(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    return null
  }
}

let current: AuthSession | null = readStored()
let refreshing: Promise<string | null> | null = null

function store(session: AuthSession | null) {
  current = session
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
  listeners.forEach((l) => l(session))
}

function toSession(json: TokenResponse): AuthSession {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_at ?? Math.floor(Date.now() / 1000) + json.expires_in,
    user: { id: json.user.id, email: json.user.email ?? '' },
  }
}

async function authRequest(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, string>
  if (!res.ok) {
    throw new AuthError(json.msg || json.error_description || json.message || `Error ${res.status}`, res.status)
  }
  return json
}

// ----- Nombre de usuario ⇄ email sintético -----
// Supabase identifica por email; el usuario solo ve y escribe su nombre de usuario.
const USERNAME_PATTERN = /^[a-z0-9_-]{3,30}$/

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

// Devuelve un mensaje de error, o null si el nombre es válido.
export function validateUsername(username: string): string | null {
  return USERNAME_PATTERN.test(normalizeUsername(username))
    ? null
    : 'El usuario debe tener de 3 a 30 caracteres: letras, números, guion o guion bajo.'
}

function usernameToEmail(username: string): string {
  const invalid = validateUsername(username)
  if (invalid) throw new Error(invalid)
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`
}

export function usernameOf(session: AuthSession): string {
  return session.user.email.split('@')[0]
}

export function getSession(): AuthSession | null {
  return current
}

export function onAuthChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function signIn(username: string, password: string): Promise<void> {
  const email = usernameToEmail(username)
  const json = (await authRequest('token?grant_type=password', { email, password })) as TokenResponse
  store(toSession(json))
}

// Si el proyecto tiene activado "Confirm email", /signup no devuelve sesión y la cuenta
// no se podría confirmar nunca (el email es ficticio): hay que desactivarlo en Supabase.
export async function signUp(username: string, password: string): Promise<'signed-in' | 'confirm-email'> {
  const email = usernameToEmail(username)
  const json = (await authRequest('signup', { email, password })) as Partial<TokenResponse>
  if (json.access_token) {
    store(toSession(json as TokenResponse))
    return 'signed-in'
  }
  return 'confirm-email'
}

export async function signOut(): Promise<void> {
  const token = current?.accessToken
  store(null)
  if (token) {
    // Mejor esfuerzo: si falla (sin red), la sesión local ya está cerrada.
    fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }
}

// Renueva el access token. Varias llamadas simultáneas comparten una sola petición
// (el refresh token es de un solo uso: repetirlo invalidaría la sesión).
export function refreshSession(): Promise<string | null> {
  if (!current) return Promise.resolve(null)
  if (!refreshing) {
    const refreshToken = current.refreshToken
    refreshing = (async () => {
      try {
        const json = (await authRequest('token?grant_type=refresh_token', {
          refresh_token: refreshToken,
        })) as TokenResponse
        store(toSession(json))
        return json.access_token
      } catch (e) {
        // Refresh token rechazado (4xx) → la sesión ya no vale. Un fallo de red (TypeError)
        // no cierra la sesión: se podrá reintentar al volver la conexión.
        if (e instanceof AuthError && e.status >= 400 && e.status < 500) store(null)
        throw e
      } finally {
        refreshing = null
      }
    })()
  }
  return refreshing
}

// Devuelve un access token válido, renovándolo si le queda menos de un minuto.
export async function getAccessToken(): Promise<string | null> {
  if (!current) return null
  if (current.expiresAt - 60 > Date.now() / 1000) return current.accessToken
  return refreshSession()
}
