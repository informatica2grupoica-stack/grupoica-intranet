// hooks/useAuth.ts
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { puedeVerSeccion, getSectionKeyForPath } from '@/lib/sections';

export interface PerfilUsuario {
  id: string;
  user_id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: 'admin' | 'superuser' | 'user' | 'rrhh' | 'jefe' | 'vendedor';
  cargo: string | null;
  activo: boolean;
  permisos: {
    can_create_tasks: boolean;
    can_assign_tasks: boolean;
    can_view_billing: boolean;
    can_manage_devices: boolean;
    can_create_products: boolean;
    can_search_products_only: boolean;
    can_view_rrhh: boolean;
    can_manage_rrhh: boolean;
    can_approve_permits: boolean;
    secciones?: Record<string, boolean>;
  };
}

export function useAuth() {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session?.user) {
        const { data: perfilData } = await supabase
          .from('perfiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        setPerfil(perfilData as PerfilUsuario);
      }
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        supabase
          .from('perfiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
          .then(({ data }) => setPerfil(data as PerfilUsuario));
      } else {
        setPerfil(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const esAdminOSuper = (): boolean =>
    perfil?.rol === 'admin' || perfil?.rol === 'superuser';

  const tienePermiso = (permiso: keyof Omit<PerfilUsuario['permisos'], 'secciones'>): boolean => {
    if (!perfil) return false;
    if (esAdminOSuper()) return true;
    return (perfil.permisos as any)?.[permiso] || false;
  };

  const tieneAccesoSeccion = (keyOrPath: string): boolean => {
    if (!perfil) return false;
    if (esAdminOSuper()) return true;
    // Acepta tanto path ("/tareas") como key ("tareas")
    const key = keyOrPath.startsWith("/")
      ? (getSectionKeyForPath(keyOrPath) ?? keyOrPath)
      : keyOrPath;
    return puedeVerSeccion(perfil.permisos?.secciones, key);
  };

  const puedeAprobarPermisos = (): boolean => {
    if (!perfil) return false;
    return esAdminOSuper() || perfil.rol === 'rrhh' || perfil.rol === 'jefe';
  };

  const puedeVerRRHH = (): boolean => {
    if (!perfil) return false;
    return esAdminOSuper() || perfil.rol === 'rrhh' || tienePermiso('can_view_rrhh');
  };

  const puedeGestionarRRHH = (): boolean => {
    if (!perfil) return false;
    return esAdminOSuper() || perfil.rol === 'rrhh' || tienePermiso('can_manage_rrhh');
  };

  return {
    perfil,
    session,
    loading,
    tienePermiso,
    tieneAccesoSeccion,
    puedeAprobarPermisos,
    puedeVerRRHH,
    puedeGestionarRRHH,
  };
}
