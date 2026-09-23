# Gym Tracker

App de seguimiento de entrenamientos de gimnasio: ejercicios, rutinas, planificación
semanal y registro de series/reps/peso por sesión, con exportación/importación en JSON.

## Stack

- React + TypeScript + Vite
- Persistencia **Fase 1**: `localStorage` del navegador (ver `src/services/`)
- Pensado para migrar/complementar en **Fase 2** con Supabase sin tocar la UI:
  solo hay que crear `src/services/supabaseService.ts` implementando la interfaz
  `StorageService` y cambiar la instancia exportada en `src/services/index.ts`.

## Empezar en local

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Desplegar en GitHub Pages

1. Sube este proyecto a un repositorio de GitHub (por ejemplo `gym-tracker`).
2. Edita `vite.config.ts` y pon en `base` el nombre exacto de tu repo:
   `base: '/tu-repo/'`.
3. En GitHub → Settings → Pages, selecciona "Source: GitHub Actions".
4. Haz push a `main`: el workflow en `.github/workflows/deploy.yml` compilará
   y publicará automáticamente en `https://tu-usuario.github.io/tu-repo/`.

La app usa `HashRouter`, así que funciona directamente en GitHub Pages sin
configuración de rutas adicional.

## Estructura

```
src/
  types.ts                 # Entidades: Exercise, Routine, WeeklyPlan, WorkoutSession...
  AppDataContext.tsx        # Estado global: carga/guarda automáticamente vía storageService
  services/
    storageService.ts       # Interfaz de persistencia (abstracción)
    localStorageService.ts  # Implementación Fase 1
    index.ts                # Instancia activa del servicio (único punto a cambiar en Fase 2)
  pages/
    WorkoutPage.tsx          # Detecta el día, inicia la rutina y registra series/reps/peso
    ExercisesPage.tsx        # CRUD de ejercicios
    RoutinesPage.tsx         # CRUD de rutinas + configuración de series/reps/peso por defecto
    PlannerPage.tsx           # Asigna rutina(s) a cada día de la semana
    ProgressPage.tsx          # Historial de entrenamientos por ejercicio
    BackupPage.tsx            # Exportar/importar JSON
```

## Próximos pasos sugeridos

- [ ] Gráfica de evolución de peso máximo por ejercicio (Progreso)
- [ ] Editar/eliminar sesiones ya registradas
- [ ] Reordenar ejercicios dentro de una rutina (drag & drop)
- [ ] Fase 2: `supabaseService.ts` + login simple para sincronizar entre dispositivos
