// hooks/useContratos.ts
'use client';
import { useState, useEffect, useCallback } from 'react';

export interface Contrato {
  id: string;
  empleado_id: string;
  numero_contrato: string;
  tipo_contrato: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  sueldo_base: number | null;
  cargo: string | null;
  area: string | null;
  jornada: string | null;
  archivo_url: string | null;
  observaciones: string | null;
  vigente: boolean;
  created_at: string;
  empleado?: {
    id: string;
    nombre_completo: string;
    rut: string;
    cargo: string;
    area: string;
  };
}

export function useContratos() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
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
    vigente: '',
  });

  const cargarContratos = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.per_page.toString(),
        ...(filtros.empleadoId && { empleadoId: filtros.empleadoId }),
        ...(filtros.vigente !== '' && { vigente: filtros.vigente }),
      });

      const response = await fetch(`/api/rrhh/contratos?${params}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      setContratos(result.data || []);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtros, pagination.per_page]);

  const crearContrato = async (datos: Partial<Contrato>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/rrhh/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarContratos(pagination.current_page);

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const actualizarContrato = async (id: string, datos: Partial<Contrato>) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/contratos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarContratos(pagination.current_page);

      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const eliminarContrato = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/contratos/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      await cargarContratos(pagination.current_page);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const cambiarPagina = (page: number) => {
    if (page >= 1 && page <= pagination.last_page) {
      cargarContratos(page);
    }
  };

  useEffect(() => {
    cargarContratos(1);
  }, [filtros]);

  return {
    contratos,
    loading,
    error,
    pagination,
    filtros,
    setFiltros,
    crearContrato,
    actualizarContrato,
    eliminarContrato,
    cambiarPagina,
    cargarContratos,
  };
}