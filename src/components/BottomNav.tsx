import { NavLink } from 'react-router-dom'
import { Home, CalendarRange, CalendarDays, TrendingUp } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/routines', label: 'Rutinas', icon: CalendarRange },
  { to: '/planner', label: 'Planificación', icon: CalendarDays },
  { to: '/progress', label: 'Progreso', icon: TrendingUp },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
          <Icon size={22} strokeWidth={2.2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
