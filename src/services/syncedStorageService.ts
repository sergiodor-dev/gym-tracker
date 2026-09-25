import { AppData, emptyAppData } from '../types'
import { isSupabaseConfigured } from '../config'
import { StorageService } from './storageService'
import { LocalStorageService } from './localStorageService'
import { SupabaseService } from './supabaseService'
import { getSession } from './supabase/auth'
import { setSyncInfo } from './syncStatus'

// Modelo mental:
//   · Sin sesión  → solo localStorage (idéntico a la Fase 1).
//   · Con sesión  → la nube es la fuente de verdad y localStorage actúa de caché, de modo
//                   que la app sigue funcionando sin conexión. Los cambios se suben con
//                   un pequeño retardo (debounce) y solo las filas que cambiaron.

const OWNER_KEY = 'gym-tracker-owner' // id del usuario al que pertenece la caché local
const UNSYNCED_KEY = 'gym-tracker-unsynced' // '1' = hay cambios locales aún sin subir
const BACKUP_KEY = 'gym-tracker-data-before-sync' // copia de seguridad si se reemplazan datos locales
const PUSH_DELAY_MS = 600
const RETRY_BASE_MS = 5_000 // primer reintento a los 5s de un fallo
const RETRY_MAX_MS = 120_000 // tope de 2 min entre reintentos

function hasContent(d: AppData): boolean {
  return (
    d.exercises.length > 0 ||
    d.routines.length > 0 ||
    d.sessions.length > 0 ||
    Object.values(d.weeklyPlan).some((ids) => ids.length > 0) ||
    d.protein.targetGrams > 0 ||
    d.protein.entries.length > 0
  )
}

function describeError(e: unknown): { offline: boolean; message: string } {
  const offline = !navigator.onLine || e instanceof TypeError // fetch sin red lanza TypeError
  return { offline, message: e instanceof Error ? e.message : String(e) }
}

export class SyncedStorageService implements StorageService {
  private local = new LocalStorageService()
  private remote = new SupabaseService()
  private remoteReady = false // ¿se descargó ya la nube en esta carga?
  private latest: AppData | null = null
  private timer: number | undefined
  private retryTimer: number | undefined
  private retryDelay = RETRY_BASE_MS // crece con cada fallo consecutivo (backoff)

  private get userId(): string | null {
    return isSupabaseConfigured ? (getSession()?.user.id ?? null) : null
  }

  get hasUnsyncedChanges(): boolean {
    return localStorage.getItem(UNSYNCED_KEY) === '1'
  }

  private setUnsynced(value: boolean) {
    if (value) localStorage.setItem(UNSYNCED_KEY, '1')
    else localStorage.removeItem(UNSYNCED_KEY)
  }

  async load(): Promise<AppData> {
    window.clearTimeout(this.timer)
    window.clearTimeout(this.retryTimer)
    this.remoteReady = false
    this.latest = null

    const local = await this.local.load()
    const uid = this.userId
    if (!uid) {
      setSyncInfo({ state: 'local' })
      return local
    }

    // owner === null → datos anónimos de la Fase 1 (candidatos a migrar a la cuenta)
    // owner === uid  → caché de esta misma cuenta
    // otro valor     → caché de otra cuenta: no se debe mezclar con esta
    const owner = localStorage.getItem(OWNER_KEY)
    const localUsable = owner === null || owner === uid
    // Cambios hechos sin conexión que no llegaron a subirse: ganan sobre la nube.
    const localWins = owner === uid && this.hasUnsyncedChanges
    const fallback = localUsable ? local : structuredClone(emptyAppData)

    setSyncInfo({ state: 'syncing' })
    try {
      const remote = await this.remote.load()
      this.remoteReady = true

      let result: AppData
      if (localWins) {
        result = local
      } else if (hasContent(remote)) {
        // Primer login en un dispositivo que ya tenía datos locales y la cuenta ya tiene
        // los suyos: gana la nube, pero se guarda una copia por si acaso.
        if (owner === null && hasContent(local)) localStorage.setItem(BACKUP_KEY, JSON.stringify(local))
        result = remote
      } else {
        // Cuenta vacía: se sube lo que haya en el dispositivo (migración desde la Fase 1).
        result = fallback
      }

      localStorage.setItem(OWNER_KEY, uid)
      await this.local.save(result)
      this.latest = result // para que flush() tenga qué subir si hay cambios pendientes

      const pending = this.remote.pendingChanges(result)
      this.setUnsynced(pending)
      if (pending) {
        // Había cambios sin subir (p.ej. hechos sin conexión): ahora que la nube
        // responde, se suben ya en vez de esperar a la próxima edición.
        setSyncInfo({ state: 'syncing' })
        void this.flush()
      } else {
        setSyncInfo({ state: 'synced', lastSync: Date.now() })
      }
      return result
    } catch (e) {
      const { offline, message } = describeError(e)
      setSyncInfo({ state: offline ? 'offline' : 'error', message })
      return fallback
    }
  }

