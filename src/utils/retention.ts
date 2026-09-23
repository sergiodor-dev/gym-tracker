import { WorkoutSession } from '../types'

// Ventana de retención del historial de entrenamientos (sesiones).
// Se mantiene deliberadamente baja para no sobrecargar el almacenamiento
// (localStorage en Fase 1, y también pensando en Fase 2 con Supabase,
// donde cada sesión viajará por la API REST).
export const PROGRESS_RETENTION_WEEKS = 8

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
