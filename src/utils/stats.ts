import { Routine, SetLog, WeeklyPlan, WorkoutSession } from '../types'
import { addDays, localDayKey, startOfWeek } from './date'
import { PROGRESS_RETENTION_WEEKS } from './retention'

// Métricas derivadas del historial de sesiones (1RM estimado, volumen, récords, adherencia y
// racha). Todo son funciones puras sobre `data`: nada se guarda aparte, así que no cambia el
// modelo de datos ni el esquema de Supabase. Ojo: solo ven las sesiones que existen, y esas
// están acotadas por la ventana de retención (ver utils/retention.ts).

// ---- 1RM estimado y volumen ----

// La fórmula de Epley deja de ser fiable con muchas repeticiones, así que las series de más de
// 12 reps no producen 1RM estimado.
export const E1RM_MAX_REPS = 12

const round1 = (n: number) => Math.round(n * 10) / 10

// Sin decimales sobrantes: 62.5 -> "62.5", 60 -> "60".
export const formatKg = (n: number) => String(round1(n))

// 1RM estimado de una serie (Epley: peso × (1 + reps/30); con 1 rep es el propio peso).
// 0 si no hay carga (peso corporal) o la serie no es apta.
export function estimateOneRepMax(set: SetLog): number {
  if (set.weight <= 0 || set.reps < 1 || set.reps > E1RM_MAX_REPS) return 0
  return round1(set.reps === 1 ? set.weight : set.weight * (1 + set.reps / 30))
}

export const bestOneRepMax = (sets: SetLog[]): number => Math.max(0, ...sets.map(estimateOneRepMax))
export const maxWeightOf = (sets: SetLog[]): number => Math.max(0, ...sets.map((s) => s.weight))

// Volumen = Σ reps × peso (kg). Los ejercicios sin carga suman 0.
export const setsVolume = (sets: SetLog[]): number => sets.reduce((sum, s) => sum + s.reps * s.weight, 0)

// ---- Récords ----

export type RecordKind = 'weight' | 'e1rm'

export interface RecordEvent {
  sessionId: string
  exerciseId: string
  date: string
  kind: RecordKind
  value: number
  previous: number
}

export const recordKey = (sessionId: string, exerciseId: string) => `${sessionId}:${exerciseId}`

// Recorre el historial en orden cronológico y marca cada vez que un ejercicio supera SU mejor
// marca anterior, en peso máximo o en 1RM estimado. Reglas:
//  - La primera vez que aparece un ejercicio (o con carga por primera vez) solo fija la
//    referencia: no es récord porque no hay nada que superar.
//  - Empatar no cuenta; hay que superar estrictamente.
//  - La referencia es la mejor marca dentro del historial disponible, no de toda la vida.
export function detectRecords(sessions: WorkoutSession[]): RecordEvent[] {
  const ordered = sessions
    .map((session) => ({ session, time: new Date(session.date).getTime() }))
    .filter((x) => !Number.isNaN(x.time))
    .sort((a, b) => a.time - b.time)

  const bestWeight = new Map<string, number>()
  const bestE1rm = new Map<string, number>()
  const events: RecordEvent[] = []

  for (const { session } of ordered) {
    for (const log of session.exerciseLogs) {
      const weight = maxWeightOf(log.sets)
      const e1rm = bestOneRepMax(log.sets)
      const prevWeight = bestWeight.get(log.exerciseId) ?? 0
      const prevE1rm = bestE1rm.get(log.exerciseId) ?? 0
      const base = { sessionId: session.id, exerciseId: log.exerciseId, date: session.date }

      if (prevWeight > 0 && weight > prevWeight) events.push({ ...base, kind: 'weight', value: weight, previous: prevWeight })
      if (prevE1rm > 0 && e1rm > prevE1rm) events.push({ ...base, kind: 'e1rm', value: e1rm, previous: prevE1rm })

      if (weight > prevWeight) bestWeight.set(log.exerciseId, weight)
      if (e1rm > prevE1rm) bestE1rm.set(log.exerciseId, e1rm)
    }
  }
  return events
}

