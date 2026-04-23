// hooks/useCapacitaciones.ts
'use client';
import { useState, useEffect, useCallback } from 'react';

export interface Capacitacion {
  id: string;
  nombre: string;
  proveedor: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  horas_total: number | null;
  modalidad: 'presencial' | 'online' | 'mixto' | null;
  costo: number | null;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
}

export interface AsignacionCapacitacion {
  id: string;
  empleado_id: string;
  capacitacion_id: string;
  fecha_realizacion: string | null;
  puntaje: number | null;
  certificado_url: string | null;
  notas: string | null;
  completado: boolean;
  created_at: string;
  empleado?: {
    id: string;
    nombre_completo: string;
    rut: string;
    cargo: string;
  };
  capacitacion?: {
    id: string;
    nombre: string;
    proveedor: string;
    horas_total: number;
    modalidad: string;
  };
}

export function useCapacitaciones() {
  const [capacitaciones, setCapacitaciones] = useState<Capacitacion[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionCapacitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 20,
    total: 0,
    last_page: 1,
  });

  // Cargar capacitaciones
  const cargarCapacitaciones = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/capacitaciones?page=${page}&limit=${pagination.per_page}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      setCapacitaciones(result.data || []);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.per_page]);

  // Cargar asignaciones
  const cargarAsignaciones = useCallback(async (empleadoId?: string) => {
    try {
      const url = empleadoId 
        ? `/api/rrhh/empleados-capacitaciones?empleadoId=${empleadoId}`
        : '/api/rrhh/empleados-capacitaciones';
      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      setAsignaciones(result.data || []);
    } catch (err: any) {
      console.error('Error cargando asignaciones:', err);
    }
  }, []);

  // Crear capacitación
  const crearCapacitacion = async (datos: Partial<Capacitacion>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/rrhh/capacitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarCapacitaciones(pagination.current_page);

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Actualizar capacitación
  const actualizarCapacitacion = async (id: string, datos: Partial<Capacitacion>) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/capacitaciones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarCapacitaciones(pagination.current_page);

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Eliminar capacitación
  const eliminarCapacitacion = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/capacitaciones/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarCapacitaciones(pagination.current_page);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Asignar capacitación a empleado
  const asignarCapacitacion = async (empleadoId: string, capacitacionId: string, fechaRealizacion?: string) => {
    try {
      const response = await fetch('/api/rrhh/empleados-capacitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: empleadoId,
          capacitacion_id: capacitacionId,
          fecha_realizacion: fechaRealizacion,
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarAsignaciones();

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Completar capacitación
  const completarCapacitacion = async (id: string, datos: { fecha_realizacion: string; puntaje?: number; certificado_url?: string; notas?: string }) => {
    try {
      const response = await fetch(`/api/rrhh/empleados-capacitaciones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, completado: true }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarAsignaciones();

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const cambiarPagina = (page: number) => {
    if (page >= 1 && page <= pagination.last_page) {
      cargarCapacitaciones(page);
    }
  };

  useEffect(() => {
    cargarCapacitaciones(1);
    cargarAsignaciones();
  }, []);

  return {
    capacitaciones,
    asignaciones,
    loading,
    error,
    pagination,
    cargarCapacitaciones,
    cargarAsignaciones,
    crearCapacitacion,
    actualizarCapacitacion,
    eliminarCapacitacion,
    asignarCapacitacion,
    completarCapacitacion,
    cambiarPagina,
  };
}