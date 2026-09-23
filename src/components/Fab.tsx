import { Plus } from 'lucide-react'

export default function Fab({ onClick, color }: { onClick: () => void; color?: string }) {
  return (
    <button
      className="fab"
      onClick={onClick}
      aria-label="Añadir"
      style={color ? { background: color, borderColor: color } : undefined}
    >
      <Plus size={26} strokeWidth={2.4} />
    </button>
  )
}
