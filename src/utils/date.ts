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