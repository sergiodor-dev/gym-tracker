import { LocalStorageService } from './localStorageService'
import { StorageService } from './storageService'

// Punto único de configuración de la persistencia.
// Cuando llegue la Fase 2, esto pasaría a ser:
//   export const storageService: StorageService = new SupabaseService()
export const storageService: StorageService = new LocalStorageService()
