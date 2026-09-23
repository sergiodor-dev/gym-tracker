// ----- Entidades del dominio -----

export interface Exercise {
  id: string
  name: string
  muscleGroup: string
}

export interface RoutineExercise {
  exerciseId: string
  defaultSets: number
  defaultReps: number
  defaultWeight: number // kg
}

export interface Routine {
  id: string
  name: string
  exercises: RoutineExercise[]
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = domingo ... 6 = sábado

export interface WeeklyPlan {
  // por cada día de la semana, las rutinas asignadas (puede haber varias)
  [day: number]: string[] // array de routineId
}

export interface SetLog {
  reps: number
  weight: number
}

export interface ExerciseLog {
  exerciseId: string
  sets: SetLog[]
}

export interface WorkoutSession {
  id: string
  routineId: string
  date: string // ISO string
  exerciseLogs: ExerciseLog[]
}

// ----- Estructura completa exportable/importable en JSON -----
export interface AppData {
  exercises: Exercise[]
  routines: Routine[]
  weeklyPlan: WeeklyPlan
  sessions: WorkoutSession[]
}

export const emptyAppData: AppData = {
  exercises: [],
  routines: [],
  weeklyPlan: {},
  sessions: [],
}
