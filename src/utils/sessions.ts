import { Routine, WorkoutSession } from '../types'
import { isToday } from './date'

// Una rutina cuenta como "completada hoy" cuando existe una sesión de hoy para ella
// Y esa sesión tiene un registro para cada uno de los ejercicios que la rutina tiene
// actualmente. No basta con que exista la sesión: desde que el progreso se guarda
// ejercicio a ejercicio (ver WorkoutPage.saveExercise/persistSession), puede haber una
// sesión de hoy a medio completar.
export function isRoutineCompletedToday(
  routine: Pick<Routine, 'id' | 'exercises'>,
  sessions: WorkoutSession[],
): boolean {
  if (routine.exercises.length === 0) return false
  const session = sessions.find((s) => s.routineId === routine.id && isToday(s.date))
  if (!session) return false
  const loggedIds = new Set(session.exerciseLogs.map((el) => el.exerciseId))
  return routine.exercises.every((re) => loggedIds.has(re.exerciseId))
}
