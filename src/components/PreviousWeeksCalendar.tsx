import { useMemo } from 'react'
import { CheckCircle2, CloudDownload, Loader2, Minus, X } from 'lucide-react'
import { useAppData } from '../AppDataContext'
import { buildPreviousWeeks, type CalendarStatus } from '../utils/calendar'
import { formatDayMonth, formatWeekdayDate, addDays } from '../utils/date'
import type { WorkoutSession } from '../types'
import type { PreviousWeeksStatus } from '../hooks/usePreviousWeeks'

const STATUS_LABEL: Record<CalendarStatus, string> = {
  done: 'Completada',
  partial: 'Incompleta',
  missed: 'No realizada',
}

// Semanas que dibuja el esqueleto (no tienen por qué coincidir con las reales).
const SKELETON_WEEKS = 3

function StatusIcon({ status }: { status: CalendarStatus }) {
  if (status === 'done') return <CheckCircle2 size={14} aria-hidden="true" />
  if (status === 'partial') return <Minus size={14} aria-hidden="true" />
  return <X size={14} aria-hidden="true" />
}

// Misma estructura que el calendario real (.cal-week-grid / .cal-day), para que al cargar no
// "salte" el diseño tanto en móvil (filas) como en PC (columnas).
function CalendarSkeleton() {
  return (
    <div className="prev-weeks" aria-hidden="true">
      {Array.from({ length: SKELETON_WEEKS }, (_, w) => (
        <section key={w}>
          <span className="sk sk-title" />
          <div className="cal-week-grid">
            {Array.from({ length: 7 }, (_, d) => (
              <div key={d} className="cal-day">
                <span className="sk sk-head" />
                <div className="cal-day-body">
                  {(w + d) % 3 === 2 ? <span className="sk sk-rest" /> : <span className="sk sk-pill" />}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

interface Props {
  status: PreviousWeeksStatus
  sessions: WorkoutSession[]
  fromDevice: boolean
  onLoad: (force?: boolean) => void
}

// Calendario de solo lectura con lo entrenado en las semanas anteriores (dentro de la ventana de
// retención). Las sesiones se piden a la nube bajo demanda (ver usePreviousWeeks): hasta entonces
// se ve un esqueleto con un botón para cargarlas; mientras llegan, el esqueleto con un indicador.
// Se usa tanto inline (PC) como dentro de un modal (móvil), ver PlannerPage.
export default function PreviousWeeksCalendar({ status, sessions, fromDevice, onLoad }: Props) {
  const { data } = useAppData()
  const weeks = useMemo(
    () => (status === 'ready' ? buildPreviousWeeks({ routines: data.routines, weeklyPlan: data.weeklyPlan, sessions }) : []),
    [status, data.routines, data.weeklyPlan, sessions],
  )

  if (status !== 'ready') {
    return (
      <div className="prev-weeks-stage" aria-busy={status === 'loading'}>
        <CalendarSkeleton />
        <div className="prev-weeks-overlay">
          {status === 'loading' ? (
            <span className="prev-weeks-loading" role="status">
              <Loader2 size={18} className="spin" aria-hidden="true" /> Cargando semanas anteriores…
            </span>
          ) : (
            <button type="button" className="prev-weeks-load" onClick={() => onLoad()}>
              <CloudDownload size={16} className="inline-icon" aria-hidden="true" /> Cargar información de semanas anteriores
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {fromDevice && (
        <div className="prev-weeks-banner" role="status">
          <span>No se pudo consultar la nube: se muestran los datos de este dispositivo.</span>
          <button type="button" onClick={() => onLoad(true)}>
            Reintentar
          </button>
        </div>
      )}
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

          {weeks.map((week) => (
            <section key={week.monday.getTime()}>
              <h3 className="cal-week-title">
                Semana del {formatDayMonth(week.monday)} al {formatDayMonth(addDays(week.monday, 6))}
              </h3>
              <div className="cal-week-grid">
                {week.days.map((day) => (
                  <div key={day.date.getTime()} className={`cal-day${day.noData ? ' nodata' : ''}`}>
                    <span className="cal-day-head">{formatWeekdayDate(day.date)}</span>
                    <div className="cal-day-body">
                      {day.noData && <span className="cal-rest">Sin datos</span>}
                      {!day.noData && day.entries.length === 0 && <span className="cal-rest">Descanso</span>}
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
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
