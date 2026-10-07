import { Link } from 'react-router-dom'
import { ChevronRight, CheckCircle2 } from 'lucide-react'
import { useAppData } from '../AppDataContext'
import { THEME } from '../theme'
import { formatNumber, stepsTotals } from '../utils/steps'
import type { CSSProperties } from 'react'

// Widget de Inicio con los pasos de hoy: lleva a la sección de Pasos. Muestra el progreso hacia el
// objetivo diario (si lo hay) y la distancia recorrida.
export default function StepsWidget() {
  const { data } = useAppData()
  const { steps } = data
  const totals = stepsTotals(steps.entries, steps.heightCm)
  const target = steps.targetSteps
  const pct = target > 0 ? Math.min(100, Math.round((totals.steps / target) * 100)) : 0
  const reached = target > 0 && totals.steps >= target
  const Icon = THEME.steps.icon

  return (
    <Link to="/steps" className="steps-widget" style={{ '--t-fg': THEME.steps.fg } as CSSProperties}>
      <span className="steps-widget-icon">
        <Icon size={22} strokeWidth={2.2} />
      </span>
      <span className="steps-widget-text">
        <span className="steps-widget-label">Pasos hoy</span>
        <span className="steps-widget-value">
          {formatNumber(totals.steps)}
          {target > 0 && <small> / {formatNumber(target)}</small>}
        </span>
        <span className="steps-widget-sub">
          {totals.km > 0 ? `${formatNumber(totals.km, 2)} km` : 'Aún sin caminatas'}
        </span>
        {target > 0 && (
          <span
            className="steps-widget-bar"
            role="progressbar"
            aria-label="Pasos de hoy"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span className="steps-widget-bar-fill" style={{ width: `${pct}%` }} />
          </span>
        )}
      </span>
      {reached && <CheckCircle2 size={22} className="steps-widget-check" />}
      <ChevronRight size={22} className="steps-widget-chevron" />
    </Link>
  )
}
