import React, { createContext, useContext, useEffect, useState } from 'react'
import { AppData, emptyAppData } from './types'
import { storageService } from './services'
import { pruneOldSessions } from './utils/retention'

interface AppDataContextValue {
  data: AppData
  setData: (updater: (prev: AppData) => AppData) => void
  loading: boolean
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined)

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataState] = useState<AppData>(emptyAppData)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    storageService.load().then((loaded) => {
      // Por si el backup/storage trae sesiones más viejas que la ventana
      // de retención (ej. tras importar un JSON antiguo).
      setDataState({ ...loaded, sessions: pruneOldSessions(loaded.sessions) })
      setLoading(false)
    })
  }, [])

  // Guarda automáticamente en cada cambio (tras la carga inicial)
  useEffect(() => {
    if (!loading) {
      storageService.save(data)
    }
  }, [data, loading])

  function setData(updater: (prev: AppData) => AppData) {
    setDataState((prev) => {
      const next = updater(prev)
      // Se recorta el historial en cada actualización (nuevas sesiones,
      // ediciones o importaciones) para mantener siempre como máximo las
      // últimas PROGRESS_RETENTION_WEEKS semanas de datos.
      return { ...next, sessions: pruneOldSessions(next.sessions) }
    })
  }

  return (
    <AppDataContext.Provider value={{ data, setData, loading }}>
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData debe usarse dentro de AppDataProvider')
  return ctx
}
