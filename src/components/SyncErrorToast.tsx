import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { storageService } from '../services'
import { useSyncInfo } from '../services/syncStatus'

const AUTO_DISMISS_MS = 8_000

// Aviso no bloqueante (no es un Modal: no tapa la pantalla ni interrumpe lo que se esté
// haciendo) que aparece en cualquier página cuando una escritura a la nube falla de verdad
// y el cambio queda pendiente. No se muestra por estar simplemente sin conexión: eso ya lo
// dice el indicador del BottomNav, es un estado esperado y el servicio reintenta solo.
export default function SyncErrorToast() {
  const sync = useSyncInfo()
  const [visible, setVisible] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const prevState = useRef(sync.state)
  const dismissTimer = useRef<number>()

  useEffect(() => {
    if (sync.state === 'error' && prevState.current !== 'error') {
      setVisible(true)
      window.clearTimeout(dismissTimer.current)
      dismissTimer.current = window.setTimeout(() => setVisible(false), AUTO_DISMISS_MS)
    } else if (sync.state === 'synced') {
      setVisible(false) // se resolvió (a mano o por el reintento automático)
    }
    prevState.current = sync.state
  }, [sync.state])

  useEffect(() => () => window.clearTimeout(dismissTimer.current), [])

  if (!visible) return null

  async function handleRetry() {
    setRetrying(true)
    await storageService.flush()
    setRetrying(false)
  }

  return (
    <div className="toast toast-error" role="status">
      <AlertTriangle size={18} className="toast-icon" aria-hidden="true" />
      <div className="toast-text">
        <strong>No se pudo sincronizar</strong>
        <span className="muted small">
          {sync.message ?? 'Tus cambios se han guardado en este dispositivo y se reintentará más tarde.'}
        </span>
      </div>
      <button type="button" className="danger" onClick={() => void handleRetry()} disabled={retrying}>
        {retrying ? 'Reintentando…' : 'Reintentar'}
      </button>
      <button type="button" className="toast-close" onClick={() => setVisible(false)} aria-label="Cerrar aviso">
        <X size={16} />
      </button>
    </div>
  )
}
