import { useState } from 'react'
import { useAppData } from '../AppDataContext'
import { todayWeekday, isToday, WEEKDAY_NAMES } from '../utils/date'
import { isRoutineCompletedToday } from '../utils/sessions'
import { generateId } from '../utils/id'
import { isValidDecimal, isValidInteger, parseDecimal } from '../utils/numericInput'
import { ExerciseLog, Routine, RoutineExercise, SetLog } from '../types'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import NumericInput from '../components/NumericInput'
import { THEME } from '../theme'
import { CheckCircle2, Plus, ChevronRight, RotateCcw, Trash2 } from 'lucide-react'

// Las series del modal se editan como texto (ver utils/numericInput.ts); solo al guardar el
// ejercicio se convierten a SetLog.
interface DraftSet {
  reps: string
  weight: string
}

function toDraftSet(s: SetLog): DraftSet {
  return { reps: String(s.reps), weight: String(s.weight) }
}

const isRepsValid = (d: DraftSet) => isValidInteger(d.reps, 1)
const isWeightValid = (d: DraftSet) => isValidDecimal(d.weight)

export default function WorkoutPage() {
  const { data, setData, exerciseMap } = useAppData()
  const weekday = todayWeekday()
  const todaysRoutineIds = data.weeklyPlan[weekday] ?? []
  const todaysRoutines = data.routines.filter((r) => todaysRoutineIds.includes(r.id))
  const otherRoutines = data.routines.filter((r) => !todaysRoutineIds.includes(r.id))

  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null)
  const [editingExercise, setEditingExercise] = useState<{ exerciseId: string; sets: DraftSet[] } | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const activeRoutine = data.routines.find((r) => r.id === activeRoutineId) ?? null

  // Única fuente de verdad del progreso de hoy: la sesión guardada en data.sessions. Lo registrado
  // y lo completado se derivan de ella (antes se duplicaba en estado local y había que mantener
  // ambos sincronizados), de modo que cambiar de sección o recargar no puede desincronizarlos.
  const todaySession = activeRoutine
    ? data.sessions.find((s) => s.routineId === activeRoutine.id && isToday(s.date))
    : undefined
  const loggedSets = new Map<string, SetLog[]>(
    (todaySession?.exerciseLogs ?? []).map((el): [string, SetLog[]] => [el.exerciseId, el.sets]),
  )

  // Todas las series del ejercicio abierto tienen reps (mín. 1) y peso; si no, no se puede guardar.
  const draftValid = editingExercise ? editingExercise.sets.every((d) => isRepsValid(d) && isWeightValid(d)) : false

  function startRoutine(routine: Routine) {
    setConfirmingReset(false)
    setActiveRoutineId(routine.id)
  }

  function openExerciseModal(re: RoutineExercise) {
    const existing = loggedSets.get(re.exerciseId)
    const sets: DraftSet[] = existing && existing.length > 0
      ? existing.map(toDraftSet)
      : Array.from({ length: re.defaultSets }, () => toDraftSet({ reps: re.defaultReps, weight: re.defaultWeight }))
    setEditingExercise({ exerciseId: re.exerciseId, sets })
  }

  function updateDraftSet(index: number, field: keyof DraftSet, value: string) {
    setEditingExercise((prev) => {
      if (!prev) return prev
      const sets = [...prev.sets]
      sets[index] = { ...sets[index], [field]: value }
      return { ...prev, sets }
    })
  }

  function addDraftSet() {
    setEditingExercise((prev) => {
      if (!prev) return prev
      const last = prev.sets[prev.sets.length - 1] ?? { reps: '10', weight: '0' }
      return { ...prev, sets: [...prev.sets, { ...last }] }
    })
  }

  function removeDraftSet(index: number) {
    setEditingExercise((prev) => {
      if (!prev || prev.sets.length <= 1) return prev
      return { ...prev, sets: prev.sets.filter((_, i) => i !== index) }
    })
  }

  // Guarda (o actualiza) el registro de un ejercicio en la sesión de hoy de la rutina, creando la
  // sesión si aún no existe, aunque la rutina no se haya terminado todavía. Así, si se cambia de
  // sección a mitad de entrenamiento, lo ya registrado no se pierde. El updater solo toca ese
  // ejercicio y parte siempre de `prev`, por lo que también es seguro si se reaplica sobre datos
  // recién cargados (ver AppDataContext.loadData).
  function saveExerciseLog(routineId: string, exerciseId: string, sets: SetLog[]) {
    const upsertLog = (logs: ExerciseLog[]): ExerciseLog[] =>
      logs.some((l) => l.exerciseId === exerciseId)
        ? logs.map((l) => (l.exerciseId === exerciseId ? { exerciseId, sets } : l))
        : [...logs, { exerciseId, sets }]

    setData((prev) => {
      const existingSession = prev.sessions.find((s) => s.routineId === routineId && isToday(s.date))
      if (existingSession) {
        return {
          ...prev,
          sessions: prev.sessions.map((s) =>
            s.id === existingSession.id ? { ...s, exerciseLogs: upsertLog(s.exerciseLogs) } : s,
          ),
        }
      }
      return {
        ...prev,
        sessions: [
          ...prev.sessions,
          { id: generateId(), routineId, date: new Date().toISOString(), exerciseLogs: [{ exerciseId, sets }] },
        ],
      }
    })
  }

  // Borra el progreso de hoy para la rutina activa: elimina la sesión de hoy (si existe) para que
  // no quede como completada ni conserve series antiguas. Útil para volver a entrenarla desde cero.
  function resetRoutine() {
    if (!activeRoutine) return
    setData((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => !(s.routineId === activeRoutine.id && isToday(s.date))),
    }))
    setConfirmingReset(false)
  }

  function saveExercise() {
    if (!editingExercise || !activeRoutine || !draftValid) return
    const sets: SetLog[] = editingExercise.sets.map((d) => ({ reps: Number(d.reps), weight: parseDecimal(d.weight) }))
    saveExerciseLog(activeRoutine.id, editingExercise.exerciseId, sets)
    setEditingExercise(null)
  }

  if (activeRoutine) {
    const allDone = isRoutineCompletedToday(activeRoutine, data.sessions)
    // Solo cuentan los ejercicios que la rutina tiene ahora (un registro de un ejercicio que ya
    // no está en la rutina no debe inflar el contador).
    const completedCount = activeRoutine.exercises.filter((re) => loggedSets.has(re.exerciseId)).length
    const editingRe = editingExercise ? activeRoutine.exercises.find((re) => re.exerciseId === editingExercise.exerciseId) : null
    const editingExerciseInfo = editingExercise ? exerciseMap.get(editingExercise.exerciseId) : null

    return (
      <div className="page">
        <PageHeader title={activeRoutine.name} icon={THEME.train.icon} color={THEME.train} onBack={() => setActiveRoutineId(null)} />
        <div className="routine-status">
          <p className="muted">{WEEKDAY_NAMES[weekday]} — {completedCount}/{activeRoutine.exercises.length} ejercicios completados</p>

          {loggedSets.size > 0 && (
            <button type="button" className="button-like" onClick={() => setConfirmingReset(true)}>
              <RotateCcw size={16} /> Reiniciar rutina
            </button>
          )}

          {allDone && (
            <div className="completion-banner">
              <CheckCircle2 size={20} /> Rutina completada
            </div>
          )}
        </div>

        <ul className="list">
          {activeRoutine.exercises.map((re) => {
            const exercise = exerciseMap.get(re.exerciseId)
            const completed = loggedSets.has(re.exerciseId)
            return (
              <li key={re.exerciseId} className="list-item selectable" onClick={() => openExerciseModal(re)}>
                <div>
                  <strong>{exercise?.name ?? '(eliminado)'}</strong>
                  <div className="muted small">{re.defaultSets} × {re.defaultReps} @ {re.defaultWeight}kg</div>
                </div>
                {completed ? (
                  <span className="status-badge success"><CheckCircle2 size={15} /> Completado</span>
                ) : (
                  <span className="status-badge pending">Pendiente</span>
                )}
              </li>
            )
          })}
        </ul>

        {editingExercise && editingRe && (
          <Modal title={editingExerciseInfo?.name ?? 'Ejercicio'} onClose={() => setEditingExercise(null)}>
            <table className="table">
              <thead>
                <tr><th>Serie</th><th>Reps</th><th>Peso (kg)</th><th></th></tr>
              </thead>
              <tbody>
                {editingExercise.sets.map((s, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <NumericInput
                        kind="integer"
                        value={s.reps}
                        valid={isRepsValid(s)}
                        label={`Repeticiones de la serie ${i + 1}`}
                        onChange={(v) => updateDraftSet(i, 'reps', v)}
                      />
                    </td>
                    <td>
                      <NumericInput
                        kind="decimal"
                        value={s.weight}
                        valid={isWeightValid(s)}
                        label={`Peso en kg de la serie ${i + 1}`}
                        onChange={(v) => updateDraftSet(i, 'weight', v)}
                      />
                    </td>
                    <td className="drag-handle-cell">
                      <button
                        type="button"
                        className="icon-btn danger-icon"
                        disabled={editingExercise.sets.length <= 1}
                        onClick={() => removeDraftSet(i)}
                        aria-label="Eliminar serie"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4}>
                    <button type="button" className="add-exercise-row-btn" onClick={addDraftSet}>
                      <Plus size={16} /> Añadir serie
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            {!draftValid && (
              <p className="form-error">Cada serie necesita al menos 1 repetición y un peso (0 si no usas carga).</p>
            )}
            <div className="modal-actions">
              <button onClick={saveExercise} disabled={!draftValid}>Guardar ejercicio</button>
            </div>
          </Modal>
        )}

        {confirmingReset && (
          <ConfirmModal
            title="Reiniciar rutina"
            icon={RotateCcw}
            message={
              <>
                <p>¿Reiniciar "{activeRoutine.name}"?</p>
                <p className="muted small">
                  Se borrará el progreso registrado hoy para esta rutina (series, reps y pesos de todos sus
                  ejercicios).
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

  return (
    <div className="page">
      <PageHeader title="Entrenar hoy" icon={THEME.train.icon} color={THEME.train} />
      <p className="muted">Hoy es {WEEKDAY_NAMES[weekday]}</p>

      {todaysRoutines.length === 0 && (
        <p className="empty">No hay rutina planificada para hoy. Ve a "Planificación" para asignarla.</p>
      )}

      <ul className="list">
        {todaysRoutines.map((r) => {
          const completed = isRoutineCompletedToday(r, data.sessions)
          return (
            <li key={r.id} className="list-item selectable" onClick={() => startRoutine(r)}>
              <div>
                <strong>{r.name}</strong>
                <span className="tag">{r.exercises.length} ejercicios</span>
              </div>
              {completed ? (
                <span className="status-badge success"><CheckCircle2 size={15} /> Completada</span>
              ) : (
                <ChevronRight size={18} className="chevron" />
              )}
            </li>
          )
        })}
      </ul>

      <details>
        <summary>Iniciar otra rutina (no planificada hoy)</summary>
        <ul className="list">
          {otherRoutines.map((r) => (
            <li key={r.id} className="list-item selectable" onClick={() => startRoutine(r)}>
              <strong>{r.name}</strong>
              <ChevronRight size={18} className="chevron" />
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
