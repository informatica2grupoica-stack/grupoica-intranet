// app/api/obuma/oc/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const BASE = process.env.OBUMA_API_URL!;
    const TOKEN = process.env.OBUMA_API_TOKEN || '';
    const headers = { 'access-token': TOKEN, 'Content-Type': 'application/json' };

    // 1. Obtener cabecera de la OC
    const resOC = await fetch(`${BASE}/comprasOc.findById.json/${id}`, { headers, cache: 'no-store' });
    const dataOC = await resOC.json();

    if (!resOC.ok || dataOC.status === false || dataOC.success === false) {
      return NextResponse.json({ error: dataOC.message || 'Error al obtener OC' }, { status: 400 });
    }

    // La respuesta puede ser: objeto directo, data[0], docs[0], o array
    let oc: any = dataOC;
    if (Array.isArray(dataOC)) oc = dataOC[0];
    else if (Array.isArray(dataOC?.data)) oc = dataOC.data[0];
    else if (Array.isArray(dataOC?.docs)) oc = dataOC.docs[0];
    else if (dataOC?.data && typeof dataOC.data === 'object') oc = dataOC.data;

    // 2. Intentar obtener items desde todos los posibles campos del detalle
    const camposDetalle = [
      'compra_detalle', 'oc_detalle', 'detalle', 'items', 'productos',
      'compra_oc_detalle', 'lineas', 'lineas_detalle',
    ];
    let itemsRaw: any[] = [];
    for (const campo of camposDetalle) {
      if (Array.isArray(oc?.[campo]) && oc[campo].length > 0) {
        itemsRaw = oc[campo];
        break;
      }
    }

    // 3. Si no hay items en la respuesta del findById, usar listItems como fallback
    const folio = oc?.compra_oc_folio;
    if (itemsRaw.length === 0 && folio) {
      try {
        const resItems = await fetch(`${BASE}/comprasOc.listItems.json?folio_dcto=${folio}`, {
          headers, cache: 'no-store',
        });
        const dataItems = await resItems.json();
        const lista = dataItems?.data || dataItems?.docs || (Array.isArray(dataItems) ? dataItems : []);
        if (Array.isArray(lista) && lista.length > 0) {
          itemsRaw = lista;
        }
      } catch { /* fallback silencioso */ }
    }

    // 4. Normalizar los items (intentamos múltiples nombres de campo)
    const productos = itemsRaw.map((item: any) => ({
      producto_id: item.producto_id || item.compra_oc_item_producto_id || '',
      sku: item.codigo_comercial || item.producto_sku || item.compra_oc_item_codigo_comercial || '',
      nombre: item.producto_nombre || item.compra_oc_item_producto_nombre
        || item.producto_descripcion || item.nombre || 'Sin nombre',
      descripcion: item.producto_descripcion || item.compra_oc_item_producto_descripcion || '',
      cantidad: Number(item.cantidad || item.compra_oc_item_cantidad || 0),
      precio_unitario: Number(item.precio || item.compra_oc_item_precio || item.producto_precio || 0),
      descuento: Number(item.descuento || item.compra_oc_item_descuento || 0),
      subtotal: Number(item.subtotal || item.compra_oc_item_subtotal || 0),
      unidad: item.unidad_medida || item.compra_oc_item_unidad_medida || 'unidad',
      exento: item.producto_exento === '1' || item.compra_oc_item_producto_exento === '1',
    }));

    const resultado = {
      id: oc?.compra_oc_id,
      folio: oc?.compra_oc_folio,
      fecha_ingreso: oc?.compra_oc_fecha_ingreso,
      fecha_emision: oc?.compra_oc_fecha_ingreso,
      fecha_entrega: oc?.compra_oc_fecha_entrega_productos,
      fecha_arribo: oc?.compra_oc_fecha_arribo_productos,
      estado: oc?.compra_oc_estado,
      estado_facturacion: oc?.compra_oc_estado_facturacion,
      pagada: oc?.compra_oc_pagada === '1',
      enviada: oc?.compra_oc_enviada === '1',
      confirmada: oc?.compra_oc_confirmada === '1',
      subtotal: Number(oc?.compra_oc_subtotal || 0),
      neto: Number(oc?.compra_oc_neto || 0),
      iva: Number(oc?.compra_oc_iva || 0),
      total: Number(oc?.compra_oc_total || 0),
      descuento_pesos: Number(oc?.compra_oc_descuento_pesos || 0),
      descuento_porciento: Number(oc?.compra_oc_descuento_porciento || 0),
      forma_pago: oc?.compra_oc_forma_pago,
      metodo_despacho: oc?.compra_oc_metodo_despacho,
      direccion_despacho: oc?.compra_oc_direccion_despacho,
      direccion_envio_factura: oc?.compra_oc_direccion_envio_factura,
      concepto: oc?.compra_oc_concepto,
      centro_costo: oc?.compra_oc_centro_costo,
      observacion: oc?.compra_oc_observacion,
      condiciones: oc?.compra_oc_condiciones,
      referencia: oc?.compra_oc_referencia,
      contacto: oc?.compra_oc_contacto,
      cantidad_items: Number(oc?.compra_oc_cantidad_items || 0),
      cantidad_adjuntos: Number(oc?.compra_oc_cantidad_adjuntos || 0),
      aprobacion_fecha: oc?.compra_oc_aprobacion_fecha,
      aprobacion_usuario: oc?.compra_oc_aprobacion_usuario,
      proveedor: {
        id: oc?.rel_proveedor_id || oc?.proveedor_id || '',
        rut: oc?.proveedor_rut || '',
        razon_social: oc?.proveedor_razon_social || '',
        giro: oc?.proveedor_giro || '',
        direccion: oc?.proveedor_direccion || '',
        email: oc?.proveedor_email || '',
        telefono: oc?.proveedor_telefono || '',
        contacto: oc?.proveedor_contacto || '',
      },
      productos,
      _items_raw_keys: itemsRaw.length > 0 ? Object.keys(itemsRaw[0]) : [],
      _raw_keys: oc ? Object.keys(oc) : [],
    };

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error('Error en GET /api/obuma/oc/[id]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
