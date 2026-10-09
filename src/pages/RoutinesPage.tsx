import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../AppDataContext'
import { generateId } from '../utils/id'
import { isValidDecimal, isValidInteger, parseDecimal } from '../utils/numericInput'
import { cascadeDeleteRoutine } from '../utils/cascade'
import { countExercises, setOrdinals } from '../utils/routineItems'
import { MuscleGroup, Routine } from '../types'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import NumericInput from '../components/NumericInput'
import ConfirmModal from '../components/ConfirmModal'
import Fab from '../components/Fab'
import MuscleGroupFilter from '../components/MuscleGroupFilter'
import { THEME } from '../theme'
import { ArrowRight, ChevronDown, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'

// El formulario edita reps y peso como texto (ver utils/numericInput.ts): con Number('') un campo
// vacío pasaba a 0 y no se podía borrar el valor para escribir otro. Solo al guardar la rutina se
// convierten a número. Cada elemento es UNA serie; añadir un ejercicio con N series crea N elementos.
interface DraftItem {
  id: string
  exerciseId: string
  reps: string
  weight: string
  required: boolean
}

interface DraftRoutine {
  id: string
  name: string
  exercises: DraftItem[]
}

// Valores del paso "añadir ejercicio" (nº de series que se crearán y sus valores iniciales).
interface AddForm {
  exerciseId: string
  sets: string
  reps: string
  weight: string
  required: boolean
}

function toDraftRoutine(r: Routine): DraftRoutine {
  return {
    id: r.id,
    name: r.name,
    exercises: r.exercises.map((it) => ({
      id: it.id,
      exerciseId: it.exerciseId,
      reps: String(it.reps),
      weight: String(it.weight),
      required: it.required,
    })),
  }
}

function fromDraftRoutine(d: DraftRoutine): Routine {
  return {
    id: d.id,
    name: d.name.trim(),
    exercises: d.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      reps: Number(e.reps),
      weight: parseDecimal(e.weight),
      required: e.required,
    })),
  }
}

const MAX_SETS_PER_ADD = 20

const isRepsValid = (e: { reps: string }) => isValidInteger(e.reps, 1)
const isWeightValid = (e: { weight: string }) => isValidDecimal(e.weight)

