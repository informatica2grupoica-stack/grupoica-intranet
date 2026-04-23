// hooks/useAsistencias.ts
'use client';
import { useState, useEffect, useCallback } from 'react';

export interface Asistencia {
  id: string;
  empleado_id: string;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  hora_entrada_tarde: string | null;
  hora_salida_tarde: string | null;
  horas_trabajadas: number | null;
  horas_extras: number | null;
  horas_extras_25: number | null;
  horas_extras_50: number | null;
  tipo_dia: string;
  estado: string;
  justificacion: string | null;
  empleado?: {
    id: string;
    nombre_completo: string;
    rut: string;
    cargo: string;
  };
}

interface ResumenAsistencia {
  total_dias: number;
  dias_presente: number;
  dias_ausente: number;
  dias_tarde: number;
  dias_justificado: number;
  porcentaje_asistencia: number;
  total_horas: number;
  total_horas_extras: number;
  total_horas_extras_25: number;
  total_horas_extras_50: number;
}

export function useAsistencias() {
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenAsistencia | null>(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 50,
    total: 0,
    last_page: 1,
  });
  const [filtros, setFiltros] = useState({
    empleadoId: '',
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear(),
  });

  const cargarAsistencias = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.per_page.toString(),
        ...(filtros.empleadoId && { empleadoId: filtros.empleadoId }),
        mes: filtros.mes.toString(),
        anio: filtros.anio.toString(),
      });

      const response = await fetch(`/api/rrhh/asistencias?${params}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      setAsistencias(result.data || []);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtros, pagination.per_page]);

  const cargarResumen = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        ...(filtros.empleadoId && { empleadoId: filtros.empleadoId }),
        mes: filtros.mes.toString(),
        anio: filtros.anio.toString(),
      });

      const response = await fetch(`/api/rrhh/asistencias/reporte?${params}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      setResumen(result.resumen);
    } catch (err: any) {
      console.error('Error cargando resumen:', err);
    }
  }, [filtros]);

  const registrarAsistencia = async (datos: Partial<Asistencia>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/rrhh/asistencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarAsistencias(pagination.current_page);
      await cargarResumen();

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const actualizarAsistencia = async (id: string, datos: Partial<Asistencia>) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/asistencias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarAsistencias(pagination.current_page);
      await cargarResumen();

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const eliminarAsistencia = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/asistencias/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarAsistencias(pagination.current_page);
      await cargarResumen();

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const cambiarPagina = (page: number) => {
    if (page >= 1 && page <= pagination.last_page) {
      cargarAsistencias(page);
    }
  };

  useEffect(() => {
    cargarAsistencias(1);
    cargarResumen();
  }, [filtros]);

  return {
    asistencias,
    loading,
    error,
    resumen,
    pagination,
    filtros,
    setFiltros,
    registrarAsistencia,
    actualizarAsistencia,
    eliminarAsistencia,
    cambiarPagina,
    cargarAsistencias,
    cargarResumen,
  };
}