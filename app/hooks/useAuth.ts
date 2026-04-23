// hooks/useAuth.ts
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface PerfilUsuario {
  id: string;
  user_id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: 'admin' | 'superuser' | 'user' | 'rrhh' | 'jefe';
  cargo: string | null;
  activo: boolean;
  permisos: {
    can_create_tasks: boolean;
    can_assign_tasks: boolean;
    can_view_billing: boolean;
    can_manage_devices: boolean;
    can_create_products: boolean;
    can_view_rrhh: boolean;
    can_manage_rrhh: boolean;
    can_approve_permits: boolean;
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
        // Obtener perfil del usuario
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

    // Escuchar cambios en la autenticación
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

  const tienePermiso = (permiso: keyof PerfilUsuario['permisos']): boolean => {
    if (!perfil) return false;
    if (perfil.rol === 'admin' || perfil.rol === 'superuser') return true;
    return perfil.permisos?.[permiso] || false;
  };

  const puedeAprobarPermisos = (): boolean => {
    if (!perfil) return false;
    return perfil.rol === 'admin' || perfil.rol === 'superuser' || perfil.rol === 'rrhh' || perfil.rol === 'jefe';
  };

  const puedeVerRRHH = (): boolean => {
    if (!perfil) return false;
    return perfil.rol === 'admin' || perfil.rol === 'superuser' || perfil.rol === 'rrhh' || tienePermiso('can_view_rrhh');
  };

  const puedeGestionarRRHH = (): boolean => {
    if (!perfil) return false;
    return perfil.rol === 'admin' || perfil.rol === 'superuser' || perfil.rol === 'rrhh' || tienePermiso('can_manage_rrhh');
  };

  return {
    perfil,
    session,
    loading,
    tienePermiso,
    puedeAprobarPermisos,
    puedeVerRRHH,
    puedeGestionarRRHH,
  };
}