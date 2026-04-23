// hooks/useRrhh.ts
'use client';
import { useState, useEffect, useCallback } from 'react';

export interface Empleado {
  id: string;
  nombre_completo: string;
  rut: string;
  email_corporativo: string | null;
  telefono: string | null;
  cargo: string | null;
  area: string | null;
  estado: string;
  activo: boolean;
  fecha_ingreso: string;
  fecha_nacimiento: string | null;
  jefe_directo_id: string | null;
  jefe_directo?: { nombre_completo: string } | null;
  dias_vacacion_disponibles?: number;
  dias_vacacion_anual?: number;
  created_at: string;
  updated_at: string;
}

interface EstadisticasRRHH {
  total_empleados: number;
  empleados_activos: number;
  empleados_ausentes: number;
  empleados_baja: number;
  contrataciones_anio: number;
  antiguedad_promedio: number;
  mujeres: number;
  hombres: number;
  por_area: Array<{ area: string; cantidad: number }>;
  por_cargo: Array<{ cargo: string; cantidad: number }>;
  proximos_cumpleaños: Array<{
    id: string;
    nombre_completo: string;
    fecha_nacimiento: string | null;
    cargo: string | null;
  }>;
}

interface PaginationInfo {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export function useRrhh() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    current_page: 1,
    per_page: 20,
    total: 0,
    last_page: 1,
  });
  const [estadisticas, setEstadisticas] = useState<EstadisticasRRHH | null>(null);
  const [filtros, setFiltros] = useState({
    search: '',
    estado: '',
    area: '',
  });
  const [areasDisponibles, setAreasDisponibles] = useState<string[]>([]);

  // hooks/useRrhh.ts - Actualiza la función cargarEmpleados
const cargarEmpleados = useCallback(async (page: number = 1) => {
  setLoading(true);
  setError(null);
  
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: pagination.per_page.toString(),
      ...(filtros.search && { search: filtros.search }),
      ...(filtros.estado && { estado: filtros.estado }),
      ...(filtros.area && { area: filtros.area }),
    });
    
    const response = await fetch(`/api/rrhh/empleados?${params}`);
    const result = await response.json();
    
    if (!response.ok) throw new Error(result.error);
    
    // ✅ Mapear los datos sin el campo jefe_directo que daba error
    const empleadosConFormato = (result.data || []).map((emp: any) => ({
      ...emp,
      jefe_directo: null, // Temporal hasta que tengamos la relación
    }));
    
    setEmpleados(empleadosConFormato);
    setPagination(result.pagination);
    if (result.filters?.areas) {
      setAreasDisponibles(result.filters.areas);
    }
  } catch (err: any) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}, [filtros, pagination.per_page]);

  const cargarEstadisticas = useCallback(async () => {
    try {
      const response = await fetch('/api/rrhh/dashboard');
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error);
      
      setEstadisticas(result.stats);
    } catch (err: any) {
      console.error('Error cargando estadísticas:', err);
    }
  }, []);

  const crearEmpleado = async (datos: Partial<Empleado>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/rrhh/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error);
      
      await cargarEmpleados(pagination.current_page);
      await cargarEstadisticas();
      
      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const actualizarEmpleado = async (id: string, datos: Partial<Empleado>) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/empleados/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error);
      
      await cargarEmpleados(pagination.current_page);
      await cargarEstadisticas();
      
      return { success: true, data: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const eliminarEmpleado = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/empleados/${id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error);
      
      await cargarEmpleados(pagination.current_page);
      await cargarEstadisticas();
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const cambiarPagina = (page: number) => {
    if (page >= 1 && page <= pagination.last_page) {
      cargarEmpleados(page);
    }
  };

  useEffect(() => {
    cargarEmpleados(1);
    cargarEstadisticas();
  }, []);

  useEffect(() => {
    cargarEmpleados(1);
  }, [filtros.search, filtros.estado, filtros.area]);

  return {
    empleados,
    loading,
    error,
    pagination,
    estadisticas,
    filtros,
    setFiltros,
    areasDisponibles,
    cargarEmpleados,
    cargarEstadisticas,
    crearEmpleado,
    actualizarEmpleado,
    eliminarEmpleado,
    cambiarPagina,
  };
}