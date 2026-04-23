// hooks/usePermisos.ts
'use client';
import { useState, useEffect, useCallback } from 'react';

export interface Permiso {
  id: string;
  empleado_id: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias_solicitados: number;
  motivo: string | null;
  documento_url: string | null;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado';
  aprobado_por: string | null;
  fecha_aprobacion: string | null;
  comentarios_aprobador: string | null;
  created_at: string;
  empleado?: {
    id: string;
    nombre_completo: string;
    rut: string;
    cargo: string;
    area: string;
    dias_vacacion_disponibles?: number;
  };
  aprobador?: {
    id: string;
    nombre: string;
    apellido: string;
  };
}

export function usePermisos() {
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 20,
    total: 0,
    last_page: 1,
  });
  const [filtros, setFiltros] = useState({
    empleadoId: '',
    estado: '',
    tipo: '',
  });

  const cargarPermisos = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.per_page.toString(),
        ...(filtros.empleadoId && { empleadoId: filtros.empleadoId }),
        ...(filtros.estado && { estado: filtros.estado }),
        ...(filtros.tipo && { tipo: filtros.tipo }),
      });

      const response = await fetch(`/api/rrhh/permisos?${params}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      setPermisos(result.data || []);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtros, pagination.per_page]);

  const crearPermiso = async (datos: Partial<Permiso>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/rrhh/permisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarPermisos(pagination.current_page);

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const aprobarPermiso = async (id: string, aprobadoPor: string, comentarios?: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/permisos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'aprobado',
          aprobado_por: aprobadoPor,
          comentarios_aprobador: comentarios,
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarPermisos(pagination.current_page);

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const rechazarPermiso = async (id: string, aprobadoPor: string, comentarios?: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/permisos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'rechazado',
          aprobado_por: aprobadoPor,
          comentarios_aprobador: comentarios,
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarPermisos(pagination.current_page);

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const eliminarPermiso = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/permisos/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarPermisos(pagination.current_page);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const cambiarPagina = (page: number) => {
    if (page >= 1 && page <= pagination.last_page) {
      cargarPermisos(page);
    }
  };

  useEffect(() => {
    cargarPermisos(1);
  }, [filtros]);

 return {
    permisos,
    loading,
    error,
    pagination,
    filtros,
    setFiltros,
    crearPermiso,
    aprobarPermiso,
    rechazarPermiso,
    eliminarPermiso,
    cambiarPagina,  // ← Asegurar que está incluido
    cargarPermisos,
  };
}