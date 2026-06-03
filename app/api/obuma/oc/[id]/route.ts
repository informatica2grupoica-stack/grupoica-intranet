// app/api/obuma/oc/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = `${process.env.OBUMA_API_URL}/comprasOc.findById.json/${id}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok || data.status === false || data.success === false) {
      return NextResponse.json(
        { error: data.message || 'Error al obtener detalle de OC' },
        { status: response.status || 400 }
      );
    }

    // La respuesta puede venir en data.data[0] o directamente en data
    const oc = data.data?.[0] || data.docs?.[0] || data;

    // Construir respuesta normalizada usando los campos reales de Obuma
    const resultado = {
      // Datos identificadores
      id: oc.compra_oc_id,
      folio: oc.compra_oc_folio,
      // Fechas
      fecha_ingreso: oc.compra_oc_fecha_ingreso,
      fecha_emision: oc.compra_oc_fecha_ingreso, // la lista usa este campo
      fecha_entrega: oc.compra_oc_fecha_entrega_productos,
      fecha_arribo: oc.compra_oc_fecha_arribo_productos,
      // Estado
      estado: oc.compra_oc_estado,
      estado_facturacion: oc.compra_oc_estado_facturacion,
      pagada: oc.compra_oc_pagada === '1',
      enviada: oc.compra_oc_enviada === '1',
      confirmada: oc.compra_oc_confirmada === '1',
      // Montos
      subtotal: Number(oc.compra_oc_subtotal || 0),
      neto: Number(oc.compra_oc_neto || 0),
      iva: Number(oc.compra_oc_iva || 0),
      total: Number(oc.compra_oc_total || 0),
      descuento_pesos: Number(oc.compra_oc_descuento_pesos || 0),
      descuento_porciento: Number(oc.compra_oc_descuento_porciento || 0),
      // Logística
      forma_pago: oc.compra_oc_forma_pago,
      metodo_despacho: oc.compra_oc_metodo_despacho,
      direccion_despacho: oc.compra_oc_direccion_despacho,
      direccion_envio_factura: oc.compra_oc_direccion_envio_factura,
      // Otros
      concepto: oc.compra_oc_concepto,
      centro_costo: oc.compra_oc_centro_costo,
      observacion: oc.compra_oc_observacion,
      condiciones: oc.compra_oc_condiciones,
      referencia: oc.compra_oc_referencia,
      cantidad_items: Number(oc.compra_oc_cantidad_items || 0),
      cantidad_adjuntos: Number(oc.compra_oc_cantidad_adjuntos || 0),
      aprobacion_fecha: oc.compra_oc_aprobacion_fecha,
      // Proveedor: puede venir anidado en el detail o sólo como rel_id
      proveedor: {
        id: oc.rel_proveedor_id || oc.proveedor_id,
        rut: oc.proveedor_rut || '',
        razon_social: oc.proveedor_razon_social || '',
        direccion: oc.proveedor_direccion || '',
        email: oc.proveedor_email || '',
        telefono: oc.proveedor_telefono || '',
        contacto: oc.proveedor_contacto || '',
      },
      // Items/productos del detalle
      productos: (oc.compra_detalle || oc.oc_detalle || oc.detalle || []).map((item: any) => ({
        nombre: item.producto_nombre || item.producto_descripcion || item.nombre || 'Sin nombre',
        descripcion: item.producto_descripcion || '',
        cantidad: Number(item.cantidad || 0),
        precio_unitario: Number(item.precio || item.producto_precio || 0),
        subtotal: Number(item.subtotal || 0),
        descuento: Number(item.descuento || 0),
        sku: item.codigo_comercial || item.producto_sku || '',
        unidad: item.unidad_medida || 'unidad',
        producto_id: item.producto_id || '',
        exento: item.producto_exento === '1',
      })),
      // Raw por si el front necesita más campos
      _raw: oc,
    };

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error('Error en GET /api/obuma/oc/[id]:', error.message);
    return NextResponse.json(
      { error: 'Error al obtener detalle de la orden de compra', details: error.message },
      { status: 500 }
    );
  }
}
