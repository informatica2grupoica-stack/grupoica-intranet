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

export function useObumaProveedores() {
  const [todosProveedores, setTodosProveedores] = useState<ObumaProveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Paginación frontend
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // 10 items por página
  const [busqueda, setBusqueda] = useState("");
  
  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    conContacto: 0,
    conEmail: 0,
    conTelefono: 0,
  });

  const cargarProveedores = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/obuma/proveedores');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
      }
      
      const result = await response.json();
      const proveedores = result.data || result.proveedores || [];
      
      setTodosProveedores(proveedores);
      
      // Calcular estadísticas
      setEstadisticas({
        total: proveedores.length,
        conContacto: proveedores.filter((p: ObumaProveedor) => p.proveedor_contacto).length,
        conEmail: proveedores.filter((p: ObumaProveedor) => p.proveedor_email).length,
        conTelefono: proveedores.filter((p: ObumaProveedor) => p.proveedor_telefono || p.proveedor_celular).length,
      });
    } catch (err: any) {
      console.error('❌ Error cargando proveedores:', err);
      setError(err.message || 'Error al cargar los proveedores');
    } finally {
      setLoading(false);
    }
  }, []);

  // Filtrar por búsqueda
  const proveedoresFiltrados = todosProveedores.filter(prov => {
    const textoBusqueda = busqueda.toLowerCase();
    if (!textoBusqueda) return true;
    return (
      prov.proveedor_razon_social?.toLowerCase().includes(textoBusqueda) ||
      prov.proveedor_rut?.includes(textoBusqueda) ||
      prov.proveedor_contacto?.toLowerCase().includes(textoBusqueda) ||
      prov.proveedor_email?.toLowerCase().includes(textoBusqueda)
    );
  });

  // Paginación frontend
  const totalPages = Math.ceil(proveedoresFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const proveedoresPaginados = proveedoresFiltrados.slice(startIndex, endIndex);

  const cambiarPagina = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Scroll al top
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      
      await cargarProveedores();
      setCurrentPage(1); // Volver a la primera página
      setBusqueda(""); // Limpiar búsqueda
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
      
      await cargarProveedores();
      return { success: true, data: result.data };
    } catch (err: any) {
      console.error('Error actualizando proveedor:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProveedores();
  }, [cargarProveedores]);

  return {
    proveedores: proveedoresPaginados,
    todosProveedores,
    loading,
    error,
    estadisticas,
    busqueda,
    setBusqueda,
    currentPage,
    totalPages,
    itemsPerPage,
    cambiarPagina,
    cargarProveedores,
    crearProveedor,
    actualizarProveedor,
  };
}