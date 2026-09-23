// Configuración de Supabase (Fase 2).
//
// Deja ambos valores vacíos para usar la app solo con localStorage (Fase 1):
// no aparece ninguna sincronización y todo funciona igual que antes.
//
export const SUPABASE_URL: string = 'https://otmsdvgsjhchlxmqlkbn.supabase.co/'
export const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90bXNkdmdzamhjaGx4bXFsa2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxODU5NDMsImV4cCI6MjEwNTc2MTk0M30.BXUYpx4-zYUSBoxFRpQ9brGlr5wnhYEUyqBji8V55ew'

// Supabase Auth solo admite email o teléfono como identificador, así que el nombre de usuario
// se convierte internamente en "<usuario>@<este dominio>". Nunca se envía ningún correo
// (requiere desactivar "Confirm email" en Supabase, ver README), pero el validador de
// Supabase debe aceptar el dominio: si al crear una cuenta da "email inválido", cambia este valor
// por otro con aspecto de dominio real. No pongas uno que no controles si algún día activas emails.
export const USERNAME_EMAIL_DOMAIN: string = 'gym-tracker.app'

export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== ''
