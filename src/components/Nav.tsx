import React from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Entrenar', end: true },
  { to: '/exercises', label: 'Ejercicios' },
  { to: '/routines', label: 'Rutinas' },
  { to: '/planner', label: 'Planificación' },
  { to: '/progress', label: 'Progreso' },
  { to: '/backup', label: 'Backup' },
]

export default function Nav() {
  return (
    <nav className="nav">
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          {l.label}
        </NavLink>
      ))}
    </nav>
  )
}
