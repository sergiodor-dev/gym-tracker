# Gym Tracker

App de seguimiento de entrenamientos de gimnasio: ejercicios, rutinas, planificación
semanal y registro de series/reps/peso por sesión, con exportación/importación en JSON.

## Stack

- React + TypeScript + Vite, desplegado en GitHub Pages (`HashRouter`)
- **Fase 1**: `localStorage` del navegador
- **Fase 2**: sincronización opcional con Supabase (PostgreSQL + API REST + Auth), hablando
  con la API por `fetch` directo, sin `supabase-js`

## Empezar en local

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Fase 2: activar la sincronización con Supabase

Si `src/config.ts` tiene los valores vacíos, la app funciona solo con `localStorage`.

1. Crea un proyecto en https://supabase.com (plan gratuito).
2. **SQL Editor** → New query → pega `supabase/schema.sql` → Run. Crea las tablas y las
   políticas RLS (cada usuario solo ve sus filas).
3. **Project Settings → API**: copia la *Project URL* y la *anon / publishable key* en
   `src/config.ts`. Es seguro commitearlas: la seguridad la da RLS, no el secreto de la clave.
   Nunca uses la `service_role` / `secret` key.
4. **Authentication → Sign In / Providers → Email**: **desactiva "Confirm email"** (obligatorio,
   ver "Usuario en vez de email").
5. Despliega como siempre. Al abrir la web aparece la **página de bienvenida**: crea tu cuenta
   (o inicia sesión) y pasas a Inicio.

### Acceso y rutas

- Con Supabase configurado, **toda la app exige sesión**: sin ella, cualquier URL
  (`#/progress`, `#/train`…) redirige a `#/welcome`. Con sesión, `#/welcome` redirige a Inicio.
- Cerrar sesión (Inicio → Cuenta) te devuelve a la bienvenida.
- La sesión persiste en el navegador, así que al volver entras directo a Inicio, también sin conexión.
- Si `src/config.ts` está vacío, no hay login: la app funciona solo en local como en la Fase 1.
- Guardianes de ruta: `src/components/RouteGuards.tsx`.

### Usuario en vez de email

La app pide **nombre de usuario y contraseña**. Supabase Auth solo identifica por email o
teléfono, así que internamente el usuario `ana` es la cuenta `ana@gym-tracker.app`
(dominio configurable en `USERNAME_EMAIL_DOMAIN`, `src/config.ts`). Consecuencias:

- No se envía ningún email, por eso "Confirm email" debe estar desactivado: la dirección es
  ficticia y una cuenta sin confirmar nunca podría entrar.
- **No hay recuperación de contraseña.** Si se olvida, la cuenta se pierde (conviene exportar
  backups en JSON de vez en cuando).
- Usuario: 3–30 caracteres, letras minúsculas/números/`-`/`_` (no distingue mayúsculas).
- Si al crear una cuenta Supabase responde "email inválido", su validador no acepta el dominio:
  prueba con otro en `USERNAME_EMAIL_DOMAIN`.
- Contraseña: mínimo 6 caracteres (valor por defecto de Supabase).

### Cómo funciona

```
UI → AppDataContext → SyncedStorageService ─┬─ LocalStorageService  (siempre: caché / modo sin cuenta)
                                            └─ SupabaseService      (con sesión: nube)
                                                  └─ supabase/rest.ts, supabase/auth.ts (fetch)
```

- La interfaz `StorageService` (`load` / `save`) no cambió; las páginas no saben nada de la nube.
- `SupabaseService` recuerda lo último sincronizado y en cada guardado solo envía las filas
  nuevas/modificadas (upsert) y borra las eliminadas. Conflictos: el último en escribir gana.
- **Primer login**: si la cuenta está vacía, se suben los datos que ya tenías en el dispositivo.
  Si la cuenta ya tiene datos y el dispositivo también, gana la nube y los datos locales se
  guardan antes en `localStorage['gym-tracker-data-before-sync']`.
- **Sin conexión**: los cambios se guardan en el dispositivo y se suben al reconectar
  (tienen prioridad sobre la nube).
- **Cerrar sesión** borra los datos del dispositivo (siguen en la nube).

### Limitaciones conocidas

- Con dos dispositivos abiertos a la vez, los cambios del otro aparecen al recargar
  (botón *Sincronizar ahora* o al volver a la app tras un fallo de conexión), no en tiempo real.
- Supabase devuelve como máximo 1000 filas por petición; con la retención de 8 semanas no se alcanza.
- El proyecto gratuito de Supabase se pausa tras una semana sin actividad.

### Posibles mejoras a implementar

- No se puede eliminar la cuenta. Al eliminar cuenta: borrado en cascada de todos los datos relacionados en bbdd.
