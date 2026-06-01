import { createClient } from '@supabase/supabase-js'

// Cliente de SERVIDOR — solo para rutas API / código de servidor.
// NUNCA importar esto en componentes con 'use client'.
// Usa service role si está disponible (producción/Vercel → privilegios completos),
// y cae a la anon key si no (build local sin el secreto). Así builda en ambos lados.
const serverKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serverKey,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

// Alias para compatibilidad con archivos que importaban { supabase }
export const supabase = supabaseAdmin
