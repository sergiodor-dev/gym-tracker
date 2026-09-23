import { Dumbbell, ListChecks, CalendarRange, CalendarDays, TrendingUp, Save, Utensils, Cloud } from 'lucide-react'

// Tema visual (icono + color) compartido por el widget/tarjetas de Inicio
// y la cabecera de cada sección, para que cada parte de la app se sienta
// tematizada según su propósito.
export const THEME = {
  train: { icon: Dumbbell, bg: '#FFEDD5', fg: '#F97316' },
  exercises: { icon: ListChecks, bg: '#DBEAFE', fg: '#3B82F6' },
  routines: { icon: CalendarRange, bg: '#EDE9FE', fg: '#7C3AED' },
  planner: { icon: CalendarDays, bg: '#DCFCE7', fg: '#16A34A' },
  progress: { icon: TrendingUp, bg: '#FCE7F3', fg: '#DB2777' },
  backup: { icon: Save, bg: '#FEF9C3', fg: '#CA8A04' },
  protein: { icon: Utensils, bg: '#FFE4E6', fg: '#E11D48' },
  account: { icon: Cloud, bg: '#E0F2FE', fg: '#0284C7' },
}