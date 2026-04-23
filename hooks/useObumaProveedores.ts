// hooks/useObumaProveedores.ts
'use client';
import { useState, useEffect, useCallback } from 'react';

export interface ObumaProveedor {
  proveedor_id?: string;
  proveedor_rut: string;
  proveedor_razon_social: string;
  proveedor_contacto?: string;
  proveedor_giro_comercial?: string;
  proveedor_es_supermercado?: boolean;
  proveedor_direccion?: string;
  proveedor_comuna?: string;
  proveedor_region?: string;
  proveedor_pais?: string;
  proveedor_telefono?: string;
  proveedor_celular?: string;
  proveedor_email?: string;
  proveedor_website?: string;
  proveedor_observacion?: string;
  cuenta_contable?: string;
}

interface PaginationInfo {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export function useObumaProveedores() {
  const [proveedores, setProveedores] = useState<ObumaProveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });
  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    conContacto: 0,
    conEmail: 0,
    conTelefono: 0,
  });

  const cargarProveedores = useCallback(async (page: number = 1, limit: number = 20) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/obuma/proveedores?page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
      }
      
      const result = await response.json();
      
      let listaProveedores: ObumaProveedor[] = [];
      if (Array.isArray(result.data)) {
        listaProveedores = result.data;
      } else if (Array.isArray(result.proveedores)) {
        listaProveedores = result.proveedores;
      } else if (Array.isArray(result)) {
        listaProveedores = result;
      } else {
        listaProveedores = [];
      }
      
      setProveedores(listaProveedores);
      
      // Actualizar paginación
      setPagination({
        current_page: result.pagination?.current_page || page,
        last_page: result.pagination?.last_page || 1,
        per_page: result.pagination?.per_page || limit,
        total: result.pagination?.total || listaProveedores.length,
      });
      
      // Calcular estadísticas con todos los datos (si vienen del backend)
      if (result.stats) {
        setEstadisticas(result.stats);
      } else {
        setEstadisticas({
          total: result.pagination?.total || listaProveedores.length,
          conContacto: listaProveedores.filter((p: ObumaProveedor) => p.proveedor_contacto).length,
          conEmail: listaProveedores.filter((p: ObumaProveedor) => p.proveedor_email).length,
          conTelefono: listaProveedores.filter((p: ObumaProveedor) => p.proveedor_telefono || p.proveedor_celular).length,
        });
      }
    } catch (err: any) {
      console.error('❌ Error cargando proveedores Obuma:', err);
      setError(err.message || 'Error al cargar los proveedores');
    } finally {
      setLoading(false);
    }
  }, []);

  const cambiarPagina = (page: number) => {
    if (page >= 1 && page <= pagination.last_page) {
      cargarProveedores(page, pagination.per_page);
    }
  };

  const crearProveedor = async (datos: Partial<ObumaProveedor>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/obuma/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error al crear proveedor');
      }
      
      await cargarProveedores(1, pagination.per_page);
      return { success: true, data: result.data };
    } catch (err: any) {
      console.error('Error creando proveedor:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const actualizarProveedor = async (id: string, datos: Partial<ObumaProveedor>) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/obuma/proveedores/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error al actualizar proveedor');
      }
      
      await cargarProveedores(pagination.current_page, pagination.per_page);
      return { success: true, data: result.data };
    } catch (err: any) {
      console.error('Error actualizando proveedor:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProveedores(1, 20);
  }, [cargarProveedores]);

  return {
    proveedores,
    loading,
    error,
    estadisticas,
    pagination,
    cargarProveedores,
    cambiarPagina,
    crearProveedor,
    actualizarProveedor,
  };
}