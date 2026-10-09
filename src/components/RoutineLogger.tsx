import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, RotateCcw, Trophy } from 'lucide-react'
import { useAppData } from '../AppDataContext'
import { addDays, isSameDay, localDayKey, relativeDayLabel, sessionDateForDay, WEEKDAY_NAMES } from '../utils/date'
import { findLastExerciseLog, matchLoggedSets, routineProgress } from '../utils/sessions'
import { setOrdinals } from '../utils/routineItems'
import { detectRecords, groupRecordsByLog, maxWeightOf, recordKey } from '../utils/stats'
import { generateId } from '../utils/id'
import type { ExerciseLog, Routine, RoutineExercise, SetLog } from '../types'
import ConfirmModal from './ConfirmModal'
import SetLogForm from './SetLogForm'
import Modal from './Modal'

interface Props {
  routine: Routine
  /** Día sobre el que se registra (hoy en Entrenar; cualquier día pasado desde el calendario). */
  day: Date
  /**
   * 'modal'  → el formulario de series y la confirmación de reinicio se abren en modales (Entrenar).
   * 'inline' → se muestran en el propio contenedor, sin abrir otro modal encima (editor de día del
   *            calendario, que ya vive dentro de un modal).
   */
  presentation: 'modal' | 'inline'
}

