import { useState, type CSSProperties } from 'react'
import { useAppData } from '../AppDataContext'
import { generateId } from '../utils/id'
import {
  MAX_MINUTES,
  MAX_SPEED_KMH,
  MIN_SPEED_KMH,
  SPEED_PRESETS,
  distanceKm,
  formatDuration,
  formatNumber,
  stepsFor,
  stepsTotals,
  walkLabel,
} from '../utils/steps'
import PageHeader from '../components/PageHeader'
import { THEME } from '../theme'
import { CheckCircle2, Flag, Footprints, Plus, Trash2 } from 'lucide-react'

// Pasos diarios. Mismo funcionamiento que proteína y agua (un único registro con el día actual, que se
// reinicia a las 6:00, y un objetivo diario), pero con su propia pieza visual: un camino con un
// caminante que avanza hasta la meta. Cada caminata se registra con tiempo y velocidad; los pasos se
// estiman con la altura (ver utils/steps.ts). El color llega con --t-fg.
export default function StepsPage() {
  const { data, setData } = useAppData()
  const { steps } = data

  const [minutes, setMinutes] = useState('')
  const [speed, setSpeed] = useState(String(SPEED_PRESETS[1].kmh))

  const totals = stepsTotals(steps.entries, steps.heightCm)
  const target = steps.targetSteps
  const pct = target > 0 ? Math.min(100, Math.round((totals.steps / target) * 100)) : 0
  const reached = target > 0 && totals.steps >= target
  const themeVars = { '--t-fg': THEME.steps.fg } as CSSProperties

  const minutesNum = Number(minutes)
  const speedNum = Number(speed.replace(',', '.'))
  const minutesValid = minutesNum > 0 && minutesNum <= MAX_MINUTES
  const speedValid = speedNum >= MIN_SPEED_KMH && speedNum <= MAX_SPEED_KMH
  const canAdd = minutesValid && speedValid

  function addWalk() {
    if (!canAdd) return
    setData((prev) => ({
      ...prev,
      steps: {
        ...prev.steps,
        entries: [
          ...prev.steps.entries,
          { id: generateId(), minutes: minutesNum, speedKmh: speedNum, time: new Date().toISOString() },
        ],
      },
    }))
    setMinutes('')
  }

  function deleteEntry(id: string) {
    setData((prev) => ({ ...prev, steps: { ...prev.steps, entries: prev.steps.entries.filter((e) => e.id !== id) } }))
  }

  function setTarget(n: number) {
    setData((prev) => ({ ...prev, steps: { ...prev.steps, targetSteps: Math.max(0, Math.round(n)) } }))
  }

  function setHeight(n: number) {
    setData((prev) => ({ ...prev, steps: { ...prev.steps, heightCm: Math.max(0, n) } }))
  }

  return (
    <div className="page" style={themeVars}>
      <PageHeader title="Pasos" icon={THEME.steps.icon} color={THEME.steps} />
      <p className="muted">Registra tus caminatas de hoy. El contador se reinicia cada día a las 6:00.</p>

      <div className="tracker-hero steps-hero">
        <div className="steps-head">
          <div className="tracker-value">{formatNumber(totals.steps)}<small>pasos</small></div>
          <div className="muted small">
            {target > 0
              ? `de ${formatNumber(target)} objetivo · quedan ${formatNumber(Math.max(0, target - totals.steps))}`
              : 'Define un objetivo diario'}
          </div>
          {reached && (
            <span className="tracker-done">
              <CheckCircle2 size={16} /> ¡Meta alcanzada!
            </span>
          )}
        </div>

        <div
          className="steps-trail"
          role="img"
          aria-label={target > 0 ? `${formatNumber(totals.steps)} de ${formatNumber(target)} pasos, ${pct}%` : `${formatNumber(totals.steps)} pasos`}
        >
          <div className="steps-rail" />
          <div className="steps-rail-done" style={{ width: `${pct}%` }} />
          <span className={`steps-flag${reached ? ' reached' : ''}`}><Flag size={20} /></span>
          <span className="steps-walker" style={{ left: `${pct}%` }}><Footprints size={18} /></span>
        </div>

        <div className="steps-stats">
          <div className="steps-stat">
            <strong>{formatNumber(totals.km, 2)}</strong>
            <span>km</span>
          </div>
          <div className="steps-stat">
            <strong>{totals.minutes > 0 ? formatDuration(totals.minutes) : '—'}</strong>
            <span>tiempo</span>
          </div>
          <div className="steps-stat">
            <strong>{totals.avgSpeedKmh > 0 ? formatNumber(totals.avgSpeedKmh, 1) : '—'}</strong>
            <span>km/h medios</span>
          </div>
        </div>
      </div>

      <div className="steps-config">
        <div className="form-field">
          <label>Objetivo diario (pasos)</label>
          <input
            type="number"
            min={0}
            value={target || ''}
            placeholder="Ej. 10000"
            onChange={(e) => setTarget(Number(e.target.value))}
          />
        </div>
        <div className="form-field">
          <label>Tu altura (cm)</label>
          <input type="number" min={0} value={steps.heightCm || ''} onChange={(e) => setHeight(Number(e.target.value))} />
        </div>
      </div>
      <p className="muted small">Los pasos se estiman con tu altura y la velocidad; son aproximados.</p>

      <p className="tracker-section-title">Añadir caminata</p>
      <div className="steps-speed" role="group" aria-label="Velocidad">
        {SPEED_PRESETS.map((p) => (
          <button
            key={p.kmh}
            type="button"
            className={`steps-speed-chip${speedNum === p.kmh ? ' active' : ''}`}
            aria-pressed={speedNum === p.kmh}
            onClick={() => setSpeed(String(p.kmh))}
          >
            <span className="chip-name">{p.label}</span>
            <span className="chip-kmh">{formatNumber(p.kmh, 1)} km/h</span>
          </button>
        ))}
      </div>
      <div className="steps-form">
        <div className="form-field">
          <label>Tiempo (min)</label>
          <input
            type="number"
            min={1}
            max={MAX_MINUTES}
            value={minutes}
            placeholder="Ej. 30"
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label>Velocidad (km/h)</label>
          <input
            type="text"
            inputMode="decimal"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
            aria-invalid={!speedValid}
          />
        </div>
      </div>
      {!speedValid && (
        <p className="form-error">La velocidad debe estar entre {MIN_SPEED_KMH} y {MAX_SPEED_KMH} km/h.</p>
      )}
      {minutes !== '' && !minutesValid && <p className="form-error">El tiempo debe estar entre 1 y {MAX_MINUTES} minutos.</p>}
      <div className="steps-add-row">
        <span className="muted small">
          {canAdd
            ? `≈ ${formatNumber(stepsFor(minutesNum, speedNum, steps.heightCm))} pasos · ${formatNumber(distanceKm(minutesNum, speedNum), 2)} km`
            : 'Indica tiempo y velocidad'}
        </span>
        <button type="button" onClick={addWalk} disabled={!canAdd}>
          <Plus size={16} className="inline-icon" /> Añadir
        </button>
      </div>

      <p className="tracker-section-title">Caminatas de hoy</p>
      <ul className="list">
        {[...steps.entries].reverse().map((entry) => (
          <li key={entry.id} className="list-item tracker-entry">
            <div className="tracker-entry-main">
              <span className="tracker-entry-badge" aria-hidden="true"><Footprints size={15} /></span>
              <div>
                <strong>{formatNumber(stepsFor(entry.minutes, entry.speedKmh, steps.heightCm))} pasos</strong>
                <div className="muted small">
                  {walkLabel(entry.speedKmh)} · {formatDuration(entry.minutes)} a {formatNumber(entry.speedKmh, 1)} km/h ·{' '}
                  {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            <button type="button" className="icon-btn danger-icon" onClick={() => deleteEntry(entry.id)} aria-label="Eliminar caminata">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
        {steps.entries.length === 0 && <p className="empty">Aún no has registrado ninguna caminata hoy.</p>}
      </ul>
    </div>
  )
}
