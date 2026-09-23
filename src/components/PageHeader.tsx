import { Link } from 'react-router-dom'
import { ArrowLeft, LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  title: string
  icon: LucideIcon
  color: { bg: string; fg: string }
  showBack?: boolean
  onBack?: () => void
}

export default function PageHeader({ title, icon: Icon, color, showBack = true, onBack }: PageHeaderProps) {
  return (
    <div className="page-header">
      {showBack && (
        onBack ? (
          <button className="back-link" onClick={onBack} aria-label="Volver">
            <ArrowLeft size={20} />
          </button>
        ) : (
          <Link to="/" className="back-link" aria-label="Volver al menú">
            <ArrowLeft size={20} />
          </Link>
        )
      )}
      <span className="page-header-icon" style={{ background: color.bg, color: color.fg }}>
        <Icon size={24} strokeWidth={2.2} />
      </span>
      <h1>{title}</h1>
    </div>
  )
}
