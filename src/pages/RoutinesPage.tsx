import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../AppDataContext'
import { generateId } from '../utils/id'
import { cascadeDeleteRoutine } from '../utils/cascade'
import { MuscleGroup, Routine, RoutineExercise } from '../types'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import Fab from '../components/Fab'
import MuscleGroupFilter from '../components/MuscleGroupFilter'
import { THEME } from '../theme'
import { ArrowRight, ChevronDown, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'

export default function RoutinesPage() {
  const { data, setData, exerciseMap } = useAppData()
  const [draft, setDraft] = useState<Routine | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerFilter, setPickerFilter] = useState<MuscleGroup | ''>('')
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function toggleExpanded(routineId: string) {
    setExpandedId((current) => (current === routineId ? null : routineId))
  }

  function openEdit(routine: Routine) {
    setDraft(structuredClone(routine))
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
  }

  function openPicker() {
    setPickerFilter('')
    setPickerOpen(true)
  }

  function updateName(name: string) {
    setDraft((d) => (d ? { ...d, name } : d))
  }

  function addExercise(exerciseId: string) {
    setDraft((d) => {
      if (!d) return d
      const entry: RoutineExercise = { exerciseId, defaultSets: 3, defaultReps: 10, defaultWeight: 0 }
      return { ...d, exercises: [...d.exercises, entry] }
    })
    setPickerOpen(false)
    setPickerFilter('')
  }

  function updateExerciseField(index: number, field: keyof RoutineExercise, value: number) {
    setDraft((d) => {
      if (!d) return d
      const exercises = [...d.exercises]
      exercises[index] = { ...exercises[index], [field]: value }
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
    if (!draft || !draft.name.trim()) return
    const clean: Routine = { ...draft, name: draft.name.trim() }
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
                    <span className="tag">{r.exercises.length} ejercicios</span>
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
                    {r.exercises.map((re, i) => {
                      const exercise = exerciseMap.get(re.exerciseId)
                      return (
                        <div key={i} className="exercise-summary-row">
                          <span>{exercise?.name ?? '(eliminado)'}</span>
                          <span className="muted small">{re.defaultSets} × {re.defaultReps} @ {re.defaultWeight}kg</span>
                        </div>
                      )
                    })}
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
            <p className="muted small drag-hint">Mantén pulsado <GripVertical size={13} className="inline-icon" /> y arrastra para reordenar.</p>
          )}

          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Ejercicio</th>
                <th>Series</th>
                <th>Reps</th>
                <th>Peso (kg)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {draft.exercises.map((re, i) => {
                const exercise = exerciseMap.get(re.exerciseId)
                return (
                  <tr key={i} data-exercise-row data-index={i} className={dragIndex === i ? 'dragging-row' : undefined}>
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
                    <td>{exercise?.name ?? '(eliminado)'}</td>
                    <td>
                      <input type="number" min={1} value={re.defaultSets}
                        onChange={(e) => updateExerciseField(i, 'defaultSets', Number(e.target.value))} />
                    </td>
                    <td>
                      <input type="number" min={1} value={re.defaultReps}
                        onChange={(e) => updateExerciseField(i, 'defaultReps', Number(e.target.value))} />
                    </td>
                    <td>
                      <input type="number" min={0} step={0.5} value={re.defaultWeight}
                        onChange={(e) => updateExerciseField(i, 'defaultWeight', Number(e.target.value))} />
                    </td>
                    <td>
                      <button className="danger" onClick={() => removeExercise(i)}>✕</button>
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

          <div className="modal-actions">
            <button onClick={saveDraft}>Guardar</button>
          </div>
        </Modal>
      )}

      {pickerOpen && (
        <Modal title="Selecciona un ejercicio" onClose={() => setPickerOpen(false)}>
          <MuscleGroupFilter value={pickerFilter} onChange={setPickerFilter} />
          <div className="routine-picker">
            {pickerExercises.map((ex) => (
              <button key={ex.id} className="routine-option" onClick={() => addExercise(ex.id)}>
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
