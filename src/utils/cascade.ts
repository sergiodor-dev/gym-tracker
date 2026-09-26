import { AppData, WeeklyPlan } from '../types'

// Quita un ejercicio de todas partes donde se referencia: el catálogo, las rutinas que lo
// incluyan y los registros de progreso ya guardados. Centralizado aquí para no repetir esta
// cascada en cada sitio que borra un ejercicio (hoy solo ExercisesPage, pero evita que un
// futuro punto de borrado se olvide de alguna de las tres partes).
export function cascadeDeleteExercise(data: AppData, exerciseId: string): AppData {
  return {
    ...data,
    exercises: data.exercises.filter((ex) => ex.id !== exerciseId),
    routines: data.routines.map((r) => ({
      ...r,
      exercises: r.exercises.filter((re) => re.exerciseId !== exerciseId),
    })),
    sessions: data.sessions.map((s) => ({
      ...s,
      exerciseLogs: s.exerciseLogs.filter((el) => el.exerciseId !== exerciseId),
    })),
  }
}

// Quita una rutina del catálogo y de la planificación semanal (weeklyPlan) donde esté
// asignada. Las sesiones ya guardadas con esa rutina se conservan (su historial de progreso
// sigue siendo válido; WorkoutPage y PlannerPage ya toleran un routineId que ya no exista).
export function cascadeDeleteRoutine(data: AppData, routineId: string): AppData {
  return {
    ...data,
    routines: data.routines.filter((r) => r.id !== routineId),
    weeklyPlan: Object.fromEntries(
      (Object.entries(data.weeklyPlan) as [string, string[]][]).map(
        ([day, ids]): [string, string[]] => [day, ids.filter((id) => id !== routineId)],
      ),
    ) as WeeklyPlan,
  }
}
