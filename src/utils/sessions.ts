import { ExerciseLog, Routine, SetLog, WorkoutSession } from '../types'
import { isSameDay } from './date'

// Enlaza las series registradas con los elementos (series) de la rutina: itemId -> serie registrada.
//  · Una serie con `itemId` se enlaza con ese elemento (si la rutina aún lo tiene).
//  · Las series antiguas, sin `itemId`, se reparten por orden entre los elementos del mismo ejercicio
//    que sigan sin registro (la 1.ª serie antigua con el 1.er elemento de ese ejercicio, etc.), de modo
//    que el historial anterior al cambio sigue contando como registrado.
// Las series de elementos que ya no están en la rutina se ignoran.
export function matchLoggedSets(routine: Pick<Routine, 'exercises'>, logs: ExerciseLog[]): Map<string, SetLog> {
  const matched = new Map<string, SetLog>()
  const itemIds = new Set(routine.exercises.map((it) => it.id))
  const legacy = new Map<string, SetLog[]>()

  for (const log of logs) {
    for (const set of log.sets) {
      if (set.itemId) {
        if (itemIds.has(set.itemId) && !matched.has(set.itemId)) matched.set(set.itemId, set)
      } else {
        legacy.set(log.exerciseId, [...(legacy.get(log.exerciseId) ?? []), set])
      }
    }
  }
  for (const item of routine.exercises) {
    if (matched.has(item.id)) continue
    const set = legacy.get(item.exerciseId)?.shift()
    if (set) matched.set(item.id, set)
  }
  return matched
}

export interface RoutineProgress {
  matched: Map<string, SetLog>
  total: number
  done: number
  requiredTotal: number
  requiredDone: number
  optionalTotal: number
  optionalDone: number
  completed: boolean
}

// Progreso de una rutina a partir de los registros de un día. Una rutina está completada cuando todas
// sus series OBLIGATORIAS están registradas; las opcionales no cuentan. Si no tiene ninguna
// obligatoria, basta con haber registrado alguna serie.
export function routineProgress(routine: Pick<Routine, 'exercises'>, logs: ExerciseLog[]): RoutineProgress {
  const matched = matchLoggedSets(routine, logs)
  const required = routine.exercises.filter((it) => it.required)
  const optional = routine.exercises.filter((it) => !it.required)
  const requiredDone = required.filter((it) => matched.has(it.id)).length
  const optionalDone = optional.filter((it) => matched.has(it.id)).length
  const done = requiredDone + optionalDone
  const completed =
    routine.exercises.length > 0 && (required.length > 0 ? requiredDone === required.length : done > 0)
  return {
    matched,
    total: routine.exercises.length,
    done,
    requiredTotal: required.length,
    requiredDone,
    optionalTotal: optional.length,
    optionalDone,
    completed,
  }
}

// Una rutina cuenta como "completada" en un día cuando existe una sesión de ese día para ella y están
// registradas todas sus series obligatorias (ver routineProgress). No basta con que exista la sesión:
// el progreso se guarda serie a serie, así que puede haber una sesión a medio completar.
export function isRoutineCompletedOn(
  routine: Pick<Routine, 'id' | 'exercises'>,
  sessions: WorkoutSession[],
  day: Date,
): boolean {
  const session = sessions.find((s) => s.routineId === routine.id && isSameDay(s.date, day))
  if (!session) return false
  return routineProgress(routine, session.exerciseLogs).completed
}

export const isRoutineCompletedToday = (
  routine: Pick<Routine, 'id' | 'exercises'>,
  sessions: WorkoutSession[],
): boolean => isRoutineCompletedOn(routine, sessions, new Date())

// Último registro de un ejercicio en el historial, sea de la rutina que sea (el peso pertenece al
// ejercicio, no a la rutina). `excludeSessionId` permite ignorar la sesión que se está editando
// ahora mismo, para que "la última vez" sea siempre una sesión anterior. `before` (exclusivo)
// descarta las sesiones posteriores a ese instante: al registrar un día pasado, "la última vez" es
// la anterior a ese día, no un entreno más reciente. El historial está acotado por la ventana de
// retención (ver utils/retention.ts).
export interface LastExerciseLog {
  sets: SetLog[]
  date: string // ISO de la sesión de la que sale
}

export function findLastExerciseLog(
  exerciseId: string,
  sessions: WorkoutSession[],
  excludeSessionId?: string,
  before?: Date,
): LastExerciseLog | null {
  let best: LastExerciseLog | null = null
  let bestTime = -Infinity
  for (const session of sessions) {
    if (session.id === excludeSessionId) continue
    const time = new Date(session.date).getTime()
    if (Number.isNaN(time) || time <= bestTime) continue
    if (before && time >= before.getTime()) continue
    const log = session.exerciseLogs.find((l) => l.exerciseId === exerciseId && l.sets.length > 0)
    if (!log) continue
    best = { sets: log.sets, date: session.date }
    bestTime = time
  }
  return best
}

// "3×10 @ 40 kg" si todas las series son iguales; si no, serie a serie: "10 @ 40 · 8 @ 42.5 kg".
export function formatSetsSummary(sets: SetLog[]): string {
  if (sets.length === 0) return ''
  const first = sets[0]
  const uniform = sets.every((s) => s.reps === first.reps && s.weight === first.weight)
  if (uniform) return `${sets.length}×${first.reps} @ ${first.weight} kg`
  return `${sets.map((s) => `${s.reps} @ ${s.weight}`).join(' · ')} kg`
}
