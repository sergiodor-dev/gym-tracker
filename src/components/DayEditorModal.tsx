import { useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Minus } from 'lucide-react'
import { useAppData } from '../AppDataContext'
import { isSameDay, MONTH_SHORT, WEEKDAY_NAMES } from '../utils/date'
import { routineProgress } from '../utils/sessions'
import type { CalendarStatus } from '../utils/calendar'
import type { Routine } from '../types'
import Modal from './Modal'
import RoutineLogger from './RoutineLogger'

const STATUS_LABEL: Record<CalendarStatus, string> = {
  done: 'Completada',
  partial: 'Incompleta',
}

function StatusIcon({ status }: { status: CalendarStatus }) {
  return status === 'done' ? <CheckCircle2 size={15} aria-hidden="true" /> : <Minus size={15} aria-hidden="true" />
}

interface Props {
  day: Date
  onClose: () => void
}

// Editor de un día de una semana anterior, que se abre al pulsar ese día en el calendario de
// Planificación. Primero muestra las rutinas con sesión registrada ese día (sin compararlas con el plan
// semanal) y deja elegir una para editarla o, si no había ninguna, añadir los datos. Todo ocurre dentro
// de este único modal (la lista de rutinas, la lista de ejercicios y el formulario de series se
// sustituyen entre sí), porque apilar más modales encima no funciona bien en móvil.
export default function DayEditorModal({ day, onClose }: Props) {
  const { data } = useAppData()
  const [routineId, setRoutineId] = useState<string | null>(null)

  const title = `${WEEKDAY_NAMES[day.getDay()]} ${day.getDate()} ${MONTH_SHORT[day.getMonth()]}`
  const selected = data.routines.find((r) => r.id === routineId) ?? null

  // Rutinas con sesión ese día (las mismas que muestra el calendario) y el resto, para registrar otra.
  const withSession = new Set(data.sessions.filter((s) => isSameDay(s.date, day)).map((s) => s.routineId))
  const shown = data.routines.filter((r) => withSession.has(r.id))
  const others = data.routines.filter((r) => !withSession.has(r.id))
  const hasAnySession = shown.length > 0

  function statusOf(r: Routine): CalendarStatus {
    const session = data.sessions.find((s) => s.routineId === r.id && isSameDay(s.date, day))
    return session && routineProgress(r, session.exerciseLogs).completed ? 'done' : 'partial'
  }

  function loggedCount(r: Routine): number {
    const session = data.sessions.find((s) => s.routineId === r.id && isSameDay(s.date, day))
    return session ? routineProgress(r, session.exerciseLogs).done : 0
  }

  return (
    <Modal title={selected ? selected.name : title} icon={CalendarDays} onClose={onClose}>
      {selected ? (
        <>
          <button type="button" className="inline-back" onClick={() => setRoutineId(null)}>
            <ChevronLeft size={16} /> {title}
          </button>
          <RoutineLogger routine={selected} day={day} presentation="inline" />
        </>
      ) : (
        <>
          <p className="muted small day-editor-summary">
            {hasAnySession
              ? 'Estas son las sesiones de este día. Pulsa una rutina para editarla.'
              : 'No hay ninguna sesión registrada este día. Elige una rutina para añadir los datos.'}
          </p>

          {data.routines.length === 0 && <p className="empty">Crea alguna rutina primero.</p>}

          {shown.length > 0 && (
            <ul className="list">
              {shown.map((r) => {
                const status = statusOf(r)
                return (
                  <li key={r.id} className="list-item selectable" onClick={() => setRoutineId(r.id)}>
                    <div>
                      <strong>{r.name}</strong>
                      <div className="muted small">
                        {loggedCount(r)}/{r.exercises.length} series registradas
                      </div>
                    </div>
                    <span className={`cal-pill ${status}`}>
                      <StatusIcon status={status} />
                      <span className="cal-pill-name">{STATUS_LABEL[status]}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          {others.length > 0 && (
            <details open={shown.length === 0}>
              <summary>{shown.length === 0 ? 'Elegir rutina' : 'Registrar otra rutina'}</summary>
              <ul className="list">
                {others.map((r) => (
                  <li key={r.id} className="list-item selectable" onClick={() => setRoutineId(r.id)}>
                    <strong>{r.name}</strong>
                    <ChevronRight size={18} className="chevron" />
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
