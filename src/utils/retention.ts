import { ProteinTracker, WorkoutSession } from '../types'
import { proteinDayKey } from './date'

// Ventana de retención del historial de entrenamientos (sesiones).
// Se mantiene deliberadamente baja para no sobrecargar el almacenamiento
// (localStorage en Fase 1, y también pensando en Fase 2 con Supabase,
// donde cada sesión viajará por la API REST).
export const PROGRESS_RETENTION_WEEKS = 6

// Descarta las sesiones más antiguas que la ventana de retención, tomando
// como referencia el momento actual. Se aplica tanto a datos cargados desde
// el storage como a cada actualización (incluida la importación de un JSON),
// de forma que el historial nunca supere las últimas N semanas.
export function pruneOldSessions(
  sessions: WorkoutSession[],
  weeks: number = PROGRESS_RETENTION_WEEKS,
): WorkoutSession[] {
  const cutoff = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000
  return sessions.filter((s) => {
    const t = new Date(s.date).getTime()
    return !Number.isNaN(t) && t >= cutoff
  })
}

// Si el "día de proteína" actual (ver proteinDayKey, corte a las 6 AM) ya no
// coincide con el guardado, se reinician los registros del día pero se
// conserva el objetivo diario configurado. Se aplica igual que
// pruneOldSessions: al cargar los datos y en cada actualización.
export function resyncProteinDay(protein: ProteinTracker): ProteinTracker {
  const currentDayKey = proteinDayKey()
  if (protein.dayKey === currentDayKey) return protein
  return { ...protein, dayKey: currentDayKey, entries: [] }
}