import React, { useRef } from 'react'
import { useAppData } from '../AppDataContext'
import { AppData } from '../types'
import PageHeader from '../components/PageHeader'
import { THEME } from '../theme'

export default function BackupPage() {
  const { data, setData } = useAppData()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gym-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as AppData
        setData(() => parsed)
        alert('Datos importados correctamente.')
      } catch {
        alert('El archivo no es un JSON válido.')
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="page">
      <PageHeader title="Backup" icon={THEME.backup.icon} color={THEME.backup} />
      <p className="muted">Exporta o importa todos tus datos (ejercicios, rutinas, plan semanal e historial).</p>
      <div className="row">
        <button onClick={exportData}>Exportar JSON</button>
        <label className="button-like">
          Importar JSON
          <input ref={fileInputRef} type="file" accept="application/json" onChange={importData} hidden />
        </label>
      </div>
      <p className="muted">⚠️ Importar reemplaza todos los datos actuales.</p>
    </div>
  )
}
