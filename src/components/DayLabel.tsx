import { WEEKDAY_SHORT } from '../utils/date'

export default function DayLabel({ date }: { date: Date }) {
  return (
    <span className="day-label">
      <span className="day-pill-name">{WEEKDAY_SHORT[date.getDay()]}</span>
      <span className="day-pill-num">{date.getDate()}</span>
    </span>
  )
}
