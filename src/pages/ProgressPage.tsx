import { useMemo, useState } from 'react'
import { useAppData } from '../AppDataContext'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import LineChart from '../components/LineChart'
import { THEME } from '../theme'
import { PROGRESS_RETENTION_WEEKS } from '../utils/retention'
import {
  bestOneRepMax, detectRecords, formatKg, groupRecordsByLog, maxWeightOf, recordKey, setsVolume,
  E1RM_MAX_REPS, RecordKind,
} from '../utils/stats'
import { relativeDayLabel } from '../utils/date'
import { TrendingUp, TrendingDown, Minus, ChevronDown, Check, Trophy } from 'lucide-react'

const SHORT_DATE = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
const RECORD_LABEL: Record<RecordKind, string> = { weight: 'Peso', e1rm: '1RM est.' }
const MAX_RECORDS_SHOWN = 5

export default function ProgressPage() {
  const { data, exerciseMap } = useAppData()
  const [exerciseId, setExerciseId] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const selectedExercise = exerciseMap.get(exerciseId)

  // data.sessions ya viene recortado a las últimas PROGRESS_RETENTION_WEEKS
  // semanas (ver AppDataContext), así que todo lo que se muestra acá cae
  // dentro de esa ventana. Se memoiza por sesiones y ejercicio elegido: si se calculara en cada
  // render, `history` sería un array nuevo cada vez y los useMemo de más abajo (que dependen de
  // él) se recalcularían igualmente, sin ningún beneficio.
  const history = useMemo(
    () =>
      data.sessions
        .flatMap((s) => s.exerciseLogs.map((el) => ({ sessionId: s.id, date: s.date, ...el })))
        .filter((el) => !exerciseId || el.exerciseId === exerciseId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [data.sessions, exerciseId],
  )

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

  const e1rmPoints = useMemo(
    () => ascendingForChart.map((h) => ({ label: SHORT_DATE(h.date), value: bestOneRepMax(h.sets) })).filter((p) => p.value > 0),
    [ascendingForChart],
  )
  const volumePoints = useMemo(
    () => ascendingForChart.map((h) => ({ label: SHORT_DATE(h.date), value: Math.round(setsVolume(h.sets)) })),
    [ascendingForChart],
  )

  // Los récords se calculan siempre sobre todo el historial (la referencia de cada ejercicio es
  // independiente del filtro) y luego se filtran para mostrarlos.
  const records = useMemo(() => detectRecords(data.sessions), [data.sessions])
  const recordsByLog = useMemo(() => groupRecordsByLog(records), [records])
  const visibleRecords = useMemo(
    () =>
      records
        .filter((r) => !exerciseId || r.exerciseId === exerciseId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [records, exerciseId],
  )

  const totalVolume = useMemo(() => history.reduce((sum, h) => sum + setsVolume(h.sets), 0), [history])
  const sessionCount = useMemo(() => new Set(history.map((h) => h.sessionId)).size, [history])
  const bestE1rm = useMemo(() => Math.max(0, ...history.map((h) => bestOneRepMax(h.sets))), [history])

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

      {history.length > 0 && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-value">{Math.round(totalVolume).toLocaleString()} kg</span>
              <span className="stat-label">Volumen total</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{sessionCount}</span>
              <span className="stat-label">{sessionCount === 1 ? 'Sesión' : 'Sesiones'}</span>
            </div>
            {exerciseId && (
              <div className="stat-card">
                <span className="stat-value">{bestE1rm > 0 ? `${formatKg(bestE1rm)} kg` : '—'}</span>
                <span className="stat-label">Mejor 1RM estimado</span>
              </div>
            )}
            <div className="stat-card">
              <span className="stat-value">{visibleRecords.length}</span>
              <span className="stat-label">{visibleRecords.length === 1 ? 'Récord' : 'Récords'}</span>
            </div>
          </div>
          <p className="muted small">
            1RM estimado con la fórmula de Epley (series de hasta {E1RM_MAX_REPS} reps con carga). Volumen = reps × peso.
          </p>

          <div className="chart-title">Récords</div>
          {visibleRecords.length === 0 ? (
            <p className="empty">
              Aún sin récords en este período. Aparecen al superar tu mejor marca anterior de un ejercicio.
            </p>
          ) : (
            <ul className="list">
              {visibleRecords.slice(0, MAX_RECORDS_SHOWN).map((r, i) => (
                <li key={`${r.sessionId}-${r.exerciseId}-${r.kind}-${i}`} className="list-item">
                  <div>
                    <strong>{exerciseMap.get(r.exerciseId)?.name ?? '(eliminado)'}</strong>
                    <div className="muted small">
                      {relativeDayLabel(r.date)} · antes {formatKg(r.previous)}kg
                    </div>
                  </div>
                  <span className="status-badge record">
                    <Trophy size={15} /> {RECORD_LABEL[r.kind]} {formatKg(r.value)}kg
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
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
          {e1rmPoints.length > 0 && (
            <LineChart title="1RM estimado por sesión" unit="kg" points={e1rmPoints} color={THEME.progress.fg} />
          )}
          {totalVolume > 0 && (
            <LineChart title="Volumen por sesión (kg)" unit="" points={volumePoints} color={THEME.progress.fg} />
          )}
          <LineChart title="Evolución de peso máximo" unit="kg" points={maxWeightPoints} color={THEME.progress.fg} />
          <LineChart title="Evolución de repeticiones máximas" unit=" reps" points={maxRepsPoints} color={THEME.progress.fg} />
        </>
      )}

      <details>
        <summary>Ver todos los registros ({history.length})</summary>
        <ul className="list">
          {history.map((h, i) => {
            const exercise = exerciseMap.get(h.exerciseId)
            const maxWeight = maxWeightOf(h.sets)
            const isRecord = recordsByLog.has(recordKey(h.sessionId, h.exerciseId))
            return (
              <li key={i} className="list-item">
                <div>
                  <strong>{exercise?.name ?? '(eliminado)'}</strong>
                  <span className="tag">{new Date(h.date).toLocaleDateString()}</span>
                  {isRecord && <span className="status-badge record"><Trophy size={14} /> Récord</span>}
                </div>
                <div className="muted">
                  {h.sets.map((s) => `${s.reps}x${s.weight}kg`).join(' · ')} — máx {maxWeight}kg · vol {Math.round(setsVolume(h.sets)).toLocaleString()}kg
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
