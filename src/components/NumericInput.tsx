import { useEffect, useRef } from 'react'
import { DECIMAL_PATTERN, INTEGER_PATTERN } from '../utils/numericInput'

interface NumericInputProps {
  value: string
  onChange: (value: string) => void
  kind: 'integer' | 'decimal'
  /** Si es false el campo se marca en rojo (aria-invalid); quien lo usa decide qué es válido. */
  valid: boolean
  /** Etiqueta accesible (el campo no tiene <label> visible dentro de las tablas). */
  label: string
}

// Campo de texto con teclado numérico para reps, series y pesos. Ignora al teclear los caracteres
// no válidos (letras, signos, demasiados decimales...) en vez de aceptarlos y avisar después.
export default function NumericInput({ value, onChange, kind, valid, label }: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pattern = kind === 'integer' ? INTEGER_PATTERN : DECIMAL_PATTERN

  // Al enfocar se selecciona todo el contenido para sobrescribirlo directamente. Si una tecla no
  // válida llegara hasta onChange, React restauraría el valor anterior y la selección se perdería
  // (lo siguiente que se escribiera se añadiría al final en vez de reemplazar). Por eso se
  // cancela antes, en `beforeinput`, donde el texto aún no se ha tocado. onChange sigue
  // filtrando como respaldo (pegar texto, autocompletado...).
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    function onBeforeInput(e: InputEvent) {
      if (!el || e.inputType !== 'insertText' || e.data === null || !e.cancelable) return
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? start
      if (!pattern.test(el.value.slice(0, start) + e.data + el.value.slice(end))) e.preventDefault()
    }
    el.addEventListener('beforeinput', onBeforeInput)
    return () => el.removeEventListener('beforeinput', onBeforeInput)
  }, [pattern])

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={kind === 'integer' ? 'numeric' : 'decimal'}
      autoComplete="off"
      className="numeric-input"
      value={value}
      aria-label={label}
      aria-invalid={!valid}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        if (pattern.test(e.target.value)) onChange(e.target.value)
      }}
    />
  )
}
