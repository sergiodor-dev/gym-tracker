import { useState } from 'react'
import { useAppData } from '../AppDataContext'
import { todayWeekday, isToday, WEEKDAY_NAMES } from '../utils/date'
import { generateId } from '../utils/id'
import { ExerciseLog, Routine, RoutineExercise, SetLog } from '../types'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { THEME } from '../theme'
import { CheckCircle2, Plus, ChevronRight, RotateCcw } from 'lucide-react'

export default function WorkoutPage() {
  const { data, setData } = useAppData()
  const weekday = todayWeekday()
  const todaysRoutineIds = data.weeklyPlan[weekday] ?? []
  const todaysRoutines = data.routines.filter((r) => todaysRoutineIds.includes(r.id))
  const otherRoutines = data.routines.filter((r) => !todaysRoutineIds.includes(r.id))

  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, SetLog[]>>({})
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [editingExercise, setEditingExercise] = useState<{ exerciseId: string; sets: SetLog[] } | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const activeRoutine = data.routines.find((r) => r.id === activeRoutineId) ?? null

  function isRoutineCompletedToday(routineId: string) {
    return data.sessions.some((s) => s.routineId === routineId && isToday(s.date))
  }

  function startRoutine(routine: Routine) {
    const existing = data.sessions.find((s) => s.routineId === routine.id && isToday(s.date))
    if (existing) {
      const initialLogs: Record<string, SetLog[]> = {}
      existing.exerciseLogs.forEach((el) => { initialLogs[el.exerciseId] = el.sets })
      setLogs(initialLogs)
      setCompletedIds(existing.exerciseLogs.map((el) => el.exerciseId))
    } else {
      setLogs({})
      setCompletedIds([])
    }
    setConfirmingReset(false)
    setActiveRoutineId(routine.id)
  }

  function openExerciseModal(re: RoutineExercise) {
    const existing = logs[re.exerciseId]
    const sets = existing && existing.length > 0
      ? existing
      : Array.from({ length: re.defaultSets }, () => ({ reps: re.defaultReps, weight: re.defaultWeight }))
    setEditingExercise({ exerciseId: re.exerciseId, sets })
  }

  function updateDraftSet(index: number, field: keyof SetLog, value: number) {
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
      const last = prev.sets[prev.sets.length - 1] ?? { reps: 10, weight: 0 }
      return { ...prev, sets: [...prev.sets, { ...last }] }
    })
  }

  function removeDraftSet(index: number) {
    setEditingExercise((prev) => {
      if (!prev || prev.sets.length <= 1) return prev
      return { ...prev, sets: prev.sets.filter((_, i) => i !== index) }
    })
  }

  // Guarda (o actualiza) la sesión de hoy con los ejercicios completados hasta
  // el momento, aunque la rutina no se haya terminado todavía. Así, si se
  // cambia de sección a mitad de entrenamiento, lo ya registrado no se pierde:
  // al volver a "Entrenar", `startRoutine` recupera estos datos parciales.
  function persistSession(routine: Routine, logsMap: Record<string, SetLog[]>, completed: string[]) {
    const exerciseLogs: ExerciseLog[] = routine.exercises
      .filter((re) => completed.includes(re.exerciseId))
      .map((re) => ({ exerciseId: re.exerciseId, sets: logsMap[re.exerciseId] ?? [] }))

    setData((prev) => {
      const existingSession = prev.sessions.find((s) => s.routineId === routine.id && isToday(s.date))
      if (existingSession) {
        return {
          ...prev,
          sessions: prev.sessions.map((s) => (s.id === existingSession.id ? { ...s, exerciseLogs } : s)),
        }
      }
      return {
        ...prev,
        sessions: [...prev.sessions, { id: generateId(), routineId: routine.id, date: new Date().toISOString(), exerciseLogs }],
      }
    })
  }

  // Borra el progreso de hoy para la rutina activa: limpia el estado local y
  // elimina la sesión de hoy (si existe) para que no quede como completada
  // ni conserve series antiguas. Útil para volver a entrenarla desde cero.
  function resetRoutine() {
    if (!activeRoutine) return
    setLogs({})
    setCompletedIds([])
    setData((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => !(s.routineId === activeRoutine.id && isToday(s.date))),
    }))
    setConfirmingReset(false)
  }

  function saveExercise() {
    if (!editingExercise || !activeRoutine) return
    const { exerciseId, sets } = editingExercise
    const nextLogs = { ...logs, [exerciseId]: sets }
    const nextCompletedIds = completedIds.includes(exerciseId) ? completedIds : [...completedIds, exerciseId]
    setLogs(nextLogs)
    setCompletedIds(nextCompletedIds)
    setEditingExercise(null)
    persistSession(activeRoutine, nextLogs, nextCompletedIds)
  }

  if (activeRoutine) {
    const allDone = activeRoutine.exercises.length > 0 && activeRoutine.exercises.every((re) => completedIds.includes(re.exerciseId))
    const editingRe = editingExercise ? activeRoutine.exercises.find((re) => re.exerciseId === editingExercise.exerciseId) : null
    const editingExerciseInfo = editingExercise ? data.exercises.find((ex) => ex.id === editingExercise.exerciseId) : null

    return (
      <div className="page">
        <PageHeader title={activeRoutine.name} icon={THEME.train.icon} color={THEME.train} onBack={() => setActiveRoutineId(null)} />
        <p className="muted">{WEEKDAY_NAMES[weekday]} — {completedIds.length}/{activeRoutine.exercises.length} ejercicios completados</p>

        {completedIds.length > 0 && (
          <button type="button" className="button-like" onClick={() => setConfirmingReset(true)}>
            <RotateCcw size={16} /> Reiniciar rutina
          </button>
        )}

        {allDone && (
          <div className="completion-banner">
            <CheckCircle2 size={20} /> Rutina completada
          </div>
        )}

        <ul className="list">
          {activeRoutine.exercises.map((re) => {
            const exercise = data.exercises.find((ex) => ex.id === re.exerciseId)
            const completed = completedIds.includes(re.exerciseId)
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
                      <input type="number" min={0} value={s.reps}
                        onChange={(e) => updateDraftSet(i, 'reps', Number(e.target.value))} />
                    </td>
                    <td>
                      <input type="number" min={0} step={0.5} value={s.weight}
                        onChange={(e) => updateDraftSet(i, 'weight', Number(e.target.value))} />
                    </td>
                    <td>
                      <button className="danger" disabled={editingExercise.sets.length <= 1} onClick={() => removeDraftSet(i)}>✕</button>
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
            <div className="modal-actions">
              <button onClick={saveExercise}>Guardar ejercicio</button>
            </div>
          </Modal>
        )}

        {confirmingReset && (
          <Modal title="Reiniciar rutina" onClose={() => setConfirmingReset(false)}>
            <p>¿Reiniciar "{activeRoutine.name}"?</p>
            <p className="muted small">
              Se borrará el progreso registrado hoy para esta rutina (series, reps y pesos de todos sus ejercicios).
            </p>
            <div className="modal-actions">
              <button className="button-like" onClick={() => setConfirmingReset(false)}>Cancelar</button>
              <button className="danger-solid" onClick={resetRoutine}>Reiniciar</button>
            </div>
          </Modal>
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
          const completed = isRoutineCompletedToday(r.id)
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
