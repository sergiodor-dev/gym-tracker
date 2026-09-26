import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Se lee directamente del package.json (y no con `import ... from './package.json'`)
// para no meter el archivo dentro del rootDir de TypeScript (tsconfig solo incluye "src").
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'))

// IMPORTANT: cambia "base" por el nombre de tu repositorio de GitHub
// Ej: si tu repo es "gym-tracker", base debe ser "/gym-tracker/"
export default defineConfig({
  plugins: [react()],
  base: '/gym-tracker/',
  define: {
    // Version de package.json, incrustada como constante en tiempo de build.
    // El workflow de deploy la incrementa automáticamente en cada push a main.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
