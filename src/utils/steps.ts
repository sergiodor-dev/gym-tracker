import type { StepEntry } from '../types'

// Velocidades de referencia para elegir de un toque (km/h). Cualquier otra se puede escribir a mano.
export const SPEED_PRESETS = [
  { label: 'Paseo', kmh: 3 },
  { label: 'Andar normal', kmh: 4.5 },
  { label: 'Andar rápido', kmh: 5.5 },
  { label: 'Marcha', kmh: 6.5 },
] as const

export const MIN_SPEED_KMH = 1
export const MAX_SPEED_KMH = 10
export const MAX_MINUTES = 600

// Zancada al andar ≈ 41,5 % de la altura (estimación habitual). Los pasos que salen son una
// aproximación: la zancada real varía con la persona y con la velocidad.
const STRIDE_FACTOR = 0.415

export function strideMeters(heightCm: number): number {
  return (heightCm * STRIDE_FACTOR) / 100
}

export function distanceKm(minutes: number, speedKmh: number): number {
  return (speedKmh * minutes) / 60
}

export function stepsFor(minutes: number, speedKmh: number, heightCm: number): number {
  const stride = strideMeters(heightCm)
  if (stride <= 0) return 0
  return Math.round((distanceKm(minutes, speedKmh) * 1000) / stride)
}

// Nombre de una velocidad: el del preset más cercano por debajo ("4,8 km/h" → "Andar normal").
export function walkLabel(speedKmh: number): string {
  let label: string = SPEED_PRESETS[0].label
  for (const p of SPEED_PRESETS) if (speedKmh >= p.kmh - 0.25) label = p.label
  return label
}

export interface StepsTotals {
  steps: number
  km: number
  minutes: number
  avgSpeedKmh: number
}

export function stepsTotals(entries: StepEntry[], heightCm: number): StepsTotals {
  let steps = 0
  let km = 0
  let minutes = 0
  for (const e of entries) {
    steps += stepsFor(e.minutes, e.speedKmh, heightCm)
    km += distanceKm(e.minutes, e.speedKmh)
    minutes += e.minutes
  }
  return { steps, km, minutes, avgSpeedKmh: minutes > 0 ? km / (minutes / 60) : 0 }
}

export function formatDuration(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, '0')} min`
}

export const formatNumber = (n: number, maxDecimals = 0): string =>
  n.toLocaleString('es-ES', { maximumFractionDigits: maxDecimals })