// Lista ordenada de series de una rutina para un día, con su estado (pendiente/hecha/récord), el
// formulario para registrar o editar cada serie y el botón de reiniciar. Cada elemento de la lista es
// una serie concreta, así que se pueden registrar en cualquier orden e intercaladas entre ejercicios.
// Es la única fuente de verdad del progreso de ese día: la sesión guardada en data.sessions. Lo
// registrado y lo completado se derivan de ella, así que cambiar de sección o recargar no puede
// desincronizarlos.
export default function RoutineLogger({ routine, day, presentation }: Props) {
  const { data, setData, exerciseMap } = useAppData()
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const isViewingToday = localDayKey(day) === localDayKey(new Date())
  const weekday = day.getDay()
  const dayLabel = isViewingToday ? WEEKDAY_NAMES[weekday] : `${WEEKDAY_NAMES[weekday]} ${day.getDate()}`

  // Récords derivados del historial (ver utils/stats.ts), para marcar los ejercicios que superan tu
  // mejor marca anterior.
  const recordsByLog = useMemo(() => groupRecordsByLog(detectRecords(data.sessions)), [data.sessions])
  const ordinals = useMemo(() => setOrdinals(routine.exercises), [routine.exercises])

  const session = data.sessions.find((s) => s.routineId === routine.id && isSameDay(s.date, day))
  const progress = routineProgress(routine, session?.exerciseLogs ?? [])
  const loggedSets = progress.matched

  // Última vez que se hizo el ejercicio, sin contar la sesión de esta rutina que se está rellenando
  // ahora y sin sesiones posteriores al día elegido (si se registra un día pasado, "la última vez" es
  // la anterior a ese día): así, incluso con la serie ya registrada, sigue mostrando la sesión anterior.
  // Para una serie concreta se toma la equivalente (la 2.ª serie del ejercicio con la 2.ª de la última
  // vez; si entonces hubo menos series, la última).
  const lastOf = (item: RoutineExercise) => {
    const log = findLastExerciseLog(item.exerciseId, data.sessions, session?.id, addDays(day, 1))
    if (!log) return null
    const n = ordinals.get(item.id)?.n ?? 1
    return { set: log.sets[Math.min(n, log.sets.length) - 1], date: log.date }
  }

  // Guarda (o actualiza) una serie en la sesión de ese día de la rutina, creando la sesión si aún no
  // existe, aunque la rutina no se haya terminado todavía. Así, si se cambia de sección a mitad de
  // entrenamiento, lo ya registrado no se pierde. El updater solo toca esa serie y parte siempre de
  // `prev`, por lo que también es seguro si se reaplica sobre datos recién cargados (ver
  // AppDataContext.loadData).
  function saveSet(item: RoutineExercise, set: SetLog) {
    const order = new Map(routine.exercises.map((it, i) => [it.id, i]))
    const position = (s: SetLog) => (s.itemId ? (order.get(s.itemId) ?? -1) : -1)

    // Series del ejercicio tras guardar `set`: sustituye la ya registrada para ese elemento (también si
    // era una serie antigua sin itemId) o la añade, y las deja en el orden de la rutina.
    const withSet = (logs: ExerciseLog[], previous: SetLog | undefined): ExerciseLog[] => {
      const current = logs.find((l) => l.exerciseId === item.exerciseId)
      const others = (current?.sets ?? []).filter((s) => s !== previous)
      const sets = [...others, set].sort((a, b) => position(a) - position(b))
      return current
        ? logs.map((l) => (l === current ? { ...l, sets } : l))
        : [...logs, { exerciseId: item.exerciseId, sets }]
    }

    setData((prev) => {
      const existing = prev.sessions.find((s) => s.routineId === routine.id && isSameDay(s.date, day))
      if (existing) {
        const previous = matchLoggedSets(routine, existing.exerciseLogs).get(item.id)
        return {
          ...prev,
          sessions: prev.sessions.map((s) =>
            s.id === existing.id ? { ...s, exerciseLogs: withSet(s.exerciseLogs, previous) } : s,
          ),
        }
      }
      return {
        ...prev,
        sessions: [
          ...prev.sessions,
          { id: generateId(), routineId: routine.id, date: sessionDateForDay(day), exerciseLogs: withSet([], undefined) },
        ],
      }
    })
    setEditingItemId(null)
  }

  // Quita el registro de una serie. Si el ejercicio se queda sin series se quita su registro, y si la
  // sesión se queda sin registros, la sesión entera (como si no se hubiera entrenado ese día).
  function clearSet(item: RoutineExercise) {
    setData((prev) => {
      const existing = prev.sessions.find((s) => s.routineId === routine.id && isSameDay(s.date, day))
      if (!existing) return prev
      const target = matchLoggedSets(routine, existing.exerciseLogs).get(item.id)
      if (!target) return prev
      const exerciseLogs = existing.exerciseLogs
        .map((l) => (l.exerciseId === item.exerciseId ? { ...l, sets: l.sets.filter((s) => s !== target) } : l))
        .filter((l) => l.sets.length > 0)
      return {
        ...prev,
        sessions:
          exerciseLogs.length === 0
            ? prev.sessions.filter((s) => s.id !== existing.id)
            : prev.sessions.map((s) => (s.id === existing.id ? { ...s, exerciseLogs } : s)),
      }
    })
    setEditingItemId(null)
  }

  // Borra el progreso del día elegido para la rutina: elimina esa sesión (si existe) para que no
  // quede como completada ni conserve series antiguas. Útil para volver a entrenarla desde cero.
  function resetRoutine() {
    setData((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => !(s.routineId === routine.id && isSameDay(s.date, day))),
    }))
    setConfirmingReset(false)
  }

  const editingItem: RoutineExercise | null = editingItemId
    ? (routine.exercises.find((it) => it.id === editingItemId) ?? null)
    : null
  const editingName = editingItem ? (exerciseMap.get(editingItem.exerciseId)?.name ?? 'Ejercicio') : ''
  const editingOrdinal = editingItem ? ordinals.get(editingItem.id) : undefined
  const editingTitle =
    editingOrdinal && editingOrdinal.of > 1 ? `${editingName} · ${editingOrdinal.n}/${editingOrdinal.of}` : editingName

  const form = editingItem && (
    <SetLogForm
      key={editingItem.id}
      item={editingItem}
      logged={loggedSets.get(editingItem.id)}
      last={lastOf(editingItem)}
      onSave={(set) => saveSet(editingItem, set)}
      onClear={() => clearSet(editingItem)}
    />
  )

  // En línea, el formulario sustituye a la lista (con un botón para volver), en vez de abrir otro modal.
  if (presentation === 'inline' && editingItem) {
    return (
      <div>
        <button type="button" className="inline-back" onClick={() => setEditingItemId(null)}>
          <ChevronLeft size={16} /> Volver a la rutina
        </button>
        <h3 className="inline-form-title">{editingTitle}</h3>
        {form}
      </div>
    )
  }

  const allDone = progress.completed

  return (
    <div>
      <div className="routine-status">
        <div className="routine-head">
          {presentation === 'modal' && (
            <h2 className="routine-day-title">
              {isViewingToday && <span className="routine-day-today">Hoy</span>}
              {WEEKDAY_NAMES[weekday]} {day.getDate()}
            </h2>
          )}
          {!!session && !confirmingReset && (
            <button type="button" className="button-like routine-reset-btn" onClick={() => setConfirmingReset(true)}>
              <RotateCcw size={16} /> Reiniciar rutina
            </button>
          )}
        </div>
        {progress.total > 0 && (
          <div className="progress-bars">
            {progress.requiredTotal > 0 && (
              <div
                className="progress-bar"
                style={{ flexGrow: progress.requiredTotal }}
                role="progressbar"
                aria-label="Series obligatorias"
                aria-valuemin={0}
                aria-valuemax={progress.requiredTotal}
                aria-valuenow={progress.requiredDone}
                title={`Obligatorias: ${progress.requiredDone}/${progress.requiredTotal}`}
              >
                <div className="progress-bar-fill" style={{ width: `${(progress.requiredDone / progress.requiredTotal) * 100}%` }} />
              </div>
            )}
            {progress.optionalTotal > 0 && (
              <div
                className="progress-bar optional"
                style={{ flexGrow: progress.optionalTotal }}
                role="progressbar"
                aria-label="Series opcionales"
                aria-valuemin={0}
                aria-valuemax={progress.optionalTotal}
                aria-valuenow={progress.optionalDone}
                title={`Opcionales: ${progress.optionalDone}/${progress.optionalTotal}`}
              >
                <div className="progress-bar-fill" style={{ width: `${(progress.optionalDone / progress.optionalTotal) * 100}%` }} />
              </div>
            )}
          </div>
        )}
        {progress.total > 0 && (
          <p className="progress-counts">
            {progress.requiredTotal > 0 && `${progress.requiredDone}/${progress.requiredTotal}`}
            {progress.requiredTotal > 0 && progress.optionalTotal > 0 && ' · '}
            {progress.optionalTotal > 0 && `${progress.optionalDone}/${progress.optionalTotal}`}
          </p>
        )}
        {!isViewingToday && <p className="muted small past-day-note">Estás registrando un entreno de un día anterior.</p>}

        {presentation === 'inline' && confirmingReset && (
          <div className="inline-confirm" role="alertdialog" aria-label="Reiniciar rutina">
            <p>¿Reiniciar "{routine.name}"?</p>
            <p className="muted small">
              Se borrará el progreso registrado el {dayLabel.toLowerCase()} para esta rutina (todas las series
              registradas).
            </p>
            <div className="modal-actions">
              <button type="button" className="button-like" onClick={() => setConfirmingReset(false)}>
                Cancelar
              </button>
              <button type="button" className="danger-solid" onClick={resetRoutine}>
                Reiniciar
              </button>
            </div>
          </div>
        )}

        {allDone && (
          <div className="completion-banner">
            <CheckCircle2 size={20} /> Rutina completada
          </div>
        )}
      </div>

      <ul className="list">
        {routine.exercises.map((item, idx) => {
          const exercise = exerciseMap.get(item.exerciseId)
          const ord = ordinals.get(item.id)
          const set = loggedSets.get(item.id)
          const shown = set ?? lastOf(item)?.set ?? item
          // Series seguidas del mismo ejercicio: se unen con una línea en el margen izquierdo.
          const linkPrev = idx > 0 && routine.exercises[idx - 1].exerciseId === item.exerciseId
          const linkNext = idx < routine.exercises.length - 1 && routine.exercises[idx + 1].exerciseId === item.exerciseId
          const log = session?.exerciseLogs.find((l) => l.exerciseId === item.exerciseId)
          // Récord: se marca en la primera serie con el peso máximo del ejercicio ese día.
          const isRecord =
            !!set &&
            !!session &&
            !!log &&
            recordsByLog.has(recordKey(session.id, item.exerciseId)) &&
            log.sets.find((s) => s.weight === maxWeightOf(log.sets)) === set
          return (
            <li key={item.id} className={`list-item selectable${item.required ? '' : ' optional'}${linkPrev ? ' link-prev' : ''}${linkNext ? ' link-next' : ''}`} onClick={() => setEditingItemId(item.id)}>
              <div>
                <div className="set-title">
                  <strong>{exercise?.name ?? '(eliminado)'}</strong>
                  {ord && ord.of > 1 && <span className="tag">{ord.n}/{ord.of}</span>}
                  {!item.required && <span className="tag tag-optional">Opcional</span>}
                </div>
                <div className={`set-pills${set ? ' logged' : ''}`}>
                  <span className="set-pill">{shown.reps} reps</span>
                  <span className="set-pill">{shown.weight} kg</span>
                </div>
              </div>
              {set ? (
                <div className="badge-row">
                  {isRecord && (
                    <span className="status-badge record">
                      <Trophy size={15} /> Récord
                    </span>
                  )}
                  <span className="status-badge success">
                    <CheckCircle2 size={15} /> Hecho
                  </span>
                </div>
              ) : (
                <span className="status-badge pending">Pendiente</span>
              )}
            </li>
          )
        })}
      </ul>
      {routine.exercises.length === 0 && <p className="empty">Esta rutina no tiene series.</p>}

      {presentation === 'modal' && editingItem && (
        <Modal title={editingTitle} onClose={() => setEditingItemId(null)}>
          {form}
        </Modal>
      )}

      {presentation === 'modal' && confirmingReset && (
        <ConfirmModal
          title="Reiniciar rutina"
          icon={RotateCcw}
          message={
            <>
              <p>¿Reiniciar "{routine.name}"?</p>
              <p className="muted small">
                Se borrará el progreso registrado {isViewingToday ? 'hoy' : `el ${dayLabel.toLowerCase()}`} para esta
                rutina (todas las series registradas).
              </p>
            </>
          }
          confirmLabel="Reiniciar"
          onConfirm={resetRoutine}
          onClose={() => setConfirmingReset(false)}
        />
      )}
    </div>
  )
}
