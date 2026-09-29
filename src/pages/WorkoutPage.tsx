import { useMemo, useState } from 'react'
import { useAppData } from '../AppDataContext'
import { isSameDay, sessionDateForDay, addDays, startOfWeek, localDayKey, relativeDayLabel, WEEKDAY_NAMES, WEEKDAY_SHORT } from '../utils/date'
import { isRoutineCompletedOn, findLastExerciseLog, formatSetsSummary } from '../utils/sessions'
import { detectRecords, groupRecordsByLog, recordKey } from '../utils/stats'
import { generateId } from '../utils/id'
import { isValidDecimal, isValidInteger, parseDecimal } from '../utils/numericInput'
import { ExerciseLog, Routine, RoutineExercise, SetLog } from '../types'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import NumericInput from '../components/NumericInput'
import { THEME } from '../theme'
import { CheckCircle2, Plus, ChevronRight, RotateCcw, Trash2, Undo2, History, Trophy } from 'lucide-react'

// Las series del modal se editan como texto (ver utils/numericInput.ts); solo al guardar el
// ejercicio se convierten a SetLog.
interface DraftSet {
  reps: string
  weight: string
}

function toDraftSet(s: SetLog): DraftSet {
  return { reps: String(s.reps), weight: String(s.weight) }
}

// Series iniciales según los valores por defecto de la rutina para ese ejercicio.
const routineDefaultSets = (re: RoutineExercise): DraftSet[] =>
  Array.from({ length: re.defaultSets }, () => toDraftSet({ reps: re.defaultReps, weight: re.defaultWeight }))

const isRepsValid = (d: DraftSet) => isValidInteger(d.reps, 1)
const isWeightValid = (d: DraftSet) => isValidDecimal(d.weight)

