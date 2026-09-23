import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: cambia "base" por el nombre de tu repositorio de GitHub
// Ej: si tu repo es "gym-tracker", base debe ser "/gym-tracker/"
export default defineConfig({
  plugins: [react()],
  base: '/gym-tracker/',
})
