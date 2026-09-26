import { useMemo, useState } from 'react'
import { useAppData } from '../AppDataContext'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import LineChart from '../components/LineChart'
import { THEME } from '../theme'
import { PROGRESS_RETENTION_WEEKS } from '../utils/retention'
import { TrendingUp, TrendingDown, Minus, ChevronDown, Check } from 'lucide-react'

const SHORT_DATE = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })

export default function ProgressPage() {
  const { data, exerciseMap } = useAppData()
  const [exerciseId, setExerciseId] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const selectedExercise = exerciseMap.get(exerciseId)

  // data.sessions ya viene recortado a las últimas PROGRESS_RETENTION_WEEKS
  // semanas (ver AppDataContext), así que todo lo que se muestra acá cae
  // dentro de esa ventana.
  const history = data.sessions
    .flatMap((s) => s.exerciseLogs.map((el) => ({ date: s.date, ...el })))
    .filter((el) => !exerciseId || el.exerciseId === exerciseId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Historial ascendente (más antiguo primero) del ejercicio seleccionado,
  // una entrada por sesión, para alimentar las gráficas de evolución.
  const ascendingForChart = useMemo(() => {
    return [...history].reverse()
  }, [history])

  const maxWeightPoints = useMemo(
    () => ascendingForChart.map((h) => ({ label: SHORT_DATE(h.date), value: Math.max(0, ...h.sets.map((s) => s.weight)) })),
    [ascendingForChart],
  )
  const maxRepsPoints = useMemo(
    () => ascendingForChart.map((h) => ({ label: SHORT_DATE(h.date), value: Math.max(0, ...h.sets.map((s) => s.reps)) })),
    [ascendingForChart],
  )

  const comparison = useMemo(() => {
    if (!exerciseId || history.length < 2) return null
    const oldest = history[history.length - 1]
    const newest = history[0]
    const maxOf = (sets: typeof oldest.sets) => Math.max(0, ...sets.map((s) => s.weight))
    const delta = maxOf(newest.sets) - maxOf(oldest.sets)
    return { oldestDate: oldest.date, newestDate: newest.date, oldestMax: maxOf(oldest.sets), newestMax: maxOf(newest.sets), delta }
  }, [exerciseId, history])

  return (
    <div className="page">
      <PageHeader title="Progreso" icon={THEME.progress.icon} color={THEME.progress} showBack={false} />
      <p className="muted small">Mostrando las últimas {PROGRESS_RETENTION_WEEKS} semanas de entrenamientos.</p>

      <button type="button" className="picker-trigger" onClick={() => setPickerOpen(true)}>
        {selectedExercise ? selectedExercise.name : 'Todos los ejercicios'}
        <ChevronDown size={18} className="chevron" />
      </button>

      {pickerOpen && (
        <Modal title="Elegir ejercicio" onClose={() => setPickerOpen(false)}>
          <ul className="list">
            <li
              className="list-item selectable"
              onClick={() => { setExerciseId(''); setPickerOpen(false) }}
            >
              <strong>Todos los ejercicios</strong>
              {exerciseId === '' && <Check size={18} />}
            </li>
            {data.exercises.map((ex) => (
              <li
                key={ex.id}
                className="list-item selectable"
                onClick={() => { setExerciseId(ex.id); setPickerOpen(false) }}
              >
                <div>
                  <strong>{ex.name}</strong>
                  {ex.muscleGroup && <span className="tag">{ex.muscleGroup}</span>}
                </div>
                {exerciseId === ex.id && <Check size={18} />}
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {comparison && (
        <div className="list-item" style={{ marginTop: '0.75rem' }}>
          <div>
            <strong>Comparación en el período</strong>
            <div className="muted small">
              {new Date(comparison.oldestDate).toLocaleDateString()} ({comparison.oldestMax}kg) → {new Date(comparison.newestDate).toLocaleDateString()} ({comparison.newestMax}kg)
            </div>
          </div>
          {comparison.delta > 0 && (
            <span className="status-badge success"><TrendingUp size={15} /> +{comparison.delta}kg</span>
          )}
          {comparison.delta < 0 && (
            <span className="status-badge pending"><TrendingDown size={15} /> {comparison.delta}kg</span>
          )}
          {comparison.delta === 0 && (
            <span className="status-badge"><Minus size={15} /> sin cambios</span>
          )}
        </div>
      )}

      {exerciseId && (
        <>
          <LineChart title="Evolución de peso máximo" unit="kg" points={maxWeightPoints} color={THEME.progress.fg} />
          <LineChart title="Evolución de repeticiones máximas" unit=" reps" points={maxRepsPoints} color={THEME.progress.fg} />
        </>
      )}

      <details>
        <summary>Ver todos los registros ({history.length})</summary>
        <ul className="list">
          {history.map((h, i) => {
            const exercise = exerciseMap.get(h.exerciseId)
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
      </details>
    </div>
  )
}
