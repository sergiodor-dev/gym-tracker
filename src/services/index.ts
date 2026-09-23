import { SyncedStorageService } from './syncedStorageService'

// Punto único de configuración de la persistencia.
// SyncedStorageService usa localStorage siempre (Fase 1) y, si hay Supabase configurado
// en src/config.ts y una sesión iniciada, sincroniza además con la nube (Fase 2).
// Implementa la interfaz StorageService (ver storageService.ts).
export const storageService = new SyncedStorageService()
