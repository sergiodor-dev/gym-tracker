import React, { useEffect, useId, useRef } from 'react'
import { X, type LucideIcon } from 'lucide-react'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  /** 'confirm' da al modal el estilo de aviso usado para confirmar acciones importantes
   *  (borrado de datos, cierre de sesión), distinto del resto de modales (editar, elegir...). */
  tone?: 'default' | 'confirm'
  /** Icono junto al título. En tone="confirm" se usa además para teñir la cabecera. */
  icon?: LucideIcon
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ title, onClose, children, tone = 'default', icon: Icon }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<Element | null>(null)
  const titleId = useId()

  // Al abrir: si nada dentro del modal ya tiene el foco (p.ej. un input con autoFocus),
  // lo lleva al propio diálogo para que el teclado y los lectores de pantalla no se queden
  // "fuera". Al cerrar: devuelve el foco a quien abrió el modal.
  useEffect(() => {
    previouslyFocused.current = document.activeElement
    const node = dialogRef.current
    if (node && !node.contains(document.activeElement)) {
      node.focus()
    }
    return () => {
      const target = previouslyFocused.current
      if (target instanceof HTMLElement && document.body.contains(target)) {
        target.focus()
      }
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const node = dialogRef.current
      if (!node) return
      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      // Atrapa el foco dentro del modal: al llegar a un extremo, salta al otro
      // en vez de escapar hacia el contenido de detrás.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal${tone === 'confirm' ? ' modal-confirm' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="modal-header">
          {Icon && (
            <span className="modal-icon-badge" aria-hidden="true">
              <Icon size={18} strokeWidth={2.4} />
            </span>
          )}
          <h2 id={titleId}>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
