import { MUSCLE_GROUPS, MuscleGroup } from '../types'

interface Props {
  value: MuscleGroup | ''
  onChange: (value: MuscleGroup | '') => void
  emptyLabel?: string
}

export default function MuscleGroupFilter({ value, onChange, emptyLabel = 'Todos' }: Props) {
  return (
    <div className="filter-row">
      <button
        type="button"
        className={`filter-chip${value === '' ? ' active' : ''}`}
        onClick={() => onChange('')}
      >
        {emptyLabel}
      </button>
      {MUSCLE_GROUPS.map((group) => (
        <button
          type="button"
          key={group}
          className={`filter-chip${value === group ? ' active' : ''}`}
          onClick={() => onChange(group)}
        >
          {group}
        </button>
      ))}
    </div>
  )
}
