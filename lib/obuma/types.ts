// lib/obuma/types.ts
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

export interface ObumaResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}