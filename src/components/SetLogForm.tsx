import { useState } from 'react'
import { History, Trash2, Undo2 } from 'lucide-react'
import { relativeDayLabel } from '../utils/date'
import { isValidDecimal, isValidInteger, parseDecimal } from '../utils/numericInput'
import type { RoutineExercise, SetLog } from '../types'
import NumericInput from './NumericInput'

interface Props {
  item: RoutineExercise
  /** La serie ya registrada ese día (si la hay), para editarla. */
  logged: SetLog | undefined
  /** La serie equivalente de la última vez que se hizo el ejercicio (anterior al día que se registra). */
  last: { set: SetLog; date: string } | null
  onSave: (set: SetLog) => void
  /** Borra el registro de la serie (solo si estaba registrada). */
  onClear: () => void
}

// Formulario de UNA serie (reps y peso). No incluye contenedor: quien lo usa lo pone dentro de un
// Modal (Entrenar) o lo muestra en línea (editor de día del calendario). Se monta de nuevo cada vez
// que se abre una serie, así que el estado inicial sale de los props.
//
// Prioridad de los valores iniciales: 1) lo ya registrado ese día (para editarlo), 2) la misma serie
// de la última sesión con ese ejercicio (autorrelleno, para no depender de la memoria), 3) los valores
// objetivo de la rutina cuando nunca se ha hecho.
export default function SetLogForm({ item, logged, last, onSave, onClear }: Props) {
  const [state, setState] = useState<{ reps: string; weight: string; prefilledFrom: string | null }>(() => {
    if (logged) return { reps: String(logged.reps), weight: String(logged.weight), prefilledFrom: null }
    if (last) return { reps: String(last.set.reps), weight: String(last.set.weight), prefilledFrom: last.date }
    return { reps: String(item.reps), weight: String(item.weight), prefilledFrom: null }
  })
  const { reps, weight, prefilledFrom } = state

  const repsValid = isValidInteger(reps, 1)
  const weightValid = isValidDecimal(weight)
  const valid = repsValid && weightValid

  const applyRoutineValues = () => setState({ reps: String(item.reps), weight: String(item.weight), prefilledFrom: null })
  const applyLast = () => {
    if (last) setState({ reps: String(last.set.reps), weight: String(last.set.weight), prefilledFrom: last.date })
  }

  function save() {
    if (!valid) return
    onSave({ reps: Number(reps), weight: parseDecimal(weight), itemId: item.id })
  }

  return (
    <>
      {prefilledFrom && (
        <p className="muted small">
          Rellenado con tu última sesión ({relativeDayLabel(prefilledFrom)}). Ajusta lo que haya cambiado.
        </p>
      )}
      {/* Solo si la serie aún no está registrada: al editar algo ya guardado, estos botones no tienen
          sentido y podrían pisar lo que se registró. */}
      {!logged &&
        (prefilledFrom ? (
          <button type="button" className="button-like modal-shortcut" onClick={applyRoutineValues}>
            <Undo2 size={16} /> Usar valores de la rutina ({item.reps} @ {item.weight} kg)
          </button>
        ) : (
          last && (
            <button type="button" className="button-like modal-shortcut" onClick={applyLast}>
              <History size={16} /> Usar última sesión
            </button>
          )
        ))}

      <div className="set-fields">
        <div className="form-field">
          <label>Repeticiones</label>
          <NumericInput
            kind="integer"
            value={reps}
            valid={repsValid}
            label="Repeticiones"
            onChange={(v) => setState((s) => ({ ...s, reps: v }))}
          />
        </div>
        <div className="form-field">
          <label>Peso (kg)</label>
          <NumericInput
            kind="decimal"
            value={weight}
            valid={weightValid}
            label="Peso en kg"
            onChange={(v) => setState((s) => ({ ...s, weight: v }))}
          />
        </div>
      </div>

      {!valid && <p className="form-error">Necesitas al menos 1 repetición y un peso (0 si no usas carga).</p>}
      <div className="modal-actions">
        {logged && (
          <button type="button" className="danger-solid" onClick={onClear}>
            <Trash2 size={16} /> Borrar registro
          </button>
        )}
        <button onClick={save} disabled={!valid}>
          Guardar serie
        </button>
      </div>
    </>
  )
}
