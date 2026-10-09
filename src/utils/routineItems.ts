import type { LegacyRoutineExercise, Routine, RoutineExercise } from '../types'

type StoredItem = RoutineExercise | LegacyRoutineExercise

const isLegacy = (item: StoredItem): item is LegacyRoutineExercise => !('id' in item) || typeof item.id !== 'string'

// Convierte las rutinas guardadas con el formato anterior (un elemento por ejercicio con "N series")
// al actual (un elemento por serie): cada ejercicio de N series pasa a N elementos obligatorios, que
// es lo que exigía antes completar la rutina. Los ids son deterministas (rutina, posición, serie) para
// que cada dispositivo, y la nube, generen los mismos ids y no diverjan. Si nada es antiguo devuelve
// el mismo array, para no invalidar los memos ni provocar una subida a la nube.
export function normalizeRoutines(routines: Routine[]): Routine[] {
  if (!routines.some((r) => (r.exercises as StoredItem[]).some(isLegacy))) return routines
  return routines.map((r) => {
    const items = r.exercises as StoredItem[]
    if (!items.some(isLegacy)) return r
    const exercises = items.flatMap((item, i): RoutineExercise[] => {
      if (!isLegacy(item)) return [item]
      const sets = Math.max(1, Math.round(Number(item.defaultSets)) || 1)
      return Array.from({ length: sets }, (_, s) => ({
        id: `${r.id}:${i}:${s}`,
        exerciseId: item.exerciseId,
        reps: Number(item.defaultReps) || 10,
        weight: Number(item.defaultWeight) || 0,
        required: true,
      }))
    })
    return { ...r, exercises }
  })
}

// Posición de cada elemento entre los de su mismo ejercicio ("serie 2 de 4"), en el orden de la lista.
export function setOrdinals(items: RoutineExercise[]): Map<string, { n: number; of: number }> {
  const totals = new Map<string, number>()
  for (const it of items) totals.set(it.exerciseId, (totals.get(it.exerciseId) ?? 0) + 1)
  const seen = new Map<string, number>()
  const result = new Map<string, { n: number; of: number }>()
  for (const it of items) {
    const n = (seen.get(it.exerciseId) ?? 0) + 1
    seen.set(it.exerciseId, n)
    result.set(it.id, { n, of: totals.get(it.exerciseId) ?? n })
  }
  return result
}

// Nº de ejercicios distintos de una rutina (sus series se agrupan por exerciseId).
export const countExercises = (items: { exerciseId: string }[]): number => new Set(items.map((it) => it.exerciseId)).size
