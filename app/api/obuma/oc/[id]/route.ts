// app/api/obuma/oc/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const OBUMA_API_URL = process.env.OBUMA_API_URL;
    const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

    if (!OBUMA_API_TOKEN) {
      return NextResponse.json(
        { error: 'API token de Obuma no configurado' },
        { status: 500 }
      );
    }

    // Endpoint de Obuma para obtener detalle de OC según documentación
    const url = `${OBUMA_API_URL}/comprasOc.findById.json/${id}`;
    console.log(`📡 Obteniendo detalle de OC ${id}...`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'access-token': OBUMA_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok || data.status === false) {
      console.error('❌ Error Obuma:', data);
      return NextResponse.json(
        { error: data.message || 'Error al obtener detalle de la OC' },
        { status: response.status || 400 }
      );
    }

    // Formateamos la respuesta con los datos que nos interesan
    const detalleFormateado = {
      id: data.compra_oc_id,
      folio: data.compra_oc_folio,
      fecha_ingreso: data.compra_oc_fecha_ingreso,
      fecha_emision: data.compra_oc_fecha,
      estado: data.compra_oc_estado,
      total: data.compra_oc_total,
      proveedor: {
        id: data.proveedor_id,
        rut: data.proveedor_rut,
        razon_social: data.proveedor_razon_social,
        direccion: data.proveedor_direccion,
        telefono: data.proveedor_telefono,
        email: data.proveedor_email,
      },
      // 👇 IMPORTANTE: Lista de productos de la OC
      productos: (data.compra_detalle || []).map((item: any) => ({
        nombre: item.producto_nombre || item.producto_descripcion || 'Sin nombre',
        cantidad: item.cantidad || 0,
        precio_unitario: item.precio || 0,
        subtotal: item.subtotal || 0,
        sku: item.codigo_comercial || '',
        unidad: item.unidad_medida || 'unidad',
      })),
      observacion: data.compra_oc_observacion || '',
    };

    console.log(`✅ OC ${id}: ${detalleFormateado.productos.length} productos encontrados`);
    return NextResponse.json(detalleFormateado);

  } catch (error: any) {
    console.error('❌ Error en GET /api/obuma/oc/[id]:', error.message);
    return NextResponse.json(
      { error: 'Error al obtener detalle de la orden de compra', details: error.message },
      { status: 500 }
    );
  }
}