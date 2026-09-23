import { AppData, emptyAppData } from '../types'
import { StorageService } from './storageService'

const STORAGE_KEY = 'gym-tracker-data'

export class LocalStorageService implements StorageService {
  async load(): Promise<AppData> {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(emptyAppData)
    try {
      const parsed = JSON.parse(raw) as AppData
      return { ...structuredClone(emptyAppData), ...parsed }
    } catch {
      console.error('No se pudo parsear el backup local, se reinicia el estado')
      return structuredClone(emptyAppData)
    }
  }

  async save(data: AppData): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }
}
