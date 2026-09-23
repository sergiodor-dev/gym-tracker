import { useState } from 'react'
import { useAppData } from '../AppDataContext'
import PageHeader from '../components/PageHeader'
import { THEME } from '../theme'

export default function ProgressPage() {
  const { data } = useAppData()
  const [exerciseId, setExerciseId] = useState('')

  const history = data.sessions
    .flatMap((s) => s.exerciseLogs.map((el) => ({ date: s.date, ...el })))
    .filter((el) => !exerciseId || el.exerciseId === exerciseId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="page">
      <PageHeader title="Progreso" icon={THEME.progress.icon} color={THEME.progress} showBack={false} />
      <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
        <option value="">Todos los ejercicios</option>
        {data.exercises.map((ex) => (
          <option key={ex.id} value={ex.id}>{ex.name}</option>
        ))}
      </select>

      <ul className="list">
        {history.map((h, i) => {
          const exercise = data.exercises.find((ex) => ex.id === h.exerciseId)
          const maxWeight = Math.max(0, ...h.sets.map((s) => s.weight))
          return (
            <li key={i} className="list-item">
              <div>
                <strong>{exercise?.name ?? '(eliminado)'}</strong>
                <span className="tag">{new Date(h.date).toLocaleDateString()}</span>
              </div>
              <div className="muted">
                {h.sets.map((s) => `${s.reps}x${s.weight}kg`).join(' · ')} — máx {maxWeight}kg
              </div>
            </li>
          )
        })}
        {history.length === 0 && <p className="empty">Aún no hay entrenamientos registrados.</p>}
      </ul>
    </div>
  )
}
