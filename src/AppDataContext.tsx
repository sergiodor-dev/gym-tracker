import React, { createContext, useContext, useEffect, useState } from 'react'
import { AppData, emptyAppData } from './types'
import { storageService } from './services'
import { pruneOldSessions, resyncProteinDay } from './utils/retention'

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
      // de retención (ej. tras importar un JSON antiguo), o el contador de
      // proteína quedó de un "día de proteína" anterior (app cerrada desde
      // antes de las 6 AM).
      setDataState({
        ...loaded,
        sessions: pruneOldSessions(loaded.sessions),
        protein: resyncProteinDay(loaded.protein),
      })
      setLoading(false)
    })
  }, [])

  // Revisa cada minuto si el "día de proteína" ha cambiado (corte a las
  // 6 AM), por si la app se queda abierta cruzando esa hora sin que haya
  // otra actualización que dispare el reinicio.
  useEffect(() => {
    const id = setInterval(() => {
      setDataState((prev) => {
        const protein = resyncProteinDay(prev.protein)
        return protein === prev.protein ? prev : { ...prev, protein }
      })
    }, 60_000)
    return () => clearInterval(id)
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
      // últimas PROGRESS_RETENTION_WEEKS semanas de datos, y se comprueba
      // que el contador de proteína siga correspondiendo al día actual.
      return { ...next, sessions: pruneOldSessions(next.sessions), protein: resyncProteinDay(next.protein) }
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