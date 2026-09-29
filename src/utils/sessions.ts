import { Routine, SetLog, WorkoutSession } from '../types'
import { isSameDay } from './date'

// Una rutina cuenta como "completada" en un día cuando existe una sesión de ese día para ella
// Y esa sesión tiene un registro para cada uno de los ejercicios que la rutina tiene
// actualmente. No basta con que exista la sesión: desde que el progreso se guarda
// ejercicio a ejercicio (ver WorkoutPage.saveExercise/persistSession), puede haber una
// sesión a medio completar.
export function isRoutineCompletedOn(
  routine: Pick<Routine, 'id' | 'exercises'>,
  sessions: WorkoutSession[],
  day: Date,
): boolean {
  if (routine.exercises.length === 0) return false
  const session = sessions.find((s) => s.routineId === routine.id && isSameDay(s.date, day))
  if (!session) return false
  const loggedIds = new Set(session.exerciseLogs.map((el) => el.exerciseId))
  return routine.exercises.every((re) => loggedIds.has(re.exerciseId))
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
