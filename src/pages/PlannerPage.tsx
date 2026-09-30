import { useEffect, useState } from 'react'
import { useAppData } from '../AppDataContext'
import { WEEKDAY_NAMES, todayWeekday, addDays, startOfWeek } from '../utils/date'
import { isRoutineCompletedToday } from '../utils/sessions'
import PageHeader from '../components/PageHeader'
import { THEME } from '../theme'
import Modal from '../components/Modal'
import { Check, CheckCircle2, ChevronRight, History } from 'lucide-react'
import DayLabel from '../components/DayLabel'
import PreviousWeeksCalendar from '../components/PreviousWeeksCalendar'
import { usePreviousWeeks } from '../hooks/usePreviousWeeks'
import { storageService } from '../services'

export default function PlannerPage() {
  const { data, setData } = useAppData()
  const [openDay, setOpenDay] = useState<number | null>(null)
  const [showPrevWeeks, setShowPrevWeeks] = useState(false)
  const today = todayWeekday()
  const prevWeeks = usePreviousWeeks()
  const { load: loadPrevWeeks } = prevWeeks

  // Sin cuenta en la nube no hay llamadas que ahorrar (los datos salen de este dispositivo al
  // instante), así que el calendario se rellena solo. Con cuenta, espera a que se pida.
  useEffect(() => {
    if (!storageService.usesCloud) void loadPrevWeeks()
  }, [loadPrevWeeks])

  function openPrevWeeks() {
    setShowPrevWeeks(true)
    void loadPrevWeeks()
  }

  function toggleRoutineForDay(day: number, routineId: string) {
    setData((prev) => {
      const current = prev.weeklyPlan[day] ?? []
      const exists = current.includes(routineId)
      const updated = exists ? current.filter((id) => id !== routineId) : [...current, routineId]
      return { ...prev, weeklyPlan: { ...prev.weeklyPlan, [day]: updated } }
    })
  }

  const dayOrder = [1, 2, 3, 4, 5, 6, 0] // empieza en lunes
  // Fecha de cada día de la semana en curso (lunes a domingo), para mostrar "Lun 28".
  const monday = startOfWeek(new Date())
  const dateOfDay = (day: number) => addDays(monday, dayOrder.indexOf(day))

  return (
    <div className="page">
      <PageHeader title="Planificación" icon={THEME.planner.icon} color={THEME.planner} showBack={false} />
      <p className="muted">Toca un día para asignarle rutinas.</p>

      {/* Móvil: el calendario de semanas anteriores se abre en un modal y se carga al pulsar (en PC va
          debajo de la línea semanal, como esqueleto con un botón para cargarlo). */}
      <button type="button" className="quick-link-hint prev-weeks-button" onClick={openPrevWeeks}>
        <span className="quick-link-hint-main">
          <History size={16} /> Consultar semanas anteriores
        </span>
        <ChevronRight size={16} />
      </button>

      <div className="timeline">
        {dayOrder.map((day) => {
          const routineIds = data.weeklyPlan[day] ?? []
          const dayRoutines = routineIds
            .map((id) => data.routines.find((r) => r.id === id))
            .filter((r): r is NonNullable<typeof r> => Boolean(r))
          const routineNames = dayRoutines.map((r) => r.name)
          const filled = routineNames.length > 0
          const completedToday = day === today && filled && dayRoutines.every((r) =>
            isRoutineCompletedToday(r, data.sessions)
          )
          return (
            <div
              key={day}
              className={`timeline-item${filled ? ' filled' : ''}${day === today ? ' today' : ''}`}
              onClick={() => setOpenDay(day)}
            >
              <span className="timeline-dot" />
              <div className="timeline-card">
                <DayLabel date={dateOfDay(day)} />
                <span className="timeline-day-detail">{filled ? routineNames.join(' · ') : 'Descanso'}</span>
                {completedToday && <CheckCircle2 size={16} className="day-completed-icon" aria-label="Completado" />}
              </div>
            </div>
          )
        })}
      </div>

      {/* PC: siempre visible debajo de la línea semanal. */}
      <section className="prev-weeks-inline">
        <h2 className="prev-weeks-title">Semanas anteriores</h2>
        <PreviousWeeksCalendar
          status={prevWeeks.status}
          sessions={prevWeeks.sessions}
          fromDevice={prevWeeks.fromDevice}
          onLoad={loadPrevWeeks}
        />
      </section>

      {showPrevWeeks && (
        <Modal title="Semanas anteriores" icon={History} onClose={() => setShowPrevWeeks(false)}>
          <PreviousWeeksCalendar
            status={prevWeeks.status}
            sessions={prevWeeks.sessions}
            fromDevice={prevWeeks.fromDevice}
            onLoad={loadPrevWeeks}
          />
        </Modal>
      )}

      {openDay !== null && (
        <Modal title={`${WEEKDAY_NAMES[openDay]} ${dateOfDay(openDay).getDate()}`} onClose={() => setOpenDay(null)}>
          {data.routines.length === 0 && <p className="empty">Crea alguna rutina primero.</p>}
          <div className="routine-picker">
            {data.routines.map((r) => {
              const checked = (data.weeklyPlan[openDay] ?? []).includes(r.id)
              return (
                <button
                  key={r.id}
                  className={`routine-option${checked ? ' checked' : ''}`}
                  onClick={() => toggleRoutineForDay(openDay, r.id)}
                >
                  <span>{r.name}</span>
                  {checked && <Check size={18} />}
                </button>
              )
            })}
          </div>
          <div className="modal-actions">
            <button onClick={() => setOpenDay(null)}>Listo</button>
          </div>
        </Modal>
      )}
    </div>
  )
}