export default function RoutinesPage() {
  const { data, setData, exerciseMap } = useAppData()
  const [draft, setDraft] = useState<DraftRoutine | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerFilter, setPickerFilter] = useState<MuscleGroup | ''>('')
  const [addForm, setAddForm] = useState<AddForm | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function toggleExpanded(routineId: string) {
    setExpandedId((current) => (current === routineId ? null : routineId))
  }

  function openEdit(routine: Routine) {
    setDraft(toDraftRoutine(routine))
    setIsNew(false)
  }

  function openAdd() {
    setDraft({ id: generateId(), name: '', exercises: [] })
    setIsNew(true)
  }

  function closeModal() {
    setDraft(null)
    setIsNew(false)
    setPickerOpen(false)
    setPickerFilter('')
    setAddForm(null)
  }

  function openPicker() {
    setPickerFilter('')
    setPickerOpen(true)
  }

  function updateName(name: string) {
    setDraft((d) => (d ? { ...d, name } : d))
  }

  // Paso 1: al elegir el ejercicio se pasa al formulario de series/reps/peso/obligatoria.
  function pickExercise(exerciseId: string) {
    setAddForm({ exerciseId, sets: '3', reps: '10', weight: '0', required: true })
  }

  function closePicker() {
    setPickerOpen(false)
    setPickerFilter('')
    setAddForm(null)
  }

  // Paso 2: crea tantos elementos (series) del ejercicio como se haya indicado, al final de la lista.
  // Después se pueden editar y reordenar uno a uno.
  function confirmAddExercise() {
    if (!addForm || !addFormValid) return
    const count = Number(addForm.sets)
    setDraft((d) => {
      if (!d) return d
      const items: DraftItem[] = Array.from({ length: count }, () => ({
        id: generateId(),
        exerciseId: addForm.exerciseId,
        reps: addForm.reps,
        weight: addForm.weight,
        required: addForm.required,
      }))
      return { ...d, exercises: [...d.exercises, ...items] }
    })
    closePicker()
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setDraft((d) => {
      if (!d) return d
      const exercises = [...d.exercises]
      exercises[index] = { ...exercises[index], ...patch }
      return { ...d, exercises }
    })
  }

  function removeExercise(index: number) {
    setDraft((d) => (d ? { ...d, exercises: d.exercises.filter((_, i) => i !== index) } : d))
  }

  function reorderExercise(from: number, to: number) {
    setDraft((d) => {
      if (!d) return d
      const exercises = [...d.exercises]
      const [moved] = exercises.splice(from, 1)
      exercises.splice(to, 0, moved)
      return { ...d, exercises }
    })
  }

  function handleDragHandlePointerDown(index: number) {
    return (e: React.PointerEvent<HTMLSpanElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragIndex(index)
    }
  }

  function handleDragHandlePointerMove(e: React.PointerEvent<HTMLSpanElement>) {
    if (dragIndex === null) return
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const row = target?.closest('tr[data-exercise-row]') as HTMLElement | null
    if (!row) return
    const overIndex = Number(row.dataset.index)
    if (Number.isNaN(overIndex) || overIndex === dragIndex) return
    reorderExercise(dragIndex, overIndex)
    setDragIndex(overIndex)
  }

  function handleDragHandlePointerUp(e: React.PointerEvent<HTMLSpanElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setDragIndex(null)
  }

  function saveDraft() {
    if (!draft || !draft.name.trim() || !exercisesValid) return
    const clean = fromDraftRoutine(draft)
    setData((prev) => {
      const exists = prev.routines.some((r) => r.id === clean.id)
      return {
        ...prev,
        routines: exists
          ? prev.routines.map((r) => (r.id === clean.id ? clean : r))
          : [...prev.routines, clean],
      }
    })
    closeModal()
  }

  function confirmDelete() {
    if (!deleteTarget) return
    setData((prev) => cascadeDeleteRoutine(prev, deleteTarget.id))
    if (expandedId === deleteTarget.id) setExpandedId(null)
    setDeleteTarget(null)
  }

  // Todas las series del formulario tienen reps (mín. 1) y peso; si no, no se puede guardar.
  const exercisesValid = draft ? draft.exercises.every((e) => isRepsValid(e) && isWeightValid(e)) : true

  const addFormValid = addForm
    ? isValidInteger(addForm.sets, 1) &&
      Number(addForm.sets) <= MAX_SETS_PER_ADD &&
      isRepsValid(addForm) &&
      isWeightValid(addForm)
    : false

  // "Serie 2/4" por elemento, para distinguir las series de un mismo ejercicio dentro de la lista.
  const draftOrdinals = draft ? setOrdinals(draft.exercises.map((e) => ({ ...e, reps: 0, weight: 0 }))) : null

  const pickerExercises = pickerFilter
    ? data.exercises.filter((ex) => ex.muscleGroup === pickerFilter)
    : data.exercises

  return (
    <div className="page">
      <PageHeader title="Rutinas" icon={THEME.routines.icon} color={THEME.routines} />

      <Link to="/exercises" className="quick-link-hint">
        <span>¿Faltan ejercicios para tu rutina?</span>
        <span className="quick-link-hint-action">
          Ir a Ejercicios <ArrowRight size={14} />
        </span>
      </Link>

      <ul className="list">
        {data.routines.map((r) => {
          const expanded = expandedId === r.id
          return (
            <li key={r.id} className={`routine-item${expanded ? ' expanded' : ''}`}>
              <div className="routine-card">
                <div className="list-item-header" onClick={() => toggleExpanded(r.id)}>
                  <ChevronDown size={18} className="accordion-chevron" />
                  <div className="list-item-title-group">
                    <strong>{r.name}</strong>
                    <span className="tag">{countExercises(r.exercises)} ejercicios</span>
                  </div>
                  <div className="list-item-actions">
                    <button
                      className="icon-btn"
                      aria-label="Editar rutina"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(r)
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-btn danger-icon"
                      aria-label="Eliminar rutina"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(r)
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="drawer">
                <div className="drawer-inner">
                  <div className="drawer-box">
                    {r.exercises.length === 0 && <p className="empty">Esta rutina aún no tiene ejercicios.</p>}
                    {(() => {
                      const ords = setOrdinals(r.exercises)
                      return r.exercises.map((re) => {
                        const exercise = exerciseMap.get(re.exerciseId)
                        const ord = ords.get(re.id)
                        return (
                          <div key={re.id} className="exercise-summary-row">
                            <span>
                              {exercise?.name ?? '(eliminado)'}
                              {ord && ord.of > 1 && <span className="muted small"> · {ord.n}/{ord.of}</span>}
                              {!re.required && <span className="tag tag-optional">Opcional</span>}
                            </span>
                            <span className="muted small">{re.reps} reps @ {re.weight}kg</span>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
        {data.routines.length === 0 && <p className="empty">Aún no hay rutinas. Pulsa + para crear una.</p>}
      </ul>

      <Fab onClick={openAdd} color={THEME.routines.fg} />

      {draft && (
        <Modal title={isNew ? 'Nueva rutina' : 'Editar rutina'} onClose={closeModal}>
          <div className="form-field">
            <label>Nombre</label>
            <input value={draft.name} onChange={(e) => updateName(e.target.value)} placeholder="Ej. Día de pierna" autoFocus />
          </div>

          {draft.exercises.length > 1 && (
            <p className="muted small drag-hint">Mantén pulsado <GripVertical size={13} className="inline-icon" /> y arrastra cada serie para reordenar. Las marcadas como obligatorias son las que cuentan para completar la rutina.</p>
          )}

          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Ejercicio</th>
                <th>Reps</th>
                <th>Peso (kg)</th>
                <th>Oblig.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {draft.exercises.map((re, i) => {
                const exercise = exerciseMap.get(re.exerciseId)
                const ord = draftOrdinals?.get(re.id)
                const name = exercise?.name ?? 'ejercicio'
                return (
                  <tr key={re.id} data-exercise-row data-index={i} className={dragIndex === i ? 'dragging-row' : undefined}>
                    <td className="drag-handle-cell">
                      <span
                        className="drag-handle"
                        onPointerDown={handleDragHandlePointerDown(i)}
                        onPointerMove={handleDragHandlePointerMove}
                        onPointerUp={handleDragHandlePointerUp}
                        onPointerCancel={handleDragHandlePointerUp}
                      >
                        <GripVertical size={16} />
                      </span>
                    </td>
                    <td>
                      {exercise?.name ?? '(eliminado)'}
                      {ord && ord.of > 1 && <div className="muted small">{ord.n}/{ord.of}</div>}
                    </td>
                    <td>
                      <NumericInput
                        kind="integer"
                        value={re.reps}
                        valid={isRepsValid(re)}
                        label={`Repeticiones de ${name}`}
                        onChange={(v) => updateItem(i, { reps: v })}
                      />
                    </td>
                    <td>
                      <NumericInput
                        kind="decimal"
                        value={re.weight}
                        valid={isWeightValid(re)}
                        label={`Peso en kg de ${name}`}
                        onChange={(v) => updateItem(i, { weight: v })}
                      />
                    </td>
                    <td className="required-cell">
                      <input
                        type="checkbox"
                        checked={re.required}
                        aria-label={`${name}${ord && ord.of > 1 ? `, serie ${ord.n} de ${ord.of}` : ''}: obligatoria`}
                        onChange={(e) => updateItem(i, { required: e.target.checked })}
                      />
                    </td>
                    <td>
                      <button className="danger" aria-label="Eliminar serie" onClick={() => removeExercise(i)}>✕</button>
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td colSpan={6}>
                  <button type="button" className="add-exercise-row-btn" onClick={openPicker}>
                    <Plus size={16} /> Añadir ejercicio
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          {!exercisesValid && (
            <p className="form-error">Cada serie necesita al menos 1 repetición y un peso (0 si no usas carga).</p>
          )}
          <div className="modal-actions">
            <button onClick={saveDraft} disabled={!exercisesValid}>Guardar</button>
          </div>
        </Modal>
      )}

      {pickerOpen && !addForm && (
        <Modal title="Selecciona un ejercicio" onClose={closePicker}>
          <MuscleGroupFilter value={pickerFilter} onChange={setPickerFilter} />
          <div className="routine-picker">
            {pickerExercises.map((ex) => (
              <button key={ex.id} className="routine-option" onClick={() => pickExercise(ex.id)}>
                <span>{ex.name}</span>
                {ex.muscleGroup && <span className="muted small">{ex.muscleGroup}</span>}
              </button>
            ))}
            {data.exercises.length === 0 && <p className="empty">Aún no hay ejercicios creados.</p>}
            {data.exercises.length > 0 && pickerExercises.length === 0 && (
              <p className="empty">No hay ejercicios en ese grupo muscular.</p>
            )}
          </div>
        </Modal>
      )}

      {pickerOpen && addForm && (
        <Modal title={exerciseMap.get(addForm.exerciseId)?.name ?? 'Añadir ejercicio'} onClose={closePicker}>
          <p className="muted small">
            Se añadirá una entrada por cada serie, al final de la rutina. Luego puedes editar o mover cada una por separado.
          </p>
          <div className="form-field">
            <label>Series</label>
            <NumericInput
              kind="integer"
              value={addForm.sets}
              valid={isValidInteger(addForm.sets, 1) && Number(addForm.sets) <= MAX_SETS_PER_ADD}
              label="Número de series"
              onChange={(v) => setAddForm((f) => (f ? { ...f, sets: v } : f))}
            />
          </div>
          <div className="form-field">
            <label>Repeticiones por serie</label>
            <NumericInput
              kind="integer"
              value={addForm.reps}
              valid={isRepsValid(addForm)}
              label="Repeticiones por serie"
              onChange={(v) => setAddForm((f) => (f ? { ...f, reps: v } : f))}
            />
          </div>
          <div className="form-field">
            <label>Peso (kg)</label>
            <NumericInput
              kind="decimal"
              value={addForm.weight}
              valid={isWeightValid(addForm)}
              label="Peso en kg"
              onChange={(v) => setAddForm((f) => (f ? { ...f, weight: v } : f))}
            />
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={addForm.required}
              onChange={(e) => setAddForm((f) => (f ? { ...f, required: e.target.checked } : f))}
            />
            Obligatorias (cuentan para completar la rutina)
          </label>
          {!addFormValid && (
            <p className="form-error">Series entre 1 y {MAX_SETS_PER_ADD}, al menos 1 repetición y un peso (0 si no usas carga).</p>
          )}
          <div className="modal-actions">
            <button type="button" className="button-like" onClick={() => setAddForm(null)}>Atrás</button>
            <button onClick={confirmAddExercise} disabled={!addFormValid}>Añadir</button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Eliminar rutina"
          icon={Trash2}
          message={<p>¿De verdad quieres eliminar la rutina "{deleteTarget.name}"?</p>}
          confirmLabel="Eliminar"
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
