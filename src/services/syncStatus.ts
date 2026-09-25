import { useSyncExternalStore } from 'react'

// Estado de sincronización compartido entre la capa de servicios y la UI.
//   local   → sin sesión: los datos solo viven en este dispositivo
//   syncing → subiendo o descargando
//   synced  → la nube está al día
//   offline → sin conexión (los cambios quedan guardados en el dispositivo)
//   error   → la nube respondió con un error (ver `message`)
export type SyncState = 'local' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncInfo {
  state: SyncState
  message?: string
  lastSync?: number // epoch ms
}

let info: SyncInfo = { state: 'local' }
const listeners = new Set<() => void>()

export function setSyncInfo(next: SyncInfo) {
  info = next
  listeners.forEach((l) => l())
}

export function getSyncInfo(): SyncInfo {
  return info
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSyncInfo(): SyncInfo {
  return useSyncExternalStore(subscribe, getSyncInfo)
}

// Texto legible del estado de sync, compartido por la página Cuenta y el indicador del
// BottomNav para que ambos digan siempre lo mismo.
export function syncLabel(sync: SyncInfo): string {
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