// Récords agrupados por (sesión, ejercicio), para marcar filas concretas en las listas.
export function groupRecordsByLog(events: RecordEvent[]): Map<string, RecordKind[]> {
  const map = new Map<string, RecordKind[]>()
  for (const e of events) {
    const key = recordKey(e.sessionId, e.exerciseId)
    map.set(key, [...(map.get(key) ?? []), e.kind])
  }
  return map
}

// ---- Adherencia y racha ----

// Un entreno planificado cuenta como cumplido si ese día se registró al menos esta fracción de
// los ejercicios que la rutina tiene ahora. No se exige el 100 % para que saltarse un último
// ejercicio no anule el día, y para que añadir ejercicios a una rutina más adelante no "descumpla"
// entrenos pasados. Pon 1 para exigir la rutina entera.
export const ADHERENCE_MIN_COMPLETION = 0.5

// Índice "rutina|día" -> ejercicios registrados ese día (une varias sesiones del mismo día, por si
// hubiera duplicados tras sincronizar dos dispositivos).
function indexLoggedExercises(sessions: WorkoutSession[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>()
  for (const s of sessions) {
    const time = new Date(s.date)
    if (Number.isNaN(time.getTime())) continue
    const key = `${s.routineId}|${localDayKey(time)}`
    const set = index.get(key) ?? new Set<string>()
    for (const log of s.exerciseLogs) if (log.sets.length > 0) set.add(log.exerciseId)
    index.set(key, set)
  }
  return index
}

function isRoutineDone(routine: Routine, day: Date, index: Map<string, Set<string>>): boolean {
  const logged = index.get(`${routine.id}|${localDayKey(day)}`)
  if (!logged) return false
  const covered = routine.exercises.filter((re) => logged.has(re.exerciseId)).length
  return covered >= Math.ceil(routine.exercises.length * ADHERENCE_MIN_COMPLETION)
}

// Rutinas planificadas para un día de la semana. Se ignoran las que ya no existen o no tienen
// ejercicios (no se pueden cumplir).
function plannedRoutinesOn(day: Date, plan: WeeklyPlan, routines: Routine[]): Routine[] {
  return (plan[day.getDay()] ?? [])
    .map((id) => routines.find((r) => r.id === id))
    .filter((r): r is Routine => Boolean(r) && r!.exercises.length > 0)
}

// Entrenos cumplidos / planificados en la semana actual (lunes a domingo). Se evalúa con la
// planificación actual: no se guarda qué plan había en semanas pasadas.
export function weeklyAdherence(
  plan: WeeklyPlan,
  routines: Routine[],
  sessions: WorkoutSession[],
  now: Date = new Date(),
): { planned: number; done: number } {
  const index = indexLoggedExercises(sessions)
  const monday = startOfWeek(now)
  let planned = 0
  let done = 0
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i)
    for (const routine of plannedRoutinesOn(day, plan, routines)) {
      planned++
      if (isRoutineDone(routine, day, index)) done++
    }
  }
  return { planned, done }
}

// Racha: entrenos planificados cumplidos de forma consecutiva hacia atrás desde hoy. Los días de
// descanso no la rompen (no hay nada planificado); un día planificado sin cumplir, sí. El día de
// hoy, si aún no se ha entrenado, no rompe la racha (todavía se puede hacer). `capped` indica que
// la racha llega hasta el límite del historial disponible, es decir, que podría ser mayor.
export function plannedStreak(
  plan: WeeklyPlan,
  routines: Routine[],
  sessions: WorkoutSession[],
  now: Date = new Date(),
  weeks: number = PROGRESS_RETENTION_WEEKS,
): { count: number; capped: boolean } {
  const index = indexLoggedExercises(sessions)
  const today = addDays(now, 0)
  // El día más antiguo de la ventana está recortado a media jornada, así que no se evalúa.
  const maxDays = weeks * 7 - 1
  let count = 0

  for (let i = 0; i < maxDays; i++) {
    const day = addDays(today, -i)
    const planned = plannedRoutinesOn(day, plan, routines)
    if (planned.length === 0) continue
    const doneAll = planned.every((r) => isRoutineDone(r, day, index))
    if (doneAll) count += planned.length
    else if (i > 0) return { count, capped: false }
  }
  return { count, capped: count > 0 }
}
