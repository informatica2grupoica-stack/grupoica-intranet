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
  const [proveedores, setProveedores] = useState<ObumaProveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      console.log('📢 Cargando proveedores desde API...');
      const response = await fetch('/api/obuma/proveedores');
      
      console.log('📢 Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📢 Datos recibidos:', data);
      
      // La API de Obuma devuelve un objeto con una propiedad 'data'
      let listaProveedores: ObumaProveedor[] = [];
      if (Array.isArray(data)) {
        listaProveedores = data;
      } else if (data.data && Array.isArray(data.data)) {
        listaProveedores = data.data;
      } else if (data.proveedores && Array.isArray(data.proveedores)) {
        listaProveedores = data.proveedores;
      } else {
        listaProveedores = [];
      }
      
      setProveedores(listaProveedores);
      
      setEstadisticas({
        total: listaProveedores.length,
        conContacto: listaProveedores.filter((p: ObumaProveedor) => p.proveedor_contacto).length,
        conEmail: listaProveedores.filter((p: ObumaProveedor) => p.proveedor_email).length,
        conTelefono: listaProveedores.filter((p: ObumaProveedor) => p.proveedor_telefono || p.proveedor_celular).length,
      });
    } catch (err: any) {
      console.error('❌ Error cargando proveedores Obuma:', err);
      setError(err.message || 'Error al cargar los proveedores');
    } finally {
      setLoading(false);
    }
  }, []);

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
    proveedores,
    loading,
    error,
    estadisticas,
    cargarProveedores,
    crearProveedor,
    actualizarProveedor,
  };
}