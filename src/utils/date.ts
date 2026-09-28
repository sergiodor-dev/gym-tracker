export const WEEKDAY_NAMES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
]

export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function todayWeekday(): number {
  return new Date().getDay() // 0 = domingo ... 6 = sábado
}

export function isToday(iso: string): boolean {
  const d = new Date(iso)
  const t = new Date()
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

// Hora local a la que se reinicia el contador de proteína diaria.
export const PROTEIN_RESET_HOUR = 6

// Calcula la clave del "día de proteína" (YYYY-MM-DD) para una fecha dada.
// No coincide con el día de calendario: antes de las PROTEIN_RESET_HOUR
// (p. ej. 02:00) todavía cuenta como parte del día anterior, para que una
// cena tardía no "reinicie" el contador a mitad de la noche.
export function proteinDayKey(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() - PROTEIN_RESET_HOUR * 60 * 60 * 1000)
  const y = shifted.getFullYear()
  const m = String(shifted.getMonth() + 1).padStart(2, '0')
  const d = String(shifted.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// "hoy", "ayer", "hace 5 días", "hace 2 sem"... contando días de calendario (no horas), de modo
// que un entreno de ayer por la noche sigue siendo "ayer" por la mañana.
export function relativeDayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(d)) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 14) return `hace ${days} días`
  return `hace ${Math.floor(days / 7)} sem`
}
