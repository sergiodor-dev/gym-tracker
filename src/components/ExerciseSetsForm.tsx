import { useState } from 'react'
import { History, Plus, Trash2, Undo2 } from 'lucide-react'
import { relativeDayLabel } from '../utils/date'
import { isValidDecimal, isValidInteger, parseDecimal } from '../utils/numericInput'
import type { LastExerciseLog } from '../utils/sessions'
import type { RoutineExercise, SetLog } from '../types'
import NumericInput from './NumericInput'

// Las series se editan como texto (ver utils/numericInput.ts); solo al guardar se convierten a SetLog.
interface DraftSet {
  reps: string
  weight: string
}

const toDraftSet = (s: SetLog): DraftSet => ({ reps: String(s.reps), weight: String(s.weight) })

// Series iniciales según los valores por defecto de la rutina para ese ejercicio.
const routineDefaultSets = (re: RoutineExercise): DraftSet[] =>
  Array.from({ length: re.defaultSets }, () => toDraftSet({ reps: re.defaultReps, weight: re.defaultWeight }))

const isRepsValid = (d: DraftSet) => isValidInteger(d.reps, 1)
const isWeightValid = (d: DraftSet) => isValidDecimal(d.weight)

interface Props {
  routineExercise: RoutineExercise
  /** Series ya registradas ese día para el ejercicio (si las hay). */
  logged: SetLog[] | undefined
  /** Última vez que se hizo el ejercicio (anterior al día que se está registrando). */
  last: LastExerciseLog | null
  onSave: (sets: SetLog[]) => void
}

// Tabla de series de un ejercicio con sus atajos y el botón de guardar. No incluye contenedor: quien
// lo usa lo pone dentro de un Modal (Entrenar) o lo muestra en línea (editor de día del calendario).
// Se monta de nuevo cada vez que se abre un ejercicio, así que el estado inicial sale de los props.
//
// Prioridad de las series iniciales: 1) lo ya registrado ese día (para editarlo), 2) la última sesión
// con ese ejercicio (autorrelleno, para no depender de la memoria), 3) los valores por defecto de la
// rutina cuando nunca se ha hecho.
export default function ExerciseSetsForm({ routineExercise: re, logged, last, onSave }: Props) {
  const [state, setState] = useState<{ sets: DraftSet[]; prefilledFrom: string | null }>(() => {
    if (logged && logged.length > 0) return { sets: logged.map(toDraftSet), prefilledFrom: null }
    if (last) return { sets: last.sets.map(toDraftSet), prefilledFrom: last.date }
    return { sets: routineDefaultSets(re), prefilledFrom: null }
  })
  const { sets, prefilledFrom } = state

  // Todas las series tienen reps (mín. 1) y peso; si no, no se puede guardar.
  const valid = sets.every((d) => isRepsValid(d) && isWeightValid(d))

  // Cambia las series a los valores por defecto de la rutina (p. ej. tras una descarga o si la última
  // sesión fue un mal día). Descarta lo que se hubiera editado.
  const applyRoutineDefaults = () => setState({ sets: routineDefaultSets(re), prefilledFrom: null })

  // Vuelve a rellenar con la última sesión (deshace applyRoutineDefaults).
  const applyLastSession = () => {
    if (last) setState({ sets: last.sets.map(toDraftSet), prefilledFrom: last.date })
  }

  function updateSet(index: number, field: keyof DraftSet, value: string) {
    setState((prev) => {
      const next = [...prev.sets]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, sets: next }
    })
  }

  function addSet() {
    setState((prev) => {
      const lastSet = prev.sets[prev.sets.length - 1] ?? { reps: '10', weight: '0' }
      return { ...prev, sets: [...prev.sets, { ...lastSet }] }
    })
  }

  function removeSet(index: number) {
    setState((prev) => (prev.sets.length <= 1 ? prev : { ...prev, sets: prev.sets.filter((_, i) => i !== index) }))
  }

  function save() {
    if (!valid) return
    onSave(sets.map((d) => ({ reps: Number(d.reps), weight: parseDecimal(d.weight) })))
  }

  return (
    <>
      {prefilledFrom && (
        <p className="muted small">
          Rellenado con tu última sesión ({relativeDayLabel(prefilledFrom)}). Ajusta lo que haya cambiado.
        </p>
      )}
      {/* Solo si el ejercicio aún no está registrado ese día: al editar algo ya guardado, estos
          botones no tienen sentido y podrían pisar lo que se registró. */}
      {!logged &&
        (prefilledFrom ? (
          <button type="button" className="button-like modal-shortcut" onClick={applyRoutineDefaults}>
            <Undo2 size={16} /> Usar valores de la rutina ({re.defaultSets} × {re.defaultReps} @ {re.defaultWeight} kg)
          </button>
        ) : (
          last && (
            <button type="button" className="button-like modal-shortcut" onClick={applyLastSession}>
              <History size={16} /> Usar última sesión
            </button>
          )
        ))}
      <table className="table">
        <thead>
          <tr>
            <th>Serie</th>
            <th>Reps</th>
            <th>Peso (kg)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                <NumericInput
                  kind="integer"
                  value={s.reps}
                  valid={isRepsValid(s)}
                  label={`Repeticiones de la serie ${i + 1}`}
                  onChange={(v) => updateSet(i, 'reps', v)}
                />
              </td>
              <td>
                <NumericInput
                  kind="decimal"
                  value={s.weight}
                  valid={isWeightValid(s)}
                  label={`Peso en kg de la serie ${i + 1}`}
                  onChange={(v) => updateSet(i, 'weight', v)}
                />
              </td>
              <td className="drag-handle-cell">
                <button
                  type="button"
                  className="icon-btn danger-icon"
                  disabled={sets.length <= 1}
                  onClick={() => removeSet(i)}
                  aria-label="Eliminar serie"
                >
                  <Trash2 size={15} />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={4}>
              <button type="button" className="add-exercise-row-btn" onClick={addSet}>
                <Plus size={16} /> Añadir serie
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      {!valid && <p className="form-error">Cada serie necesita al menos 1 repetición y un peso (0 si no usas carga).</p>}
      <div className="modal-actions">
        <button onClick={save} disabled={!valid}>
          Guardar ejercicio
        </button>
      </div>
    </>
  )
}
