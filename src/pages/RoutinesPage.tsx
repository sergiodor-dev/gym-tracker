import { useState } from 'react'
import { useAppData } from '../AppDataContext'
import { generateId } from '../utils/id'
import { Routine, RoutineExercise } from '../types'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import Fab from '../components/Fab'
import { THEME } from '../theme'
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'

export default function RoutinesPage() {
  const { data, setData } = useAppData()
  const [draft, setDraft] = useState<Routine | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null)

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
    setData((prev) => ({ ...prev, routines: prev.routines.filter((r) => r.id !== deleteTarget.id) }))
    if (expandedId === deleteTarget.id) setExpandedId(null)
    setDeleteTarget(null)
  }

  return (
    <div className="page">
      <PageHeader title="Rutinas" icon={THEME.routines.icon} color={THEME.routines} showBack={false} />

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
                      const exercise = data.exercises.find((ex) => ex.id === re.exerciseId)
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

      <Fab onClick={openAdd} />

      {draft && (
        <Modal title={isNew ? 'Nueva rutina' : 'Editar rutina'} onClose={closeModal}>
          <div className="form-field">
            <label>Nombre</label>
            <input value={draft.name} onChange={(e) => updateName(e.target.value)} placeholder="Ej. Día de pierna" autoFocus />
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Ejercicio</th>
                <th>Series</th>
                <th>Reps</th>
                <th>Peso (kg)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {draft.exercises.map((re, i) => {
                const exercise = data.exercises.find((ex) => ex.id === re.exerciseId)
                return (
                  <tr key={i}>
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
                <td colSpan={5}>
                  <button type="button" className="add-exercise-row-btn" onClick={() => setPickerOpen(true)}>
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
          <div className="routine-picker">
            {data.exercises.map((ex) => (
              <button key={ex.id} className="routine-option" onClick={() => addExercise(ex.id)}>
                <span>{ex.name}</span>
                {ex.muscleGroup && <span className="muted small">{ex.muscleGroup}</span>}
              </button>
            ))}
            {data.exercises.length === 0 && <p className="empty">Aún no hay ejercicios creados.</p>}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Eliminar rutina" onClose={() => setDeleteTarget(null)}>
          <p>¿De verdad quieres eliminar la rutina "{deleteTarget.name}"?</p>
          <div className="modal-actions">
            <button className="button-like" onClick={() => setDeleteTarget(null)}>Cancelar</button>
            <button className="danger-solid" onClick={confirmDelete}>Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
