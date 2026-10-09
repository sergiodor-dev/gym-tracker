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

// Un elemento de la rutina es UNA serie concreta de un ejercicio. La rutina es una lista ordenada de
// estos elementos, así que las series de distintos ejercicios se pueden intercalar (A, B, A, B…) y
// cada una se registra y se reordena por separado. Añadir un ejercicio con 4 series crea 4 elementos.
export interface RoutineExercise {
  id: string // id del elemento (de esta serie), único dentro de la rutina
  exerciseId: string
  reps: number // repeticiones objetivo
  weight: number // kg objetivo
  required: boolean // obligatoria (cuenta para completar la rutina) u opcional
}

// Formato anterior (un elemento por ejercicio con nº de series). Ya no se crea, pero puede llegar de
// localStorage, de un backup JSON o de la nube; ver utils/routineItems.ts, que lo convierte.
export interface LegacyRoutineExercise {
  exerciseId: string
  defaultSets: number
  defaultReps: number
  defaultWeight: number
}

// El campo se sigue llamando `exercises` (y la columna routines.exercises de Supabase, jsonb) para no
// tener que migrar la base de datos: solo cambia la forma de cada elemento.
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
  // Elemento de la rutina (RoutineExercise.id) al que corresponde esta serie. Las series registradas
  // antes de este cambio no lo tienen; ver matchLoggedSets en utils/sessions.ts.
  itemId?: string
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

// ----- Calculadora de agua diaria -----
// Igual que la de proteína: solo se guarda el consumo del día actual (mismo "día" con corte a las
// 6:00, ver resyncWaterDay en utils/retention.ts) y el objetivo diario configurado.
export interface WaterEntry {
  id: string
  ml: number
  time: string // ISO
}

export interface WaterTracker {
  targetMl: number // objetivo diario en mililitros (0 = sin definir)
  dayKey: string // clave del día actual, ver proteinDayKey()
  entries: WaterEntry[] // registros del día actual
}

export const emptyWaterTracker: WaterTracker = {
  targetMl: 0,
  dayKey: '',
  entries: [],
}

// ----- Pasos diarios -----
// Igual que proteína y agua: un único registro con el día actual (mismo "día" con corte a las 6:00,
// ver resyncStepsDay en utils/retention.ts). Cada caminata se guarda con el tiempo andado y la
// velocidad; los pasos se estiman a partir de ellos y de la altura (ver utils/steps.ts).
export interface StepEntry {
  id: string
  minutes: number // tiempo andado
  speedKmh: number // velocidad media
  time: string // ISO, cuándo se registró
}

export interface StepsTracker {
  targetSteps: number // objetivo diario en pasos (0 = sin definir)
  heightCm: number // altura, para estimar la longitud de zancada
  dayKey: string // clave del día actual, ver proteinDayKey()
  entries: StepEntry[] // caminatas del día actual
}

export const DEFAULT_HEIGHT_CM = 170

export const emptyStepsTracker: StepsTracker = {
  targetSteps: 0,
  heightCm: DEFAULT_HEIGHT_CM,
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
  water: WaterTracker
  steps: StepsTracker
}

export const emptyAppData: AppData = {
  exercises: [],
  routines: [],
  weeklyPlan: {},
  sessions: [],
  protein: emptyProteinTracker,
  water: emptyWaterTracker,
  steps: emptyStepsTracker,
}