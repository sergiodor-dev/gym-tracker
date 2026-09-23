import {
  AppData,
  ExerciseLog,
  MuscleGroup,
  ProteinEntry,
  RoutineExercise,
  WeeklyPlan,
  emptyProteinTracker,
} from '../types'
import { StorageService } from './storageService'
import { getSession } from './supabase/auth'
import { rest } from './supabase/rest'

// Persistencia en Supabase (PostgreSQL + API REST). Ver supabase/schema.sql.
//
// La interfaz StorageService trabaja con el AppData completo (load / save), pero mandar
// todo en cada cambio sería un desperdicio. Por eso este servicio recuerda qué había en
// la nube tras la última sincronización (`snapshot`) y en cada save() solo envía:
//   · upserts de las filas nuevas o modificadas
//   · deletes de las filas que ya no existen
// Estrategia de conflictos: "el último en escribir gana", fila a fila.

type Row = Record<string, unknown>
type TableName = 'exercises' | 'routines' | 'weekly_plan' | 'sessions' | 'protein'
type Collected = Record<TableName, Map<string, Row>>
type Snapshot = Record<TableName, Map<string, string>>

interface TableSpec {
  keyColumn: string // columna por la que se borra (junto con RLS, que filtra por usuario)
  collect: (data: AppData, uid: string) => Map<string, Row>
}

// AppData → filas de cada tabla, indexadas por su clave.
const TABLES: Record<TableName, TableSpec> = {
  exercises: {
    keyColumn: 'id',
    collect: (d, uid) =>
      new Map(
        d.exercises.map((e, i): [string, Row] => [
          e.id,
          { user_id: uid, id: e.id, name: e.name, muscle_group: e.muscleGroup, position: i },
        ]),
      ),
  },
  routines: {
    keyColumn: 'id',
    collect: (d, uid) =>
      new Map(
        d.routines.map((r, i): [string, Row] => [
          r.id,
          { user_id: uid, id: r.id, name: r.name, exercises: r.exercises, position: i },
        ]),
      ),
  },
  weekly_plan: {
    keyColumn: 'weekday',
    collect: (d, uid) =>
      new Map(
        Object.entries(d.weeklyPlan)
          .filter(([, ids]) => ids.length > 0)
          .map(([day, ids]): [string, Row] => [day, { user_id: uid, weekday: Number(day), routine_ids: ids }]),
      ),
  },
  sessions: {
    keyColumn: 'id',
    collect: (d, uid) =>
      new Map(
        d.sessions.map((s): [string, Row] => [
          s.id,
          { user_id: uid, id: s.id, routine_id: s.routineId, date: s.date, exercise_logs: s.exerciseLogs },
        ]),
      ),
  },
  protein: {
    keyColumn: 'user_id',
    collect: (d, uid) =>
      new Map<string, Row>([
        [
          uid,
          {
            user_id: uid,
            target_grams: d.protein.targetGrams,
            day_key: d.protein.dayKey,
            entries: d.protein.entries,
          },
        ],
      ]),
  },
}

const TABLE_NAMES = Object.keys(TABLES) as TableName[]

function collectAll(data: AppData, uid: string): Collected {
  const out = {} as Collected
  for (const t of TABLE_NAMES) out[t] = TABLES[t].collect(data, uid)
  return out
}

function serialize(rows: Map<string, Row>): Map<string, string> {
  return new Map([...rows].map(([k, row]): [string, string] => [k, JSON.stringify(row)]))
}

function diff(prev: Map<string, string>, next: Map<string, Row>) {
  const upserts: Row[] = []
  const nextSerialized = new Map<string, string>()
  for (const [key, row] of next) {
    const json = JSON.stringify(row)
    nextSerialized.set(key, json)
    if (prev.get(key) !== json) upserts.push(row)
  }
  const deletes = [...prev.keys()].filter((k) => !next.has(k))
  return { upserts, deletes, nextSerialized }
}

