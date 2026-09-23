import { useState } from 'react'
import { useAppData } from '../AppDataContext'
import { generateId } from '../utils/id'
import { Exercise } from '../types'
import PageHeader from '../components/PageHeader'
import { THEME } from '../theme'
import Modal from '../components/Modal'
import Fab from '../components/Fab'

type Draft = { name: string; muscleGroup: string }
const emptyDraft: Draft = { name: '', muscleGroup: '' }

export default function ExercisesPage() {
  const { data, setData } = useAppData()
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)

  function openEdit(ex: Exercise) {
    setSelected(ex)
    setDraft({ name: ex.name, muscleGroup: ex.muscleGroup })
  }

  function openAdd() {
    setDraft(emptyDraft)
    setAdding(true)
  }

  function closeModal() {
    setSelected(null)
    setAdding(false)
    setDraft(emptyDraft)
  }

  function saveEdit() {
    if (!selected || !draft.name.trim()) return
    setData((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) =>
        ex.id === selected.id ? { ...ex, name: draft.name.trim(), muscleGroup: draft.muscleGroup.trim() } : ex
      ),
    }))
    closeModal()
  }

  function saveNew() {
    if (!draft.name.trim()) return
    const newExercise: Exercise = { id: generateId(), name: draft.name.trim(), muscleGroup: draft.muscleGroup.trim() }
    setData((prev) => ({ ...prev, exercises: [...prev.exercises, newExercise] }))
    closeModal()
  }

  function deleteSelected() {
    if (!selected) return
    setData((prev) => ({ ...prev, exercises: prev.exercises.filter((ex) => ex.id !== selected.id) }))
    closeModal()
  }

  return (
    <div className="page">
      <PageHeader title="Ejercicios" icon={THEME.exercises.icon} color={THEME.exercises} />

      <ul className="list">
        {data.exercises.map((ex) => (
          <li key={ex.id} className="list-item selectable" onClick={() => openEdit(ex)}>
            <div>
              <strong>{ex.name}</strong>
              {ex.muscleGroup && <span className="tag">{ex.muscleGroup}</span>}
            </div>
            <span className="chevron">›</span>
          </li>
        ))}
        {data.exercises.length === 0 && <p className="empty">Aún no hay ejercicios. Pulsa + para añadir uno.</p>}
      </ul>

      <Fab onClick={openAdd} />

      {(selected || adding) && (
        <Modal title={adding ? 'Nuevo ejercicio' : 'Editar ejercicio'} onClose={closeModal}>
          <div className="form-field">
            <label>Nombre</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ej. Press banca"
              autoFocus
            />
          </div>
          <div className="form-field">
            <label>Grupo muscular</label>
            <input
              value={draft.muscleGroup}
              onChange={(e) => setDraft({ ...draft, muscleGroup: e.target.value })}
              placeholder="Ej. Pecho"
            />
          </div>
          <div className="modal-actions">
            {selected && <button className="danger" onClick={deleteSelected}>Eliminar</button>}
            <button onClick={adding ? saveNew : saveEdit}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
