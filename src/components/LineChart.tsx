interface ChartPoint {
  label: string // fecha corta a mostrar en el eje X
  value: number
}

interface LineChartProps {
  title: string
  unit: string
  points: ChartPoint[]
  color?: string
}

// Gráfica de líneas simple en SVG, sin dependencias externas, pensada para
// mostrar la evolución de una métrica (peso o repeticiones) a lo largo de
// las sesiones registradas de un ejercicio.
export default function LineChart({ title, unit, points, color = '#DB2777' }: LineChartProps) {
  const width = 320
  const height = 140
  const padding = { top: 14, right: 12, bottom: 24, left: 32 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const values = points.map((p) => p.value)
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const range = max - min || 1

  function xFor(i: number) {
    if (points.length <= 1) return padding.left + innerW / 2
    return padding.left + (i / (points.length - 1)) * innerW
  }
  function yFor(v: number) {
    return padding.top + innerH - ((v - min) / range) * innerH
  }

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.value)}`).join(' ')

  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      {points.length === 0 ? (
        <p className="empty">Sin datos suficientes todavía.</p>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label={title}>
          {/* líneas guía */}
          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--border)" />
          <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--border)" />

          {/* etiquetas de máximo y mínimo en el eje Y */}
          <text x={padding.left - 6} y={padding.top + 4} textAnchor="end" className="chart-axis-label">{max}{unit}</text>
          <text x={padding.left - 6} y={height - padding.bottom} textAnchor="end" className="chart-axis-label">{min}{unit}</text>

          {points.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}

          {points.map((p, i) => (
            <circle key={i} cx={xFor(i)} cy={yFor(p.value)} r={3.5} fill={color} />
          ))}

          {points.map((p, i) => {
            // Para no saturar el eje X, se muestran solo la primera, la última
            // y (si hay espacio) una etiqueta intermedia.
            const showLabel = points.length <= 5 || i === 0 || i === points.length - 1
            if (!showLabel) return null
            return (
              <text key={i} x={xFor(i)} y={height - padding.bottom + 14} textAnchor="middle" className="chart-axis-label">
                {p.label}
              </text>
            )
          })}
        </svg>
      )}
    </div>
  )
}
