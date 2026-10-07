import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppData, Exercise, emptyAppData } from './types'
import { storageService } from './services'
import { getSyncInfo } from './services/syncStatus'
import { useAuth } from './AuthContext'
import { pruneOldSessions, resyncProteinDay, resyncWaterDay } from './utils/retention'

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

type Updater = (prev: AppData) => AppData

// Recorta el historial a la ventana de retención (PROGRESS_RETENTION_WEEKS) y comprueba que el
// contador de proteína y el de agua sigan correspondiendo al día actual. Se aplica a todo dato que entra al
// estado: lo cargado del storage y cada actualización (incluida una importación de JSON).
function normalizeData(d: AppData): AppData {
  return {
    ...d,
    sessions: pruneOldSessions(d.sessions),
    protein: resyncProteinDay(d.protein),
    water: resyncWaterDay(d.water),
  }
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth()
  const [data, setDataState] = useState<AppData>(emptyAppData)
  const [loading, setLoading] = useState(true)
  const loadCounter = useRef(0)
  const saveTimer = useRef<number | undefined>(undefined)
  const pendingSave = useRef<AppData | null>(null)
  // ¿Hay una carga en curso? Mientras la haya, `data` no se guarda (ver el efecto de guardado)
  // y cada setData se anota además en `editQueue` para no perderlo (ver loadData).
  const loadingRef = useRef(true)
  const editQueue = useRef<Updater[]>([])

  // Escribe ya lo que esté esperando en el debounce de guardado, sin esperar a SAVE_DEBOUNCE_MS.
  const flushPendingSave = useCallback((): Promise<void> => {
    window.clearTimeout(saveTimer.current)
    const toSave = pendingSave.current
    pendingSave.current = null
    if (!toSave) return Promise.resolve()
    return storageService.save(toSave).catch((e) => console.error('No se pudo guardar', e))
  }, [])

  // `sameAccount` distingue dos casos:
  //   · true  (reintento tras un fallo de sync, "Sincronizar ahora"): mismo usuario. Antes de
  //     cargar se guarda lo pendiente del debounce, para que `load` lo encuentre en el storage.
  //   · false (carga inicial o cambio de sesión): lo pendiente pertenece a otro usuario/estado,
  //     así que se descarta en vez de guardarlo o reaplicarlo sobre los datos nuevos.
  const loadData = useCallback(
    async (sameAccount: boolean) => {
      const id = ++loadCounter.current
      // Mientras `loading` es true no se guarda nada, para no escribir datos de un
      // usuario/estado anterior sobre los recién cargados.
      loadingRef.current = true
      setLoading(true)

      if (sameAccount) {
        await flushPendingSave()
      } else {
        window.clearTimeout(saveTimer.current)
        pendingSave.current = null
        editQueue.current = []
      }

      const loaded = await storageService.load()
      if (id !== loadCounter.current) return // ya hay una carga más reciente en marcha

      // Cambios hechos por el usuario mientras cargaba (la carga con sesión espera a la red y
      // puede tardar segundos): `loaded` no los incluye y reemplazar el estado los borraría, así
      // que se reaplican sobre lo cargado. Los updaters son funciones de `prev`, por eso valen.
      const edits = editQueue.current
      editQueue.current = []
      loadingRef.current = false

      // normalizeData: por si el backup/storage trae sesiones más viejas que la ventana de
      // retención (ej. tras importar un JSON antiguo), o el contador de proteína quedó de un
      // "día de proteína" anterior (app cerrada desde antes de las 6 AM).
      setDataState(normalizeData(edits.reduce((acc, update) => update(acc), loaded)))
      setLoading(false)
    },
    [flushPendingSave],
  )

  // Vuelve a cargar los datos del mismo usuario (reintentos de sync, botón "Sincronizar ahora").
  const reload = useCallback(() => loadData(true), [loadData])

  // Carga inicial y recarga al iniciar/cerrar sesión (cambia userId).
  useEffect(() => {
    void loadData(false)
  }, [loadData, userId])

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

  // Revisa cada minuto si el "día de proteína"/agua ha cambiado (corte a las 6 AM) y si alguna
  // sesión ha salido de la ventana de retención, por si la app se queda abierta sin que haya
  // otra actualización que dispare esas comprobaciones.
  useEffect(() => {
    const id = setInterval(() => {
      setDataState((prev) => {
        const sessions = pruneOldSessions(prev.sessions)
        const protein = resyncProteinDay(prev.protein)
        const water = resyncWaterDay(prev.water)
        if (sessions.length === prev.sessions.length && protein === prev.protein && water === prev.water) return prev
        return { ...prev, sessions, protein, water }
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
    saveTimer.current = window.setTimeout(() => void flushPendingSave(), SAVE_DEBOUNCE_MS)
  }, [data, loading, flushPendingSave])

  // Si hay un guardado pendiente (debounce en curso) y la pestaña se oculta o se cierra, lo
  // fuerza ya en vez de esperar: localStorage.setItem es síncrono por debajo, así que la
  // escritura se completa aunque la promesa de storageService.save no llegue a resolverse.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') void flushPendingSave()
    }
    const onBeforeUnload = () => void flushPendingSave()
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void flushPendingSave()
    }
  }, [flushPendingSave])

  const exerciseMap = useMemo(() => new Map(data.exercises.map((ex) => [ex.id, ex])), [data.exercises])

  // Con identidad estable (useCallback sin dependencias: solo usa refs y el setter de estado) para
  // que quien la reciba pueda usarla en dependencias de efectos/memos sin re-ejecutarlos.
  const setData = useCallback((updater: Updater) => {
    // Con una carga en curso, el cambio se ve ya en pantalla pero además se anota para
    // reaplicarlo sobre lo que devuelva la carga (ver loadData).
    if (loadingRef.current) editQueue.current.push(updater)
    // Se normaliza en cada actualización (nuevas sesiones, ediciones o importaciones) para
    // mantener siempre como máximo las últimas PROGRESS_RETENTION_WEEKS semanas de datos.
    setDataState((prev) => normalizeData(updater(prev)))
  }, [])

  // El valor del contexto solo cambia cuando cambia alguno de sus campos. Con un objeto literal
  // nuevo en cada render, cualquier re-render del proveedor por otro motivo (p. ej. un cambio en
  // AuthContext, como cerrar la splash) volvía a renderizar a todos los que usan useAppData.
  const value = useMemo(
    () => ({ data, setData, loading, reload, exerciseMap }),
    [data, setData, loading, reload, exerciseMap],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData debe usarse dentro de AppDataProvider')
  return ctx
}
