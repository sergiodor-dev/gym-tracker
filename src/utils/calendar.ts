import { AppData } from '../types'
import { addDays, isSameDay, sessionDateForDay, startOfWeek } from './date'
import { PROGRESS_RETENTION_WEEKS } from './retention'
import { isRoutineCompletedOn } from './sessions'

// Estado de una rutina en un día pasado del calendario, según lo que se registró ese día:
// - done: la sesión tiene registro de todos los ejercicios de la rutina
// - partial: hay sesión pero faltan ejercicios (el progreso se guarda ejercicio a ejercicio)
// El calendario NO se compara con el plan semanal: solo muestra lo que realmente se registró.
export type CalendarStatus = 'done' | 'partial'

export interface CalendarEntry {
  routineId: string
  name: string
  status: CalendarStatus
}

export interface CalendarDay {
  date: Date
  // Rutinas con sesión registrada ese día (vacío = "Sin datos").
  entries: CalendarEntry[]
  // ¿Se puede registrar o editar una sesión ese día? Hace falta que la fecha con la que se guardaría
  // (mediodía local, ver sessionDateForDay) caiga dentro de la ventana de retención: si no, la sesión
  // se descartaría nada más crearla (ver pruneOldSessions).
  editable: boolean
}

export interface CalendarWeek {
  monday: Date
  days: CalendarDay[]
}

const DAY_MS = 24 * 60 * 60 * 1000
// Margen sobre el corte de retención para ofrecer un día como editable: pruneOldSessions se aplica
// cada minuto, y no se quiere ofrecer un día cuya sesión caduca mientras se está editando.
const EDITABLE_MARGIN_MS = 60 * 60 * 1000

// Semanas anteriores a la actual (la más reciente primero), tantas como PROGRESS_RETENTION_WEEKS.
// Se basa en `sessions`, que ya contiene toda la ventana de retención (viene de Supabase con sesión o
// de localStorage sin ella). Cada sesión se sitúa por su fecha (día de calendario local).
export function buildPreviousWeeks(
  data: Pick<AppData, 'routines' | 'sessions'>,
  now: Date = new Date(),
  weeks: number = PROGRESS_RETENTION_WEEKS,
): CalendarWeek[] {
  // Mismo criterio de corte que pruneOldSessions.
  const cutoff = now.getTime() - weeks * 7 * DAY_MS
  const thisMonday = startOfWeek(now)
  const result: CalendarWeek[] = []

  for (let w = 1; w <= weeks; w++) {
    const monday = addDays(thisMonday, -7 * w)
    const days: CalendarDay[] = []

    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i)
      const entries: CalendarEntry[] = []
      for (const routine of data.routines) {
        if (!data.sessions.some((s) => s.routineId === routine.id && isSameDay(s.date, date))) continue
        const done = isRoutineCompletedOn(routine, data.sessions, date)
        entries.push({ routineId: routine.id, name: routine.name, status: done ? 'done' : 'partial' })
      }
      // Sesiones de rutinas eliminadas se conservan en el historial, pero no hay nombre que mostrar.
      const editable = new Date(sessionDateForDay(date, now)).getTime() >= cutoff + EDITABLE_MARGIN_MS
      days.push({ date, entries, editable })
    }

    // La semana más antigua puede quedar entera fuera de la ventana: no se muestra.
    if (days.every((d) => !d.editable && d.entries.length === 0)) continue
    result.push({ monday, days })
  }

  return result
}
