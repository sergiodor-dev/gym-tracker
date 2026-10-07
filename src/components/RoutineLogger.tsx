import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, RotateCcw, Trophy } from 'lucide-react'
import { useAppData } from '../AppDataContext'
import { addDays, isSameDay, localDayKey, relativeDayLabel, sessionDateForDay, WEEKDAY_NAMES } from '../utils/date'
import { findLastExerciseLog, formatSetsSummary, isRoutineCompletedOn } from '../utils/sessions'
import { detectRecords, groupRecordsByLog, recordKey } from '../utils/stats'
import { generateId } from '../utils/id'
import type { ExerciseLog, Routine, RoutineExercise, SetLog } from '../types'
import ConfirmModal from './ConfirmModal'
import ExerciseSetsForm from './ExerciseSetsForm'
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

// Lista de ejercicios de una rutina para un día, con su estado (pendiente/completado/récord), el
// formulario para registrar o editar las series de cada uno y el botón de reiniciar. Es la única
// fuente de verdad del progreso de ese día: la sesión guardada en data.sessions. Lo registrado y lo
// completado se derivan de ella, así que cambiar de sección o recargar no puede desincronizarlos.
export default function RoutineLogger({ routine, day, presentation }: Props) {
  const { data, setData, exerciseMap } = useAppData()
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const isViewingToday = localDayKey(day) === localDayKey(new Date())
  const weekday = day.getDay()
  const dayLabel = isViewingToday ? WEEKDAY_NAMES[weekday] : `${WEEKDAY_NAMES[weekday]} ${day.getDate()}`

  // Récords derivados del historial (ver utils/stats.ts), para marcar los ejercicios que superan tu
  // mejor marca anterior.
  const recordsByLog = useMemo(() => groupRecordsByLog(detectRecords(data.sessions)), [data.sessions])

  const session = data.sessions.find((s) => s.routineId === routine.id && isSameDay(s.date, day))
  const loggedSets = new Map<string, SetLog[]>(
    (session?.exerciseLogs ?? []).map((el): [string, SetLog[]] => [el.exerciseId, el.sets]),
  )

  // Última vez que se hizo el ejercicio, sin contar la sesión de esta rutina que se está rellenando
  // ahora y sin sesiones posteriores al día elegido (si se registra un día pasado, "la última vez" es
  // la anterior a ese día): así, incluso con el ejercicio ya completado, sigue mostrando la sesión anterior.
  const lastLogOf = (exerciseId: string) => findLastExerciseLog(exerciseId, data.sessions, session?.id, addDays(day, 1))

  // Guarda (o actualiza) el registro de un ejercicio en la sesión de ese día de la rutina, creando la
  // sesión si aún no existe, aunque la rutina no se haya terminado todavía. Así, si se cambia de
  // sección a mitad de entrenamiento, lo ya registrado no se pierde. El updater solo toca ese
  // ejercicio y parte siempre de `prev`, por lo que también es seguro si se reaplica sobre datos
  // recién cargados (ver AppDataContext.loadData).
  function saveExerciseLog(exerciseId: string, sets: SetLog[]) {
    const upsertLog = (logs: ExerciseLog[]): ExerciseLog[] =>
      logs.some((l) => l.exerciseId === exerciseId)
        ? logs.map((l) => (l.exerciseId === exerciseId ? { exerciseId, sets } : l))
        : [...logs, { exerciseId, sets }]

    setData((prev) => {
      const existing = prev.sessions.find((s) => s.routineId === routine.id && isSameDay(s.date, day))
      if (existing) {
        return {
          ...prev,
          sessions: prev.sessions.map((s) =>
            s.id === existing.id ? { ...s, exerciseLogs: upsertLog(s.exerciseLogs) } : s,
          ),
        }
      }
      return {
        ...prev,
        sessions: [
          ...prev.sessions,
          { id: generateId(), routineId: routine.id, date: sessionDateForDay(day), exerciseLogs: [{ exerciseId, sets }] },
        ],
      }
    })
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

  function saveExercise(exerciseId: string, sets: SetLog[]) {
    saveExerciseLog(exerciseId, sets)
    setEditingExerciseId(null)
  }

  const editingRe: RoutineExercise | null = editingExerciseId
    ? (routine.exercises.find((re) => re.exerciseId === editingExerciseId) ?? null)
    : null
  const editingName = editingRe ? (exerciseMap.get(editingRe.exerciseId)?.name ?? 'Ejercicio') : ''

  const form = editingRe && (
    <ExerciseSetsForm
      key={editingRe.exerciseId}
      routineExercise={editingRe}
      logged={loggedSets.get(editingRe.exerciseId)}
      last={lastLogOf(editingRe.exerciseId)}
      onSave={(sets) => saveExercise(editingRe.exerciseId, sets)}
    />
  )

  // En línea, el formulario sustituye a la lista (con un botón para volver), en vez de abrir otro modal.
  if (presentation === 'inline' && editingRe) {
    return (
      <div>
        <button type="button" className="back-link" onClick={() => setEditingExerciseId(null)}>
          <ChevronLeft size={16} /> Volver a los ejercicios
        </button>
        <h3 className="inline-form-title">{editingName}</h3>
        {form}
      </div>
    )
  }

  const allDone = isRoutineCompletedOn(routine, data.sessions, day)
  // Solo cuentan los ejercicios que la rutina tiene ahora (un registro de un ejercicio que ya
  // no está en la rutina no debe inflar el contador).
  const completedCount = routine.exercises.filter((re) => loggedSets.has(re.exerciseId)).length

  return (
    <div>
      <div className="routine-status">
        <p className="muted">
          {dayLabel} — {completedCount}/{routine.exercises.length} ejercicios completados
        </p>
        {!isViewingToday && <p className="muted small past-day-note">Estás registrando un entreno de un día anterior.</p>}

        {loggedSets.size > 0 && !confirmingReset && (
          <button type="button" className="button-like" onClick={() => setConfirmingReset(true)}>
            <RotateCcw size={16} /> Reiniciar rutina
          </button>
        )}

        {presentation === 'inline' && confirmingReset && (
          <div className="inline-confirm" role="alertdialog" aria-label="Reiniciar rutina">
            <p>¿Reiniciar "{routine.name}"?</p>
            <p className="muted small">
              Se borrará el progreso registrado el {dayLabel.toLowerCase()} para esta rutina (series, reps y pesos de
              todos sus ejercicios).
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
        {routine.exercises.map((re) => {
          const exercise = exerciseMap.get(re.exerciseId)
          const completed = loggedSets.has(re.exerciseId)
          const last = lastLogOf(re.exerciseId)
          const isRecord = session ? recordsByLog.has(recordKey(session.id, re.exerciseId)) : false
          return (
            <li key={re.exerciseId} className="list-item selectable" onClick={() => setEditingExerciseId(re.exerciseId)}>
              <div>
                <strong>{exercise?.name ?? '(eliminado)'}</strong>
                {last ? (
                  <div className="muted small">
                    Última vez: {formatSetsSummary(last.sets)} · {relativeDayLabel(last.date)}
                  </div>
                ) : (
                  <div className="muted small">
                    {re.defaultSets} × {re.defaultReps} @ {re.defaultWeight}kg
                  </div>
                )}
              </div>
              {completed ? (
                <div className="badge-row">
                  {isRecord && (
                    <span className="status-badge record">
                      <Trophy size={15} /> Récord
                    </span>
                  )}
                  <span className="status-badge success">
                    <CheckCircle2 size={15} /> Completado
                  </span>
                </div>
              ) : (
                <span className="status-badge pending">Pendiente</span>
              )}
            </li>
          )
        })}
      </ul>
      {routine.exercises.length === 0 && <p className="empty">Esta rutina no tiene ejercicios.</p>}

      {presentation === 'modal' && editingRe && (
        <Modal title={editingName} onClose={() => setEditingExerciseId(null)}>
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
                rutina (series, reps y pesos de todos sus ejercicios).
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
