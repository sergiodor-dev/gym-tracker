import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../config'
import { getAccessToken, refreshSession } from './auth'

// Wrapper fino sobre la API REST de datos de Supabase (PostgREST):
//   GET    /rest/v1/{tabla}?select=col1,col2&order=col.asc   → leer
//   POST   /rest/v1/{tabla}  (+ Prefer: resolution=merge-duplicates) → insertar o actualizar (upsert)
//   DELETE /rest/v1/{tabla}?col=in.("a","b")                  → borrar
//
// Cabeceras: `apikey` identifica el proyecto; `Authorization: Bearer <JWT del usuario>`
// es lo que hace que RLS sepa quién eres (auth.uid()).

interface RestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  prefer?: string
}

export async function rest<T = void>(path: string, options: RestOptions = {}): Promise<T> {
  const call = (token: string) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: options.method ?? 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.prefer ? { Prefer: options.prefer } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })

  let token = await getAccessToken()
  if (!token) throw new Error('No hay sesión iniciada')

  let res = await call(token)
  if (res.status === 401) {
    // El token pudo caducar entre medias: se renueva y se reintenta una vez.
    token = await refreshSession()
    if (!token) throw new Error('La sesión ha caducado. Vuelve a iniciar sesión.')
    res = await call(token)
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(err.message || `Error ${res.status} al hablar con Supabase`)
  }

  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
