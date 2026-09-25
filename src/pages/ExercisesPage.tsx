import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useAppData } from '../AppDataContext'
import { generateId } from '../utils/id'
import { Exercise, MuscleGroup } from '../types'
import PageHeader from '../components/PageHeader'
import { THEME } from '../theme'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import Fab from '../components/Fab'
import MuscleGroupFilter from '../components/MuscleGroupFilter'

type Draft = { name: string; muscleGroup: MuscleGroup | '' }
const emptyDraft: Draft = { name: '', muscleGroup: '' }

export default function ExercisesPage() {
  const { data, setData } = useAppData()
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [filterGroup, setFilterGroup] = useState<MuscleGroup | ''>('')
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null)

  const filteredExercises = filterGroup
    ? data.exercises.filter((ex) => ex.muscleGroup === filterGroup)
    : data.exercises

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
        ex.id === selected.id ? { ...ex, name: draft.name.trim(), muscleGroup: draft.muscleGroup } : ex
      ),
    }))
    closeModal()
  }

  function saveNew() {
    if (!draft.name.trim()) return
    const newExercise: Exercise = { id: generateId(), name: draft.name.trim(), muscleGroup: draft.muscleGroup }
    setData((prev) => ({ ...prev, exercises: [...prev.exercises, newExercise] }))
    closeModal()
  }

  function askDelete() {
    if (!selected) return
    setDeleteTarget(selected)
    closeModal()
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setData((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((ex) => ex.id !== id),
      // Quita el ejercicio eliminado de las rutinas que lo incluyan...
      routines: prev.routines.map((r) => ({
        ...r,
        exercises: r.exercises.filter((re) => re.exerciseId !== id),
      })),
      // ...y de los registros de progreso ya guardados.
      sessions: prev.sessions.map((s) => ({
        ...s,
        exerciseLogs: s.exerciseLogs.filter((el) => el.exerciseId !== id),
      })),
    }))
    setDeleteTarget(null)
  }

  return (
    <div className="page">
      <PageHeader title="Ejercicios" icon={THEME.exercises.icon} color={THEME.exercises} />

      {data.exercises.length > 0 && <MuscleGroupFilter value={filterGroup} onChange={setFilterGroup} />}

      <ul className="list">
        {filteredExercises.map((ex) => (
          <li key={ex.id} className="list-item selectable" onClick={() => openEdit(ex)}>
            <div>
              <strong>{ex.name}</strong>
              {ex.muscleGroup && <span className="tag">{ex.muscleGroup}</span>}
            </div>
            <span className="chevron">›</span>
          </li>
        ))}
        {data.exercises.length === 0 && <p className="empty">Aún no hay ejercicios. Pulsa + para añadir uno.</p>}
        {data.exercises.length > 0 && filteredExercises.length === 0 && (
          <p className="empty">No hay ejercicios en ese grupo muscular.</p>
        )}
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
            <MuscleGroupFilter
              value={draft.muscleGroup}
              onChange={(group) => setDraft({ ...draft, muscleGroup: group })}
              emptyLabel="Sin especificar"
            />
          </div>
          <div className="modal-actions">
            {selected && <button className="danger" onClick={askDelete}>Eliminar</button>}
            <button onClick={adding ? saveNew : saveEdit}>Guardar</button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Eliminar ejercicio"
          icon={Trash2}
          message={
            <>
              <p>¿De verdad quieres eliminar "{deleteTarget.name}"?</p>
              <p className="muted small">
                También se quitará de las rutinas que lo incluyan y se borrará su historial de progreso.
              </p>
            </>
          }
          confirmLabel="Eliminar"
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
