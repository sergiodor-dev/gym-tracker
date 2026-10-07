import { useMemo, type KeyboardEvent } from 'react'
import { CheckCircle2, Minus } from 'lucide-react'
import { useAppData } from '../AppDataContext'
import { buildPreviousWeeks, type CalendarStatus } from '../utils/calendar'
import { formatDayMonth, addDays, WEEKDAY_NAMES } from '../utils/date'
import DayLabel from './DayLabel'

const STATUS_LABEL: Record<CalendarStatus, string> = {
  done: 'Completada',
  partial: 'Incompleta',
}

function StatusIcon({ status }: { status: CalendarStatus }) {
  return status === 'done' ? <CheckCircle2 size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />
}

interface Props {
  // Se llama al pulsar un día editable: PlannerPage abre el editor de ese día (DayEditorModal).
  onSelectDay: (day: Date) => void
}

// Calendario con lo registrado en las semanas anteriores (dentro de la ventana de retención). Solo
// muestra las rutinas con sesión ese día, completadas o incompletas; los días sin sesión ponen "Sin
// datos". Cada día se puede pulsar para ver su sesión, editarla o, si no hay ninguna, añadir los datos.
// Se pinta con data.sessions, que ya contiene toda la ventana de retención, así que no hay carga aparte
// y lo que se registre o se borre desde el editor de día se ve al instante.
// Se usa tanto inline (PC) como dentro de un modal (móvil), ver PlannerPage.
export default function PreviousWeeksCalendar({ onSelectDay }: Props) {
  const { data } = useAppData()
  const weeks = useMemo(
    () => buildPreviousWeeks({ routines: data.routines, sessions: data.sessions }),
    [data.routines, data.sessions],
  )

  return (
    <>
      {weeks.length === 0 ? (
        <p className="empty">Aún no hay sesiones registradas en semanas anteriores.</p>
      ) : (
        <div className="prev-weeks">
          <p className="cal-legend">
            {(Object.keys(STATUS_LABEL) as CalendarStatus[]).map((s) => (
              <span key={s} className={s}>
                <StatusIcon status={s} /> {STATUS_LABEL[s]}
              </span>
            ))}
          </p>
          <p className="muted small cal-hint">Toca un día para ver su sesión, editarla o añadir datos.</p>

          {weeks.map((week) => (
            <section key={week.monday.getTime()}>
              <h3 className="cal-week-title">
                Semana del {formatDayMonth(week.monday)} al {formatDayMonth(addDays(week.monday, 6))}
              </h3>
              <div className="cal-week-grid">
                {week.days.map((day) => {
                  const dayName = `${WEEKDAY_NAMES[day.date.getDay()]} ${day.date.getDate()}`
                  const summary =
                    day.entries.length === 0
                      ? 'sin datos'
                      : day.entries.map((en) => `${en.name} ${STATUS_LABEL[en.status].toLowerCase()}`).join(', ')
                  return (
                    <div
                      key={day.date.getTime()}
                      className={`cal-day${day.entries.length === 0 ? ' nodata' : ''}${day.editable ? ' editable' : ''}`}
                      {...(day.editable
                        ? {
                            role: 'button',
                            tabIndex: 0,
                            'aria-label': `${dayName}, ${summary}. Ver o editar la sesión`,
                            onClick: () => onSelectDay(day.date),
                            onKeyDown: (e: KeyboardEvent) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onSelectDay(day.date)
                              }
                            },
                          }
                        : {})}
                    >
                      <DayLabel date={day.date} />
                      <div className="cal-day-body">
                        {day.entries.length === 0 && <span className="cal-rest">Sin datos</span>}
                        {day.entries.map((entry) => (
                          <span
                            key={entry.routineId}
                            className={`cal-pill ${entry.status}`}
                            title={`${entry.name}: ${STATUS_LABEL[entry.status]}`}
                            aria-label={`${entry.name}: ${STATUS_LABEL[entry.status]}`}
                          >
                            <StatusIcon status={entry.status} />
                            <span className="cal-pill-name">{entry.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
