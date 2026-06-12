import { createClient } from '@supabase/supabase-js'

// Cliente de SERVIDOR — solo para rutas API / código de servidor.
// NUNCA importar esto en componentes con 'use client'.
// En producción la service role es OBLIGATORIA: degradar a la anon key haría
// que el backend opere con permisos reducidos de forma silenciosa e impredecible.
// En desarrollo/build local sí se permite el fallback para poder buildear sin el secreto.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NODE_ENV === 'production' && !process.env.NEXT_PHASE?.includes('build')) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY es obligatoria en producción')
}

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
