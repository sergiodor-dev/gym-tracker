import { Link } from 'react-router-dom'
import { ChevronRight, CheckCircle2 } from 'lucide-react'
import { useAppData } from '../AppDataContext'
import { useAuth } from '../AuthContext'
import { todayWeekday } from '../utils/date'
import { isRoutineCompletedToday } from '../utils/sessions'
import { THEME } from '../theme'

const sections = [
  { to: '/exercises', theme: THEME.exercises, title: 'Ejercicios', subtitle: 'Tu catálogo de ejercicios' },
  { to: '/routines', theme: THEME.routines, title: 'Rutinas', subtitle: 'Crea y edita rutinas' },
  { to: '/planner', theme: THEME.planner, title: 'Planificación', subtitle: 'Tu línea de tiempo semanal' },
  { to: '/progress', theme: THEME.progress, title: 'Progreso', subtitle: 'Consulta tu evolución' },
  { to: '/protein', theme: THEME.protein, title: 'Proteína', subtitle: 'Calculadora y registro diario' },
  { to: '/account', theme: THEME.account, title: 'Cuenta', subtitle: 'Sincroniza entre dispositivos' },
  /*{ to: '/backup', theme: THEME.backup, title: 'Backup', subtitle: 'Exporta o importa datos' },*/
]

export default function HomePage() {
  const { username } = useAuth()
  const { data } = useAppData()
  const weekday = todayWeekday()
  const routinesToday = (data.weeklyPlan[weekday] ?? [])
    .map((id) => data.routines.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
  const allCompletedToday = routinesToday.length > 0 && routinesToday.every((r) =>
    isRoutineCompletedToday(r, data.sessions)
  )

  return (
    <div className="page home">
      <div className="welcome">
        <p className="eyebrow">¡Hola, {username}! 👋</p>
        <h1>Vamos a entrenar</h1>
      </div>

      <Link to="/train" className="train-widget">
        <span className="train-widget-icon">
          <THEME.train.icon size={24} strokeWidth={2.2} />
        </span>
        <span className="train-widget-text">
          <span className="train-widget-label">Entrenar hoy</span>
          <span className="train-widget-value">
            {routinesToday.length > 0 ? routinesToday.map((r) => r.name).join(' · ') : 'Día de descanso'}
          </span>
        </span>
        {allCompletedToday && <CheckCircle2 size={22} className="train-widget-check" />}
        <ChevronRight size={22} className="train-widget-chevron" />
      </Link>

      <div className="card-grid">
        {sections.map((s) => (
          <Link key={s.to} to={s.to} className="section-card">
            <span className="section-icon" style={{ background: s.theme.bg, color: s.theme.fg }}>
              <s.theme.icon size={22} strokeWidth={2.2} />
            </span>
            <span className="section-title">{s.title}</span>
            <span className="section-subtitle">{s.subtitle}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}