  async save(data: AppData): Promise<void> {
    await this.local.save(data)
    if (!this.userId) return

    this.latest = data
    if (!this.remoteReady) {
      // La nube no se pudo cargar (sin conexión, error…): se acumula en local y se
      // marcará como pendiente para subirlo en la próxima carga con éxito.
      this.setUnsynced(true)
      return
    }
    if (!this.remote.pendingChanges(data)) {
      this.setUnsynced(false)
      return
    }
    this.setUnsynced(true)
    window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => void this.flush(), PUSH_DELAY_MS)
  }

  // Sube ya lo pendiente (sin esperar al debounce).
  async flush(): Promise<void> {
    window.clearTimeout(this.timer)
    const data = this.latest
    if (!this.remoteReady || !data || !this.userId) return

    if (!this.remote.pendingChanges(data)) {
      this.setUnsynced(false)
      setSyncInfo({ state: 'synced', lastSync: Date.now() })
      return
    }
    setSyncInfo({ state: 'syncing' })
    try {
      await this.remote.save(data)
      if (this.latest === data) this.setUnsynced(false) // por si llegó otro cambio mientras subía
      setSyncInfo({ state: 'synced', lastSync: Date.now() })
      window.clearTimeout(this.retryTimer)
      this.retryDelay = RETRY_BASE_MS // el próximo fallo vuelve a empezar por el retardo mínimo
    } catch (e) {
      const { offline, message } = describeError(e)
      setSyncInfo({ state: offline ? 'offline' : 'error', message })
      this.scheduleRetry()
    }
  }

  // Reintenta subir lo pendiente con backoff exponencial (5s, 10s, 20s… hasta un tope de
  // 2 min), para no machacar la API si el fallo persiste, y para no depender solo de que
  // el usuario edite algo o recupere la conexión para que se vuelva a intentar.
  private scheduleRetry() {
    window.clearTimeout(this.retryTimer)
    this.retryTimer = window.setTimeout(() => {
      if (this.hasUnsyncedChanges) void this.flush()
    }, this.retryDelay)
    this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS)
  }

  // Para cerrar sesión: intenta subir lo pendiente y borra los datos de este dispositivo
  // (siguen en la nube). Así la siguiente persona/cuenta no ve ni mezcla datos ajenos.
  async clearDeviceData(): Promise<void> {
    await this.flush()
    window.clearTimeout(this.retryTimer)
    this.retryDelay = RETRY_BASE_MS
    this.local.clear()
    ;[OWNER_KEY, UNSYNCED_KEY, BACKUP_KEY].forEach((k) => localStorage.removeItem(k))
    this.remoteReady = false
    this.latest = null
  }

  // Borra la cuenta: todos los datos en Supabase (ver SupabaseService.deleteAccount) y,
  // si eso funciona, también la caché de este dispositivo (ya no pertenece a ninguna
  // cuenta válida). No hay nada que subir después, así que se cancela el debounce
  // pendiente en vez de esperar a que termine.
  async deleteAccount(): Promise<void> {
    window.clearTimeout(this.timer)
    window.clearTimeout(this.retryTimer)
    this.retryDelay = RETRY_BASE_MS
    await this.remote.deleteAccount()
    this.local.clear()
    ;[OWNER_KEY, UNSYNCED_KEY, BACKUP_KEY].forEach((k) => localStorage.removeItem(k))
    this.remoteReady = false
    this.latest = null
  }
}
