import { useMemo, useState } from 'react'
import { useAppData } from '../AppDataContext'
import { isRoutineCompletedOn } from '../utils/sessions'
import { addDays, localDayKey, startOfWeek, WEEKDAY_NAMES, WEEKDAY_SHORT } from '../utils/date'
import PageHeader from '../components/PageHeader'
import RoutineLogger from '../components/RoutineLogger'
import { THEME } from '../theme'
import { CheckCircle2, ChevronRight } from 'lucide-react'

export default function WorkoutPage() {
  const { data } = useAppData()

  // Día sobre el que se registra: por defecto hoy, pero se puede elegir cualquier día anterior de la
  // semana en curso (lunes a domingo) para apuntar un entreno que se olvidó o no se pudo registrar.
  // `null` significa "hoy" y sigue a hoy si la página queda abierta pasada la medianoche. Los días de
  // semanas anteriores se registran desde el calendario de Planificación (ver DayEditorModal).
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null)

  const now = new Date()
  const todayStart = addDays(now, 0)
  const todayKey = localDayKey(todayStart)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(now), i))
  const targetDay =
    weekDays.find((d) => localDayKey(d) === selectedDayKey && d.getTime() <= todayStart.getTime()) ?? todayStart
  const isViewingToday = localDayKey(targetDay) === todayKey
  const weekday = targetDay.getDay()
  const todaysRoutineIds = data.weeklyPlan[weekday] ?? []
  const todaysRoutines = data.routines.filter((r) => todaysRoutineIds.includes(r.id))
  const otherRoutines = data.routines.filter((r) => !todaysRoutineIds.includes(r.id))

  // Días (YYYY-MM-DD) con algún ejercicio registrado, para marcar el selector de día.
  const trainedDayKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const s of data.sessions) {
      const t = new Date(s.date)
      if (!Number.isNaN(t.getTime()) && s.exerciseLogs.length > 0) keys.add(localDayKey(t))
    }
    return keys
  }, [data.sessions])

  const activeRoutine = data.routines.find((r) => r.id === activeRoutineId) ?? null

  if (activeRoutine) {
    return (
      <div className="page">
        <PageHeader title={activeRoutine.name} icon={THEME.train.icon} color={THEME.train} onBack={() => setActiveRoutineId(null)} />
        <RoutineLogger routine={activeRoutine} day={targetDay} presentation="modal" />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title={isViewingToday ? 'Entrenar hoy' : 'Registrar entreno'}
        icon={THEME.train.icon}
        color={THEME.train}
      />

      <div className="day-picker" role="group" aria-label="Día de la semana">
        {weekDays.map((d) => {
          const key = localDayKey(d)
          const future = d.getTime() > todayStart.getTime()
          const selected = key === localDayKey(targetDay)
          return (
            <button
              key={key}
              type="button"
              className={`day-pill${selected ? ' active' : ''}${key === todayKey ? ' today' : ''}`}
              disabled={future}
              aria-pressed={selected}
              aria-label={`${WEEKDAY_NAMES[d.getDay()]} ${d.getDate()}${trainedDayKeys.has(key) ? ', con entreno registrado' : ''}`}
              onClick={() => setSelectedDayKey(key === todayKey ? null : key)}
            >
              <span className="day-pill-name">{WEEKDAY_SHORT[d.getDay()]}</span>
              <span className="day-pill-num">{d.getDate()}</span>
              <span className={`day-pill-dot${trainedDayKeys.has(key) ? ' on' : ''}`} aria-hidden="true" />
            </button>
          )
        })}
      </div>

      <p className="muted">
        {isViewingToday
          ? `Hoy es ${WEEKDAY_NAMES[weekday]}`
          : `Registrando el ${WEEKDAY_NAMES[weekday].toLowerCase()} ${targetDay.getDate()}`}
      </p>

      {todaysRoutines.length === 0 && (
        <p className="empty">
          {isViewingToday
            ? 'No hay rutina planificada para hoy. Ve a "Planificación" para asignarla.'
            : `No había rutina planificada para el ${WEEKDAY_NAMES[weekday].toLowerCase()}. Puedes registrar otra abajo.`}
        </p>
      )}

      <ul className="list">
        {todaysRoutines.map((r) => {
          const completed = isRoutineCompletedOn(r, data.sessions, targetDay)
          return (
            <li key={r.id} className="list-item selectable" onClick={() => setActiveRoutineId(r.id)}>
              <div>
                <strong>{r.name}</strong>
                <span className="tag">{r.exercises.length} ejercicios</span>
              </div>
              {completed ? (
                <span className="status-badge success"><CheckCircle2 size={15} /> Completada</span>
              ) : (
                <ChevronRight size={18} className="chevron" />
              )}
            </li>
          )
        })}
      </ul>

      <details>
        <summary>{isViewingToday ? 'Iniciar otra rutina (no planificada hoy)' : 'Registrar otra rutina (no planificada ese día)'}</summary>
        <ul className="list">
          {otherRoutines.map((r) => (
            <li key={r.id} className="list-item selectable" onClick={() => setActiveRoutineId(r.id)}>
              <strong>{r.name}</strong>
              <ChevronRight size={18} className="chevron" />
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
