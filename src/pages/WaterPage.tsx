import { useState } from 'react'
import { useAppData } from '../AppDataContext'
import { generateId } from '../utils/id'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { THEME } from '../theme'
import { Trash2, Calculator } from 'lucide-react'

const QUICK_AMOUNTS = [250, 500, 750, 1000]
const FACTOR_OPTIONS = [
  { value: 30, label: '30 ml/kg — poca actividad' },
  { value: 35, label: '35 ml/kg — actividad moderada' },
  { value: 40, label: '40 ml/kg — entrenamiento intenso' },
]

// Calculadora y registro de agua diaria. Mismo funcionamiento que ProteinPage: se guarda solo el
// consumo del día actual (se reinicia a las 6:00) y el objetivo diario. Las cantidades van en ml.
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
    <div className="page">
      <PageHeader title="Agua" icon={THEME.water.icon} color={THEME.water} />
      <p className="muted">Registra tu consumo de hoy. El contador se reinicia cada día a las 6:00.</p>

      <div className="chart-card">
        <div className="protein-summary-row">
          <div>
            <div className="protein-consumed">{consumed}<span className="protein-unit">ml</span></div>
            <div className="muted small">
              {target > 0 ? `de ${target} ml objetivo · quedan ${remaining} ml` : 'Sin objetivo definido'}
            </div>
          </div>
          <button type="button" className="button-like" onClick={() => setCalcOpen(true)}>
            <Calculator size={16} className="inline-icon" /> Calcular objetivo
          </button>
        </div>
        {target > 0 && (
          <div className="protein-bar">
            <div className="protein-bar-fill water-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
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

      <p className="muted small" style={{ marginTop: '1rem' }}>Añadir rápido</p>
      <div className="row">
        {QUICK_AMOUNTS.map((ml) => (
          <button
            key={ml}
            type="button"
            onClick={() => addMl(ml)}
            style={{ background: THEME.water.fg, borderColor: THEME.water.fg }}
          >
            +{ml}
          </button>
        ))}
        <input
          type="number"
          min={0}
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          placeholder="ml"
          style={{ width: '72px' }}
        />
        <button type="button" className="button-like" onClick={addCustom}>Añadir</button>
      </div>

      <ul className="list">
        {[...water.entries].reverse().map((entry) => (
          <li key={entry.id} className="list-item">
            <div>
              <strong>{entry.ml} ml</strong>
              <div className="muted small">
                {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            <p className="muted">Objetivo sugerido: <strong>{suggested} ml</strong> al día</p>
          )}
          <div className="modal-actions">
            <button onClick={applyCalculator}>Usar este objetivo</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
