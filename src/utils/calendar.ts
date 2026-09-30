import { AppData } from '../types'
import { addDays, isSameDay, startOfWeek } from './date'
import { PROGRESS_RETENTION_WEEKS } from './retention'
import { isRoutineCompletedOn } from './sessions'

// Estado de una rutina en un día pasado del calendario:
// - done: hay sesión y tiene registro de todos los ejercicios de la rutina
// - partial: hay sesión pero quedó a medias (el progreso se guarda ejercicio a ejercicio)
// - missed: la rutina estaba planificada ese día de la semana y no hay sesión
export type CalendarStatus = 'done' | 'partial' | 'missed'

export interface CalendarEntry {
  routineId: string
  name: string
  status: CalendarStatus
}

export interface CalendarDay {
  date: Date
  entries: CalendarEntry[]
  // Día fuera del historial disponible (más antiguo que la ventana de retención o anterior a la
  // primera sesión registrada): no se puede saber qué pasó, así que no se marca nada como fallado.
  noData: boolean
}

export interface CalendarWeek {
  monday: Date
  days: CalendarDay[]
}

const DAY_MS = 24 * 60 * 60 * 1000

// Rango de fechas [from, to) que cubre el calendario: desde el lunes de hace `weeks` semanas hasta el
// lunes de la semana en curso (excluido). Es lo único que hay que pedir a la nube para pintarlo.
export function previousWeeksRange(
  now: Date = new Date(),
  weeks: number = PROGRESS_RETENTION_WEEKS,
): { from: Date; to: Date } {
  const to = startOfWeek(now)
  return { from: addDays(to, -7 * weeks), to }
}

// Semanas anteriores a la actual (la más reciente primero), tantas como PROGRESS_RETENTION_WEEKS.
// Se basa en `sessions`, que ya es lo que hay en Supabase (con sesión) o en localStorage (sin ella),
// recortado a la ventana de retención. Cada sesión se sitúa por su fecha (día de calendario local).
//
// Las rutinas "planificadas" de cada día salen del plan semanal ACTUAL: no se guarda historial de
// planes, así que si se cambia el plan, las semanas pasadas se comparan con el plan de hoy.
export function buildPreviousWeeks(
  data: Pick<AppData, 'routines' | 'weeklyPlan' | 'sessions'>,
  now: Date = new Date(),
  weeks: number = PROGRESS_RETENTION_WEEKS,
): CalendarWeek[] {
  // Mismo criterio de corte que pruneOldSessions.
  const cutoff = now.getTime() - weeks * 7 * DAY_MS
  const firstSession = data.sessions.reduce((min, s) => {
    const t = new Date(s.date).getTime()
    return Number.isNaN(t) ? min : Math.min(min, t)
  }, Infinity)

  const thisMonday = startOfWeek(now)
  const result: CalendarWeek[] = []

  for (let w = 1; w <= weeks; w++) {
    const monday = addDays(thisMonday, -7 * w)
    const days: CalendarDay[] = []

    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i)
      const endOfDay = addDays(date, 1).getTime()
      const noData = endOfDay <= cutoff || endOfDay <= firstSession

      const entries: CalendarEntry[] = []
      if (!noData) {
        // Planificadas ese día de la semana + las hechas aunque no estuvieran planificadas.
        const planned = data.weeklyPlan[date.getDay()] ?? []
        const done = data.sessions.filter((s) => isSameDay(s.date, date)).map((s) => s.routineId)
        for (const routineId of new Set([...planned, ...done])) {
          const routine = data.routines.find((r) => r.id === routineId)
          if (!routine) continue // rutina eliminada: sus sesiones se conservan pero no hay nombre que mostrar
          const hasSession = data.sessions.some((s) => s.routineId === routineId && isSameDay(s.date, date))
          const status: CalendarStatus = isRoutineCompletedOn(routine, data.sessions, date)
            ? 'done'
            : hasSession
              ? 'partial'
              : 'missed'
          entries.push({ routineId, name: routine.name, status })
        }
      }
      days.push({ date, entries, noData })
    }

    // La semana más antigua puede quedar entera fuera de la ventana: no se muestra.
    if (days.every((d) => d.noData)) continue
    result.push({ monday, days })
  }

  return result
}
