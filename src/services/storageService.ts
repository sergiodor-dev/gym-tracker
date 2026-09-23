import { AppData } from '../types'

// Interfaz que abstrae la persistencia.
// Fase 1: implementada con localStorage (ver localStorageService.ts).
// Fase 2: se puede crear un "supabaseService.ts" que implemente esta misma
// interfaz (con métodos async reales contra la API REST de Supabase) y
// cambiar únicamente la instancia exportada en index.ts, sin tocar el resto
// de la app.
export interface StorageService {
  load(): Promise<AppData>
  save(data: AppData): Promise<void>
}
