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
