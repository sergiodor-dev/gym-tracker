import React from 'react'
import { AlertTriangle, type LucideIcon } from 'lucide-react'
import Modal from './Modal'

interface ConfirmModalProps {
  title: string
  /** Texto de la confirmación. Puede ser uno o varios <p> (para el aviso extra de "esto no se
   *  puede deshacer", cambios sin sincronizar, etc.). */
  message: React.ReactNode
  confirmLabel: string
  /** Texto del botón de confirmar mientras la acción está en curso (p.ej. "Eliminando…"). */
  confirmingLabel?: string
  cancelLabel?: string
  /** Icono de la cabecera; por defecto un triángulo de aviso. */
  icon?: LucideIcon
  error?: string | null
  /** true mientras la acción confirmada está en curso: deshabilita ambos botones. */
  confirming?: boolean
  onConfirm: () => void
  onClose: () => void
}

// Modal para confirmar una acción importante y potencialmente destructiva: borrar datos o
// cerrar sesión. Usa el mismo Modal base que el resto de la app, pero con tone="confirm"
// para que se distinga a simple vista de los modales de edición o selección normales.
export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmingLabel,
  cancelLabel = 'Cancelar',
  icon = AlertTriangle,
  error,
  confirming = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onClose} tone="confirm" icon={icon}>
      {message}
      {error && <p className="form-error small">{error}</p>}
      <div className="modal-actions">
        <button className="button-like" onClick={onClose} disabled={confirming}>
          {cancelLabel}
        </button>
        <button className="danger-solid" onClick={onConfirm} disabled={confirming}>
          {confirming ? confirmingLabel ?? 'Procesando…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
