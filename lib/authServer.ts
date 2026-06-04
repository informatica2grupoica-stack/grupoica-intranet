// lib/authServer.ts — helper para obtener el usuario autenticado desde rutas API (App Router)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseAdmin';

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  esAdminOSuper: boolean;
}

// Lee la sesión desde las cookies de la petición HTTP.
// Devuelve null si no hay sesión válida.
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { /* read-only en route handlers */ },
        },
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return null;

    // Obtener nombre y rol desde la tabla perfiles
    const { data: perfil } = await supabaseAdmin
      .from('perfiles')
      .select('nombre, rol')
      .eq('user_id', user.id)
      .single();

    const rol = perfil?.rol ?? 'user';
    const nombre = perfil?.nombre ?? user.email?.split('@')[0] ?? '';

    return {
      id: user.id,
      email: user.email ?? '',
      nombre,
      rol,
      esAdminOSuper: rol === 'admin' || rol === 'superuser',
    };
  } catch {
    return null;
  }
}
