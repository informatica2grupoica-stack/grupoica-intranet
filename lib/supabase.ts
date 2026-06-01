import { createBrowserClient } from '@supabase/ssr'

// Cliente de NAVEGADOR (cookie-based) — para componentes 'use client'.
// La sesión se guarda en cookies para que el middleware del servidor pueda leerla.
// Código de servidor (rutas API) debe usar @/lib/supabaseAdmin en su lugar.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)