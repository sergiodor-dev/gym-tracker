// ----- Entidades del dominio -----

export const MUSCLE_GROUPS = [
  'Pecho',
  'Espalda',
  'Hombro',
  'Brazo',
  'Pierna',
  'Glúteo',
  'Core',
  'Cardio',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup | ''
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

// ----- Calculadora de proteína diaria -----
// El "día de proteína" no coincide con el día de calendario: se reinicia a
// las PROTEIN_RESET_HOUR (6:00) del día siguiente, no a medianoche, para
// cubrir bien a quien come después de las 00:00 (ver utils/date.ts).
export interface ProteinEntry {
  id: string
  grams: number
  time: string // ISO
}

export interface ProteinTracker {
  targetGrams: number // objetivo diario en gramos (0 = sin definir)
  dayKey: string // clave del día de proteína actual, ver proteinDayKey()
  entries: ProteinEntry[] // registros del día de proteína actual
}

export const emptyProteinTracker: ProteinTracker = {
  targetGrams: 0,
  dayKey: '',
  entries: [],
}

// ----- Estructura completa exportable/importable en JSON -----
export interface AppData {
  exercises: Exercise[]
  routines: Routine[]
  weeklyPlan: WeeklyPlan
  sessions: WorkoutSession[]
  protein: ProteinTracker
}

export const emptyAppData: AppData = {
  exercises: [],
  routines: [],
  weeklyPlan: {},
  sessions: [],
  protein: emptyProteinTracker,
}