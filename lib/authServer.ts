// lib/authServer.ts — helper para obtener el usuario autenticado desde rutas API (App Router)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabaseAdmin';

export type Rol = 'superuser' | 'admin' | 'user' | 'rrhh' | 'jefe' | 'vendedor';

export interface PermisosPerfil {
  can_view_rrhh?: boolean;
  can_manage_rrhh?: boolean;
  can_view_billing?: boolean;
  secciones?: Record<string, boolean>;
  [k: string]: unknown;
}

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  esAdminOSuper: boolean;
  permisos: PermisosPerfil | null;
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

    // Obtener nombre, rol y permisos desde la tabla perfiles
    const { data: perfil } = await supabaseAdmin
      .from('perfiles')
      .select('nombre, rol, permisos')
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
      permisos: (perfil?.permisos as PermisosPerfil) ?? null,
    };
  } catch {
    return null;
  }
}

/** Exige sesión válida y, opcionalmente, uno de los roles indicados.
 *  admin/superuser siempre pasan. Devuelve { user } o { error } (NextResponse
 *  401/403 lista para retornar desde el route handler). */
export async function requireRol(
  rolesPermitidos?: Rol[],
): Promise<{ user: AuthUser; error?: never } | { user?: never; error: NextResponse }> {
  const user = await getAuthUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'No autorizado. Inicia sesión.' }, { status: 401 }) };
  }
  if (rolesPermitidos && !user.esAdminOSuper && !rolesPermitidos.includes(user.rol as Rol)) {
    return { error: NextResponse.json({ error: 'Permiso denegado para tu rol.' }, { status: 403 }) };
  }
  return { user };
}
