// hooks/useEvaluaciones.ts
'use client';
import { useState, useEffect, useCallback } from 'react';

export interface Evaluacion {
  id: string;
  empleado_id: string;
  evaluador_id: string;
  fecha_evaluacion: string;
  periodo: string;
  puntaje_calidad_trabajo: number | null;
  puntaje_productividad: number | null;
  puntaje_trabajo_equipo: number | null;
  puntaje_comunicacion: number | null;
  puntaje_iniciativa: number | null;
  puntaje_cumplimiento: number | null;
  puntaje_total: number | null;
  calificacion: string;
  fortalezas: string | null;
  areas_mejora: string | null;
  plan_accion: string | null;
  proxima_evaluacion: string | null;
  created_at: string;
  empleado?: {
    id: string;
    nombre_completo: string;
    rut: string;
    cargo: string;
    area: string;
  };
  evaluador?: {
    id: string;
    nombre: string;
    apellido: string;
  };
}

export function useEvaluaciones() {
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
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
    evaluadorId: '',
    periodo: '',
  });

  const cargarEvaluaciones = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.per_page.toString(),
        ...(filtros.empleadoId && { empleadoId: filtros.empleadoId }),
        ...(filtros.evaluadorId && { evaluadorId: filtros.evaluadorId }),
        ...(filtros.periodo && { periodo: filtros.periodo }),
      });

      const response = await fetch(`/api/rrhh/evaluaciones?${params}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      setEvaluaciones(result.data || []);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtros, pagination.per_page]);

  const crearEvaluacion = async (datos: Partial<Evaluacion>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/rrhh/evaluaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarEvaluaciones(pagination.current_page);

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const actualizarEvaluacion = async (id: string, datos: Partial<Evaluacion>) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/evaluaciones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarEvaluaciones(pagination.current_page);

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const eliminarEvaluacion = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/evaluaciones/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarEvaluaciones(pagination.current_page);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const cambiarPagina = (page: number) => {
    if (page >= 1 && page <= pagination.last_page) {
      cargarEvaluaciones(page);
    }
  };

  useEffect(() => {
    cargarEvaluaciones(1);
  }, [filtros]);

  return {
    evaluaciones,
    loading,
    error,
    pagination,
    filtros,
    setFiltros,
    crearEvaluacion,
    actualizarEvaluacion,
    eliminarEvaluacion,
    cambiarPagina,
  };
}