export default function WorkoutPage() {
  const { data, setData, exerciseMap } = useAppData()

  // Día sobre el que se registra: por defecto hoy, pero se puede elegir cualquier día anterior de la
  // semana en curso (lunes a domingo) para apuntar un entreno que se olvidó o no se pudo registrar.
  // `null` significa "hoy" y sigue a hoy si la página queda abierta pasada la medianoche.
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const now = new Date()
  const todayStart = addDays(now, 0)
  const todayKey = localDayKey(todayStart)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(now), i))
  const targetDay =
    weekDays.find((d) => localDayKey(d) === selectedDayKey && d.getTime() <= todayStart.getTime()) ?? todayStart
  const isViewingToday = localDayKey(targetDay) === todayKey
  const weekday = targetDay.getDay()
  const todaysRoutineIds = data.weeklyPlan[weekday] ?? []
  const todaysRoutines = data.routines.filter((r) => todaysRoutineIds.includes(r.id))
  const otherRoutines = data.routines.filter((r) => !todaysRoutineIds.includes(r.id))

  // Récords derivados del historial (ver utils/stats.ts), para marcar los ejercicios de hoy que
  // superan tu mejor marca anterior. Va antes del return condicional de más abajo (reglas de hooks).
  const recordsByLog = useMemo(() => groupRecordsByLog(detectRecords(data.sessions)), [data.sessions])

  // Días (YYYY-MM-DD) con algún ejercicio registrado, para marcar el selector de día.
  const trainedDayKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const s of data.sessions) {
      const t = new Date(s.date)
      if (!Number.isNaN(t.getTime()) && s.exerciseLogs.length > 0) keys.add(localDayKey(t))
    }
    return keys
  }, [data.sessions])

  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null)
  // `prefilledFrom` indica de dónde salen las series iniciales del modal: la fecha (ISO) de la
  // última sesión si se autorrellenó con ella, o null si vienen de lo ya registrado hoy o de los
  // valores por defecto de la rutina.
  const [editingExercise, setEditingExercise] = useState<{
    exerciseId: string
    sets: DraftSet[]
    prefilledFrom: string | null
  } | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const activeRoutine = data.routines.find((r) => r.id === activeRoutineId) ?? null

  // Única fuente de verdad del progreso del día elegido: la sesión guardada en data.sessions. Lo registrado
  // y lo completado se derivan de ella (antes se duplicaba en estado local y había que mantener
  // ambos sincronizados), de modo que cambiar de sección o recargar no puede desincronizarlos.
  const todaySession = activeRoutine
    ? data.sessions.find((s) => s.routineId === activeRoutine.id && isSameDay(s.date, targetDay))
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

  // Última vez que se hizo el ejercicio, sin contar la sesión de esta rutina que se está rellenando
  // ahora y sin sesiones posteriores al día elegido (si se registra un día pasado, "la última vez" es
  // la anterior a ese día): así, incluso con el ejercicio ya completado, sigue mostrando la sesión anterior.
  const lastLogOf = (exerciseId: string) =>
    findLastExerciseLog(exerciseId, data.sessions, todaySession?.id, addDays(targetDay, 1))

  // Prioridad de las series iniciales: 1) lo ya registrado hoy (para editarlo), 2) la última sesión
  // con ese ejercicio (autorrelleno, para no depender de la memoria), 3) los valores por defecto
  // de la rutina cuando nunca se ha hecho.
  function openExerciseModal(re: RoutineExercise) {
    const existing = loggedSets.get(re.exerciseId)
    if (existing && existing.length > 0) {
      setEditingExercise({ exerciseId: re.exerciseId, sets: existing.map(toDraftSet), prefilledFrom: null })
      return
    }
    const last = lastLogOf(re.exerciseId)
    if (last) {
      setEditingExercise({ exerciseId: re.exerciseId, sets: last.sets.map(toDraftSet), prefilledFrom: last.date })
      return
    }
    setEditingExercise({ exerciseId: re.exerciseId, sets: routineDefaultSets(re), prefilledFrom: null })
  }

  // Cambia las series del modal a los valores por defecto de la rutina (p. ej. tras una descarga o
  // si la última sesión fue un mal día). Descarta lo que se hubiera editado en el modal.
  function applyRoutineDefaults(re: RoutineExercise) {
    setEditingExercise((prev) => (prev ? { ...prev, sets: routineDefaultSets(re), prefilledFrom: null } : prev))
  }

  // Vuelve a rellenar con la última sesión (deshace applyRoutineDefaults).
  function applyLastSession(exerciseId: string) {
    const last = lastLogOf(exerciseId)
    if (!last) return
    setEditingExercise((prev) => (prev ? { ...prev, sets: last.sets.map(toDraftSet), prefilledFrom: last.date } : prev))
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
      const existingSession = prev.sessions.find((s) => s.routineId === routineId && isSameDay(s.date, targetDay))
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
          { id: generateId(), routineId, date: sessionDateForDay(targetDay), exerciseLogs: [{ exerciseId, sets }] },
        ],
      }
    })
  }

  // Borra el progreso del día elegido para la rutina activa: elimina esa sesión (si existe) para que
  // no quede como completada ni conserve series antiguas. Útil para volver a entrenarla desde cero.
  function resetRoutine() {
    if (!activeRoutine) return
    setData((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => !(s.routineId === activeRoutine.id && isSameDay(s.date, targetDay))),
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
    const allDone = isRoutineCompletedOn(activeRoutine, data.sessions, targetDay)
    // Solo cuentan los ejercicios que la rutina tiene ahora (un registro de un ejercicio que ya
    // no está en la rutina no debe inflar el contador).
    const dayLabel = isViewingToday ? WEEKDAY_NAMES[weekday] : `${WEEKDAY_NAMES[weekday]} ${targetDay.getDate()}`
    const completedCount = activeRoutine.exercises.filter((re) => loggedSets.has(re.exerciseId)).length
    const editingRe = editingExercise ? activeRoutine.exercises.find((re) => re.exerciseId === editingExercise.exerciseId) : null
    const editingExerciseInfo = editingExercise ? exerciseMap.get(editingExercise.exerciseId) : null

    return (
      <div className="page">
        <PageHeader title={activeRoutine.name} icon={THEME.train.icon} color={THEME.train} onBack={() => setActiveRoutineId(null)} />
        <div className="routine-status">
          <p className="muted">
            {dayLabel} — {completedCount}/{activeRoutine.exercises.length} ejercicios completados
          </p>
          {!isViewingToday && (
            <p className="muted small past-day-note">Estás registrando un entreno de un día anterior.</p>
          )}

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
            const last = lastLogOf(re.exerciseId)
            const isRecord = todaySession ? recordsByLog.has(recordKey(todaySession.id, re.exerciseId)) : false
            return (
              <li key={re.exerciseId} className="list-item selectable" onClick={() => openExerciseModal(re)}>
                <div>
                  <strong>{exercise?.name ?? '(eliminado)'}</strong>
                  {last ? (
                    <div className="muted small">
                      Última vez: {formatSetsSummary(last.sets)} · {relativeDayLabel(last.date)}
                    </div>
                  ) : (
                    <div className="muted small">{re.defaultSets} × {re.defaultReps} @ {re.defaultWeight}kg</div>
                  )}
                </div>
                {completed ? (
                  <div className="badge-row">
                    {isRecord && <span className="status-badge record"><Trophy size={15} /> Récord</span>}
                    <span className="status-badge success"><CheckCircle2 size={15} /> Completado</span>
                  </div>
                ) : (
                  <span className="status-badge pending">Pendiente</span>
                )}
              </li>
            )
          })}
        </ul>

        {editingExercise && editingRe && (
          <Modal title={editingExerciseInfo?.name ?? 'Ejercicio'} onClose={() => setEditingExercise(null)}>
            {editingExercise.prefilledFrom && (
              <p className="muted small">
                Rellenado con tu última sesión ({relativeDayLabel(editingExercise.prefilledFrom)}). Ajusta lo que haya cambiado.
              </p>
            )}
            {/* Solo si el ejercicio aún no está registrado hoy: al editar algo ya guardado, estos
                botones no tienen sentido y podrían pisar lo que se registró. */}
            {!loggedSets.has(editingExercise.exerciseId) && (
              editingExercise.prefilledFrom ? (
                <button type="button" className="button-like modal-shortcut" onClick={() => applyRoutineDefaults(editingRe)}>
                  <Undo2 size={16} /> Usar valores de la rutina ({editingRe.defaultSets} × {editingRe.defaultReps} @ {editingRe.defaultWeight} kg)
                </button>
              ) : (
                lastLogOf(editingExercise.exerciseId) && (
                  <button type="button" className="button-like modal-shortcut" onClick={() => applyLastSession(editingExercise.exerciseId)}>
                    <History size={16} /> Usar última sesión
                  </button>
                )
              )
            )}
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
                  Se borrará el progreso registrado {isViewingToday ? 'hoy' : `el ${dayLabel.toLowerCase()}`} para
                  esta rutina (series, reps y pesos de todos sus ejercicios).
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
      <PageHeader
        title={isViewingToday ? 'Entrenar hoy' : 'Registrar entreno'}
        icon={THEME.train.icon}
        color={THEME.train}
      />

      <div className="day-picker" role="group" aria-label="Día de la semana">
        {weekDays.map((d) => {
          const key = localDayKey(d)
          const future = d.getTime() > todayStart.getTime()
          const selected = key === localDayKey(targetDay)
          return (
            <button
              key={key}
              type="button"
              className={`day-pill${selected ? ' active' : ''}${key === todayKey ? ' today' : ''}`}
              disabled={future}
              aria-pressed={selected}
              aria-label={`${WEEKDAY_NAMES[d.getDay()]} ${d.getDate()}${trainedDayKeys.has(key) ? ', con entreno registrado' : ''}`}
              onClick={() => setSelectedDayKey(key === todayKey ? null : key)}
            >
              <span className="day-pill-name">{WEEKDAY_SHORT[d.getDay()]}</span>
              <span className="day-pill-num">{d.getDate()}</span>
              <span className={`day-pill-dot${trainedDayKeys.has(key) ? ' on' : ''}`} aria-hidden="true" />
            </button>
          )
        })}
      </div>

      <p className="muted">
        {isViewingToday
          ? `Hoy es ${WEEKDAY_NAMES[weekday]}`
          : `Registrando el ${WEEKDAY_NAMES[weekday].toLowerCase()} ${targetDay.getDate()}`}
      </p>

      {todaysRoutines.length === 0 && (
        <p className="empty">
          {isViewingToday
            ? 'No hay rutina planificada para hoy. Ve a "Planificación" para asignarla.'
            : `No había rutina planificada para el ${WEEKDAY_NAMES[weekday].toLowerCase()}. Puedes registrar otra abajo.`}
        </p>
      )}

      <ul className="list">
        {todaysRoutines.map((r) => {
          const completed = isRoutineCompletedOn(r, data.sessions, targetDay)
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
        <summary>{isViewingToday ? 'Iniciar otra rutina (no planificada hoy)' : 'Registrar otra rutina (no planificada ese día)'}</summary>
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