// Filtro PostgREST `col=in.("a","b")`. Los valores van entre comillas por si contienen
// caracteres reservados; la lista se codifica para la URL.
function inFilter(column: string, keys: string[]): string {
  const list = keys.map((k) => `"${k.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')
  return `${column}=in.(${encodeURIComponent(list)})`
}

// ----- Forma de las filas que devuelve la API -----
interface ExerciseRow { id: string; name: string; muscle_group: string }
interface RoutineRow { id: string; name: string; exercises: RoutineExercise[] }
interface WeeklyPlanRow { weekday: number; routine_ids: string[] }
interface SessionRow { id: string; routine_id: string; date: string; exercise_logs: ExerciseLog[] }
interface ProteinRow { target_grams: number; day_key: string; entries: ProteinEntry[] }

const DELETE_CHUNK = 100

export class SupabaseService implements StorageService {
  private snapshot: Snapshot | null = null
  private snapshotUid: string | null = null
  private pending: AppData | null = null
  private running: Promise<void> | null = null

  private uid(): string {
    const session = getSession()
    if (!session) throw new Error('No hay sesión iniciada')
    return session.user.id
  }

  // Descarga todo el estado de la cuenta (5 peticiones en paralelo) y lo toma como
  // punto de partida para calcular futuras diferencias.
  async load(): Promise<AppData> {
    const uid = this.uid()
    const [exercises, routines, weeklyPlan, sessions, protein] = await Promise.all([
      rest<ExerciseRow[]>('exercises?select=id,name,muscle_group&order=position.asc'),
      rest<RoutineRow[]>('routines?select=id,name,exercises&order=position.asc'),
      rest<WeeklyPlanRow[]>('weekly_plan?select=weekday,routine_ids'),
      rest<SessionRow[]>('sessions?select=id,routine_id,date,exercise_logs&order=date.asc'),
      rest<ProteinRow[]>('protein?select=target_grams,day_key,entries'),
    ])

    const data: AppData = {
      exercises: exercises.map((r) => ({ id: r.id, name: r.name, muscleGroup: r.muscle_group as MuscleGroup | '' })),
      routines: routines.map((r) => ({ id: r.id, name: r.name, exercises: r.exercises })),
      weeklyPlan: Object.fromEntries(weeklyPlan.map((r) => [r.weekday, r.routine_ids])) as WeeklyPlan,
      // Postgres devuelve timestamptz como "…+00:00": se normaliza al formato ISO de la app.
      sessions: sessions.map((r) => ({
        id: r.id,
        routineId: r.routine_id,
        date: new Date(r.date).toISOString(),
        exerciseLogs: r.exercise_logs,
      })),
      protein: protein[0]
        ? { targetGrams: Number(protein[0].target_grams), dayKey: protein[0].day_key, entries: protein[0].entries }
        : structuredClone(emptyProteinTracker),
    }

    this.setSnapshot(data, uid)
    return data
  }

  // ¿Hay algo que subir? (comparación local, sin red)
  pendingChanges(data: AppData): boolean {
    const uid = this.uid()
    if (!this.snapshot || this.snapshotUid !== uid) return true
    const next = collectAll(data, uid)
    return TABLE_NAMES.some((t) => {
      const { upserts, deletes } = diff(this.snapshot![t], next[t])
      return upserts.length > 0 || deletes.length > 0
    })
  }

  // Los guardados se serializan y se agrupan: si llegan varios mientras hay uno en curso,
  // solo se envía el estado más reciente.
  save(data: AppData): Promise<void> {
    this.pending = data
    if (this.running) return this.running
    this.running = (async () => {
      try {
        while (this.pending) {
          const next = this.pending
          this.pending = null
          await this.push(next)
        }
      } finally {
        this.running = null
      }
    })()
    return this.running
  }

  private setSnapshot(data: AppData, uid: string) {
    const collected = collectAll(data, uid)
    const snapshot = {} as Snapshot
    for (const t of TABLE_NAMES) snapshot[t] = serialize(collected[t])
    this.snapshot = snapshot
    this.snapshotUid = uid
  }

  private async push(data: AppData): Promise<void> {
    const uid = this.uid()
    if (!this.snapshot || this.snapshotUid !== uid) {
      // Subir sin haber descargado antes podría pisar datos de la nube con datos viejos.
      throw new Error('Los datos de la nube todavía no se han cargado')
    }
    const next = collectAll(data, uid)

    for (const table of TABLE_NAMES) {
      const { upserts, deletes, nextSerialized } = diff(this.snapshot[table], next[table])

      if (upserts.length > 0) {
        await rest(table, { method: 'POST', body: upserts, prefer: 'resolution=merge-duplicates,return=minimal' })
      }
      for (let i = 0; i < deletes.length; i += DELETE_CHUNK) {
        const chunk = deletes.slice(i, i + DELETE_CHUNK)
        await rest(`${table}?${inFilter(TABLES[table].keyColumn, chunk)}`, { method: 'DELETE' })
      }

      // El snapshot se actualiza tabla a tabla y solo si la petición tuvo éxito:
      // si algo falla, el siguiente save() reintenta justo lo que faltó.
      this.snapshot[table] = nextSerialized
    }
  }
}
