import React, { createContext, useContext, useEffect, useState } from 'react'
import { AppData, emptyAppData } from './types'
import { storageService } from './services'

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
      setDataState(loaded)
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
    setDataState((prev) => updater(prev))
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
