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

      const pending = this.remote.pendingChanges(result)
      this.setUnsynced(pending)
      setSyncInfo(pending ? { state: 'syncing' } : { state: 'synced', lastSync: Date.now() })
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
    } catch (e) {
      const { offline, message } = describeError(e)
      setSyncInfo({ state: offline ? 'offline' : 'error', message })
    }
  }

  // Para cerrar sesión: intenta subir lo pendiente y borra los datos de este dispositivo
  // (siguen en la nube). Así la siguiente persona/cuenta no ve ni mezcla datos ajenos.
  async clearDeviceData(): Promise<void> {
    await this.flush()
    this.local.clear()
    ;[OWNER_KEY, UNSYNCED_KEY, BACKUP_KEY].forEach((k) => localStorage.removeItem(k))
    this.remoteReady = false
    this.latest = null
  }
}
