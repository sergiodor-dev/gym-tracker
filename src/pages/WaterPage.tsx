import { useState, type CSSProperties } from 'react'
import { useAppData } from '../AppDataContext'
import { generateId } from '../utils/id'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { THEME } from '../theme'
import { Trash2, Calculator, CheckCircle2, Droplet, GlassWater } from 'lucide-react'

// Recipientes habituales; el tamaño del icono crece con la cantidad.
const QUICK_AMOUNTS = [
  { ml: 250, name: 'Vaso', icon: 18 },
  { ml: 500, name: 'Botella', icon: 22 },
  { ml: 750, name: 'Botella grande', icon: 26 },
  { ml: 1000, name: 'Litro', icon: 30 },
]
// Un vaso de referencia para expresar lo que falta
const GLASS_ML = 250
const FACTOR_OPTIONS = [
  { value: 30, label: '30 ml/kg — poca actividad' },
  { value: 35, label: '35 ml/kg — actividad moderada' },
  { value: 40, label: '40 ml/kg — entrenamiento intenso' },
]

export default function WaterPage() {
  const { data, setData } = useAppData()
  const { water } = data

  const [customAmount, setCustomAmount] = useState('')
  const [calcOpen, setCalcOpen] = useState(false)
  const [calcWeight, setCalcWeight] = useState('')
  const [calcFactor, setCalcFactor] = useState(FACTOR_OPTIONS[1].value)

  const consumed = water.entries.reduce((sum, e) => sum + e.ml, 0)
  const target = water.targetMl
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0
  const remaining = Math.max(0, target - consumed)
  const reached = target > 0 && consumed >= target
  const glassesLeft = Math.ceil(remaining / GLASS_ML)
  const themeVars = { '--t-fg': THEME.water.fg } as CSSProperties

  function addMl(ml: number) {
    if (ml <= 0) return
    setData((prev) => ({
      ...prev,
      water: { ...prev.water, entries: [...prev.water.entries, { id: generateId(), ml, time: new Date().toISOString() }] },
    }))
  }

  function addCustom() {
    const ml = Number(customAmount)
    if (!ml || ml <= 0) return
    addMl(ml)
    setCustomAmount('')
  }

  function deleteEntry(id: string) {
    setData((prev) => ({
      ...prev,
      water: { ...prev.water, entries: prev.water.entries.filter((e) => e.id !== id) },
    }))
  }

  function setTarget(ml: number) {
    setData((prev) => ({ ...prev, water: { ...prev.water, targetMl: Math.max(0, ml) } }))
  }

  function applyCalculator() {
    const weight = Number(calcWeight)
    if (!weight || weight <= 0) return
    // Se redondea a múltiplos de 50 ml: un objetivo "2 625 ml" es más fácil de seguir que "2 612".
    setTarget(Math.round((weight * calcFactor) / 50) * 50)
    setCalcOpen(false)
  }

  const suggested = Math.round((Number(calcWeight) * calcFactor) / 50) * 50

  return (
    <div className="page" style={themeVars}>
      <PageHeader title="Agua" icon={THEME.water.icon} color={THEME.water} />
      <p className="muted">Registra tu consumo de hoy. El contador se reinicia cada día a las 6:00.</p>

      <div className="tracker-hero">
        <div
          className="water-tank"
          role="img"
          aria-label={target > 0 ? `${consumed} de ${target} mililitros, ${pct}%` : `${consumed} mililitros, sin objetivo`}
        >
          <div className="water-level" style={{ height: `${pct}%` }}>
            {pct > 0 && (
              <>
                <span className="water-wave a" />
                <span className="water-wave b" />
              </>
            )}
          </div>
          <div className="water-ticks" />
          {target > 0 && <span className="water-pct">{pct}%</span>}
        </div>
        <div className="tracker-info">
          <div className="tracker-value">{consumed}<small>ml</small></div>
          <div className="muted small">
            {target > 0 ? `de ${target} ml objetivo · quedan ${remaining} ml` : 'Define un objetivo diario'}
          </div>
          {target > 0 && !reached && (
            <div className="muted small">
              <Droplet size={13} className="inline-icon" /> Unos {glassesLeft} {glassesLeft === 1 ? 'vaso' : 'vasos'} de {GLASS_ML} ml
            </div>
          )}
          {reached && (
            <span className="tracker-done">
              <CheckCircle2 size={16} /> ¡Objetivo cumplido!
            </span>
          )}
          <button type="button" className="button-like tracker-calc" onClick={() => setCalcOpen(true)}>
            <Calculator size={16} className="inline-icon" /> Calcular objetivo
          </button>
        </div>
      </div>

      <div className="form-field" style={{ marginTop: '1rem' }}>
        <label>Objetivo diario (ml)</label>
        <input
          type="number"
          min={0}
          value={target || ''}
          placeholder="Ej. 2500"
          onChange={(e) => setTarget(Number(e.target.value))}
        />
      </div>

      <p className="tracker-section-title">Añadir rápido</p>
      <div className="water-quick">
        {QUICK_AMOUNTS.map((q) => (
          <button key={q.ml} type="button" onClick={() => addMl(q.ml)} aria-label={`Añadir ${q.name}, ${q.ml} mililitros`}>
            <GlassWater size={q.icon} aria-hidden="true" />
            <span className="q-name">{q.name}</span>
            <span className="q-ml">+{q.ml}</span>
          </button>
        ))}
      </div>
      <div className="protein-custom">
        <input
          type="number"
          min={0}
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          placeholder="Otra cantidad (ml)"
          style={{ width: '12rem' }}
        />
        <button type="button" className="button-like" onClick={addCustom}>Añadir</button>
      </div>

      <p className="tracker-section-title">Registros de hoy</p>
      <ul className="list">
        {[...water.entries].reverse().map((entry) => (
          <li key={entry.id} className="list-item tracker-entry">
            <div className="tracker-entry-main">
              <span className="tracker-entry-badge" aria-hidden="true"><Droplet size={15} /></span>
              <div>
                <strong>{entry.ml} ml</strong>
                <div className="muted small">
                  {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            <button type="button" className="icon-btn danger-icon" onClick={() => deleteEntry(entry.id)} aria-label="Eliminar registro">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
        {water.entries.length === 0 && <p className="empty">Aún no has registrado agua hoy.</p>}
      </ul>

      {calcOpen && (
        <Modal title="Calcular objetivo" onClose={() => setCalcOpen(false)}>
          <div className="form-field">
            <label>Tu peso (kg)</label>
            <input
              type="number"
              min={0}
              value={calcWeight}
              onChange={(e) => setCalcWeight(e.target.value)}
              placeholder="Ej. 75"
              autoFocus
            />
          </div>
          <div className="form-field">
            <label>Mililitros por kg de peso corporal</label>
            <select value={calcFactor} onChange={(e) => setCalcFactor(Number(e.target.value))}>
              {FACTOR_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          {Number(calcWeight) > 0 && (
            <p className="calc-result">
              Objetivo sugerido: <strong>{suggested} ml</strong> al día
              <span className="muted small"> (≈ {(suggested / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} L)</span>
            </p>
          )}
          <div className="modal-actions">
            <button onClick={applyCalculator}>Usar este objetivo</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
