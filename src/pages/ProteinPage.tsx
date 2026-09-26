import { useState } from 'react'
import { useAppData } from '../AppDataContext'
import { generateId } from '../utils/id'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { THEME } from '../theme'
import { Trash2, Calculator } from 'lucide-react'

const QUICK_AMOUNTS = [10, 20, 30, 50]
const FACTOR_OPTIONS = [
  { value: 1.6, label: '1.6 g/kg — mantenimiento' },
  { value: 1.8, label: '1.8 g/kg — actividad moderada' },
  { value: 2.0, label: '2.0 g/kg — hipertrofia' },
  { value: 2.2, label: '2.2 g/kg — definición' },
]

export default function ProteinPage() {
  const { data, setData } = useAppData()
  const { protein } = data

  const [customAmount, setCustomAmount] = useState('')
  const [calcOpen, setCalcOpen] = useState(false)
  const [calcWeight, setCalcWeight] = useState('')
  const [calcFactor, setCalcFactor] = useState(FACTOR_OPTIONS[1].value)

  const consumed = protein.entries.reduce((sum, e) => sum + e.grams, 0)
  const target = protein.targetGrams
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0
  const remaining = Math.max(0, target - consumed)

  function addGrams(grams: number) {
    if (grams <= 0) return
    setData((prev) => ({
      ...prev,
      protein: { ...prev.protein, entries: [...prev.protein.entries, { id: generateId(), grams, time: new Date().toISOString() }] },
    }))
  }

  function addCustom() {
    const grams = Number(customAmount)
    if (!grams || grams <= 0) return
    addGrams(grams)
    setCustomAmount('')
  }

  function deleteEntry(id: string) {
    setData((prev) => ({
      ...prev,
      protein: { ...prev.protein, entries: prev.protein.entries.filter((e) => e.id !== id) },
    }))
  }

  function setTarget(grams: number) {
    setData((prev) => ({ ...prev, protein: { ...prev.protein, targetGrams: Math.max(0, grams) } }))
  }

  function applyCalculator() {
    const weight = Number(calcWeight)
    if (!weight || weight <= 0) return
    setTarget(Math.round(weight * calcFactor))
    setCalcOpen(false)
  }

  return (
    <div className="page">
      <PageHeader title="Proteína" icon={THEME.protein.icon} color={THEME.protein} />
      <p className="muted">Registra tu consumo de hoy. El contador se reinicia cada día a las 6:00.</p>

      <div className="chart-card">
        <div className="protein-summary-row">
          <div>
            <div className="protein-consumed">{consumed}<span className="protein-unit">g</span></div>
            <div className="muted small">
              {target > 0 ? `de ${target}g objetivo · quedan ${remaining}g` : 'Sin objetivo definido'}
            </div>
          </div>
          <button type="button" className="button-like" onClick={() => setCalcOpen(true)}>
            <Calculator size={16} className="inline-icon" /> Calcular objetivo
          </button>
        </div>
        {target > 0 && (
          <div className="protein-bar">
            <div className="protein-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <div className="form-field" style={{ marginTop: '1rem' }}>
        <label>Objetivo diario (g)</label>
        <input
          type="number"
          min={0}
          value={target || ''}
          placeholder="Ej. 140"
          onChange={(e) => setTarget(Number(e.target.value))}
        />
      </div>

      <p className="muted small" style={{ marginTop: '1rem' }}>Añadir rápido</p>
      <div className="row">
        {QUICK_AMOUNTS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => addGrams(g)}
            style={{ background: THEME.protein.fg, borderColor: THEME.protein.fg }}
          >
            +{g}g
          </button>
        ))}
        <input
          type="number"
          min={0}
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          placeholder="g"
          style={{ width: '64px' }}
        />
        <button type="button" className="button-like" onClick={addCustom}>Añadir</button>
      </div>

      <ul className="list">
        {[...protein.entries].reverse().map((entry) => (
          <li key={entry.id} className="list-item">
            <div>
              <strong>{entry.grams}g</strong>
              <div className="muted small">
                {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <button type="button" className="icon-btn danger-icon" onClick={() => deleteEntry(entry.id)} aria-label="Eliminar registro">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
        {protein.entries.length === 0 && <p className="empty">Aún no has registrado proteína hoy.</p>}
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
            <label>Gramos por kg de peso corporal</label>
            <select value={calcFactor} onChange={(e) => setCalcFactor(Number(e.target.value))}>
              {FACTOR_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          {Number(calcWeight) > 0 && (
            <p className="muted">Objetivo sugerido: <strong>{Math.round(Number(calcWeight) * calcFactor)}g</strong> al día</p>
          )}
          <div className="modal-actions">
            <button onClick={applyCalculator}>Usar este objetivo</button>
          </div>
        </Modal>
      )}
    </div>
  )
}