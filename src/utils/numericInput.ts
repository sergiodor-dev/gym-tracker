// Campos numéricos editados como texto (ver components/NumericInput.tsx). Con `type="number"` y
// `Number(e.target.value)` un campo vacío pasaba a 0 y no se podía borrar el valor para escribir
// otro (quedaban ceros a la izquierda, "08"). Por eso el estado del formulario guarda el texto y
// solo se convierte a número al guardar.

export const INTEGER_PATTERN = /^\d{0,3}$/ // hasta 3 cifras, sin decimales
export const DECIMAL_PATTERN = /^\d{0,4}([.,]\d{0,3})?$/ // hasta 4 cifras y 3 decimales, con punto o coma

export function parseDecimal(value: string): number {
  return Number(value.replace(',', '.'))
}

// Entero con al menos `min` (por defecto 1). El texto vacío no es válido.
export function isValidInteger(value: string, min = 1): boolean {
  return value !== '' && Number(value) >= min
}

// Número decimal completo. El texto vacío y "." o "," sueltos no son válidos; el 0 sí.
export function isValidDecimal(value: string): boolean {
  return value !== '' && Number.isFinite(parseDecimal(value))
}
