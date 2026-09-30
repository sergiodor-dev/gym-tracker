import { useCallback, useEffect, useRef, useState } from 'react'
import { storageService } from '../services'
import type { WorkoutSession } from '../types'

// idle    → todavía no se pidió nada (en PC: esqueleto + botón "Cargar información…")
// loading → petición en curso (esqueleto + icono de carga)
// ready   → `sessions` listo para pintar el calendario
export type PreviousWeeksStatus = 'idle' | 'loading' | 'ready'

export interface PreviousWeeksState {
  status: PreviousWeeksStatus
  sessions: WorkoutSession[]
  // true = la nube no respondió y se muestran los datos guardados en este dispositivo
  fromDevice: boolean
}

// Estado de la carga bajo demanda del calendario de semanas anteriores. Se usa una sola vez en
// PlannerPage y se comparte con el calendario de PC (inline) y el de móvil (modal), para que
// abrir uno u otro no duplique la petición.
export function usePreviousWeeks() {
  const [state, setState] = useState<PreviousWeeksState>({ status: 'idle', sessions: [], fromDevice: false })
  const statusRef = useRef<PreviousWeeksStatus>('idle')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // `force` ignora lo ya cargado y vuelve a pedirlo (botón "Reintentar").
  const load = useCallback(async (force = false) => {
    if (statusRef.current === 'loading') return
    if (statusRef.current === 'ready' && !force) return
    statusRef.current = 'loading'
    setState((prev) => ({ ...prev, status: 'loading' }))
    let next: PreviousWeeksState
    try {
      const { sessions, fromDevice } = await storageService.loadPreviousWeeksSessions(force)
      next = { status: 'ready', sessions, fromDevice }
    } catch (e) {
      console.error('No se pudo cargar el calendario', e)
      next = { status: 'ready', sessions: [], fromDevice: true }
    }
    statusRef.current = next.status
    if (mounted.current) setState(next)
  }, [])

  return { ...state, load }
}
