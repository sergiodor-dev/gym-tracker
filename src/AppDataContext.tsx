import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppData, Exercise, emptyAppData } from './types'
import { storageService } from './services'
import { getSyncInfo } from './services/syncStatus'
import { useAuth } from './AuthContext'
import { pruneOldSessions, resyncProteinDay } from './utils/retention'

interface AppDataContextValue {
  data: AppData
  setData: (updater: (prev: AppData) => AppData) => void
  loading: boolean
  // Vuelve a cargar los datos desde el storage (y, con sesión, desde la nube).
  reload: () => Promise<void>
  // data.exercises indexado por id, para no recorrer el array en cada fila que necesita
  // el nombre/grupo muscular de un ejercicio a partir de su id (WorkoutPage, RoutinesPage,
  // ProgressPage). Se recalcula solo cuando cambia la lista de ejercicios.
  exerciseMap: Map<string, Exercise>
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined)

// Antes de guardar tras un cambio de `data`, espera este margen por si llegan más cambios
// seguidos (p. ej. cada tecla al escribir el objetivo de proteína), para no escribir en
// localStorage en cada pulsación. SyncedStorageService ya debounce por su cuenta la subida
// a Supabase (ver PUSH_DELAY_MS); esto es aparte, para la escritura local.
const SAVE_DEBOUNCE_MS = 400

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth()
  const [data, setDataState] = useState<AppData>(emptyAppData)
  const [loading, setLoading] = useState(true)
  const loadCounter = useRef(0)
  const saveTimer = useRef<number | undefined>(undefined)
  const pendingSave = useRef<AppData | null>(null)

  const reload = useCallback(async () => {
    // Mientras `loading` es true no se guarda nada, para no escribir datos de un
    // usuario/estado anterior sobre los recién cargados.
    const id = ++loadCounter.current
    setLoading(true)
    const loaded = await storageService.load()
    if (id !== loadCounter.current) return // ya hay una carga más reciente en marcha

    // Por si el backup/storage trae sesiones más viejas que la ventana de retención
    // (ej. tras importar un JSON antiguo), o el contador de proteína quedó de un
    // "día de proteína" anterior (app cerrada desde antes de las 6 AM).
    setDataState({
      ...loaded,
      sessions: pruneOldSessions(loaded.sessions),
      protein: resyncProteinDay(loaded.protein),
    })
    setLoading(false)
  }, [])

  // Carga inicial y recarga al iniciar/cerrar sesión (cambia userId).
  useEffect(() => {
    void reload()
  }, [reload, userId])

  // Si la última sincronización falló (sin conexión o error), reintenta al volver la
  // conexión o al volver a la pestaña/app (útil en el móvil).
  useEffect(() => {
    const retry = () => {
      const { state } = getSyncInfo()
      if (state === 'offline' || state === 'error') void reload()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') retry()
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

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

  // Guarda automáticamente en cada cambio (tras la carga inicial), con un pequeño debounce
  // para no escribir en localStorage en cada tecla (ver SAVE_DEBOUNCE_MS).
  useEffect(() => {
    if (loading) return
    pendingSave.current = data
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      pendingSave.current = null
      storageService.save(data).catch((e) => console.error('No se pudo guardar', e))
    }, SAVE_DEBOUNCE_MS)
  }, [data, loading])

  // Si hay un guardado pendiente (debounce en curso) y la pestaña se oculta o se cierra, lo
  // fuerza ya en vez de esperar: localStorage.setItem es síncrono por debajo, así que la
  // escritura se completa aunque la promesa de storageService.save no llegue a resolverse.
  useEffect(() => {
    function flushPending() {
      if (!pendingSave.current) return
      window.clearTimeout(saveTimer.current)
      const toSave = pendingSave.current
      pendingSave.current = null
      storageService.save(toSave).catch(() => {})
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') flushPending()
    }
    window.addEventListener('beforeunload', flushPending)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', flushPending)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      flushPending()
    }
  }, [])

  const exerciseMap = useMemo(() => new Map(data.exercises.map((ex) => [ex.id, ex])), [data.exercises])

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
    <AppDataContext.Provider value={{ data, setData, loading, reload, exerciseMap }}>
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData debe usarse dentro de AppDataProvider')
  return ctx
}
