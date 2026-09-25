import { useState } from 'react'
import { useAppData } from '../AppDataContext'
import { WEEKDAY_NAMES, todayWeekday } from '../utils/date'
import { isRoutineCompletedToday } from '../utils/sessions'
import PageHeader from '../components/PageHeader'
import { THEME } from '../theme'
import Modal from '../components/Modal'
import { Check, CheckCircle2 } from 'lucide-react'

export default function PlannerPage() {
  const { data, setData } = useAppData()
  const [openDay, setOpenDay] = useState<number | null>(null)
  const today = todayWeekday()

  function toggleRoutineForDay(day: number, routineId: string) {
    setData((prev) => {
      const current = prev.weeklyPlan[day] ?? []
      const exists = current.includes(routineId)
      const updated = exists ? current.filter((id) => id !== routineId) : [...current, routineId]
      return { ...prev, weeklyPlan: { ...prev.weeklyPlan, [day]: updated } }
    })
  }

  const dayOrder = [1, 2, 3, 4, 5, 6, 0] // empieza en lunes

  return (
    <div className="page">
      <PageHeader title="Planificación" icon={THEME.planner.icon} color={THEME.planner} showBack={false} />
      <p className="muted">Toca un día para asignarle rutinas.</p>

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
                <div className="timeline-day-name-row">
                  <span className="timeline-day-name">{WEEKDAY_NAMES[day]}</span>
                  {completedToday && <CheckCircle2 size={15} className="day-completed-icon" />}
                </div>
                <span className="timeline-day-detail">{filled ? routineNames.join(' · ') : 'Descanso'}</span>
              </div>
            </div>
          )
        })}
      </div>

      {openDay !== null && (
        <Modal title={WEEKDAY_NAMES[openDay]} onClose={() => setOpenDay(null)}>
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
