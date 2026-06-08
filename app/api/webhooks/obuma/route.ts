// app/api/webhooks/obuma/route.ts
// Receptor de webhooks de Obuma ERP â€” sincroniza eventos a Supabase en tiempo real
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Obuma puede configurar un secreto en la URL o header para validar la fuente
const WEBHOOK_SECRET = process.env.OBUMA_WEBHOOK_SECRET || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sb(fn: () => PromiseLike<any> | any) { try { await fn(); } catch {} }

async function logEvento(evento: string, payload: any, resultado: string) {
  await sb(() => supabase.from('webhook_logs').insert({ fuente: 'obuma', evento, payload, resultado, created_at: new Date().toISOString() }));
}

// â”€â”€â”€ Handlers por evento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function handleProductoCreated(payload: any) {
  // Obuma envÃ­a: producto_id, nombre, sku, precio, stock, categoria
  await supabase.from('productos_obuma').upsert({
    obuma_id: String(payload.producto_id),
    nombre: payload.nombre || payload.producto_nombre,
    sku: payload.sku || payload.producto_sku,
    precio_total: payload.precio_venta || payload.precio_total,
    precio_neto: payload.precio_neto,
    stock_actual: payload.stock ?? 0,
    activo: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'obuma_id', ignoreDuplicates: false });
}

async function handleProductoUpdated(payload: any) {
  await handleProductoCreated(payload); // misma lÃ³gica, upsert
}

async function handleStockCreated(payload: any) {
  // productoStock.created â€” movimiento de stock
  const sku = payload.sku || payload.producto_sku;
  if (!sku) return;
  // Actualizar stock en la tabla de productos
  const { data } = await supabase
    .from('productos_obuma')
    .select('id, stock_actual')
    .eq('sku', sku)
    .single();

  if (data) {
    const nuevoStock = payload.stock_nuevo ?? payload.stock_actual ?? data.stock_actual;
    await supabase.from('productos_obuma')
      .update({ stock_actual: nuevoStock, updated_at: new Date().toISOString() })
      .eq('sku', sku);
  }

  // Registrar el movimiento en historial de stock
  await sb(() => supabase.from('stock_movimientos').insert({
    sku, tipo_movimiento: payload.tipo_movimiento || 'AJUSTE', cantidad: payload.cantidad || 0,
    stock_resultante: payload.stock_nuevo, origen: 'webhook_obuma', referencia: payload.referencia || null, created_at: new Date().toISOString(),
  }));
}

async function handleClienteCreated(payload: any) {
  await sb(() => supabase.from('clientes_obuma').upsert({
    obuma_id: String(payload.cliente_id), razon_social: payload.cliente_razon_social,
    rut: payload.cliente_rut, email: payload.cliente_email || '', estado: true, updated_at: new Date().toISOString(),
  }, { onConflict: 'obuma_id', ignoreDuplicates: false }));
}

async function handleClienteUpdated(payload: any) {
  await handleClienteCreated(payload);
}

async function handleVentaCreated(payload: any) {
  await sb(() => supabase.from('ventas_obuma_log').insert({
    venta_id: payload.venta_id, tipo_documento: payload.venta_tipo_dcto,
    numero_documento: payload.venta_nro_dcto, estado: payload.venta_estado || 'CREADA',
    payload_raw: payload, created_at: new Date().toISOString(),
  }));
}

async function handleCotizacionCreated(payload: any) {
  await sb(() => supabase.from('cotizaciones_log').insert({
    cotizacion_id: payload.cotizacion_id, cliente_id: payload.cliente_id,
    estado: payload.estado || 'NUEVA', payload_raw: payload, created_at: new Date().toISOString(),
  }));
}

async function handleTareaCreated(payload: any) {
  await sb(() => supabase.from('tareas').upsert({
    obuma_id: String(payload.tarea_id), titulo: payload.tarea_titulo || payload.titulo,
    estado: payload.tarea_estado || 'pendiente', prioridad: payload.prioridad || 'media',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'obuma_id', ignoreDuplicates: false }));
}

// â”€â”€â”€ Router de eventos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const HANDLERS: Record<string, (payload: any) => Promise<void>> = {
  'producto.created':      handleProductoCreated,
  'producto.updated':      handleProductoUpdated,
  'productoStock.created': handleStockCreated,
  'cliente.created':       handleClienteCreated,
  'cliente.updated':       handleClienteUpdated,
  'cliente.updatedVendedor': handleClienteUpdated,
  'venta.created':         handleVentaCreated,
  'venta.updated':         handleVentaCreated,
  'venta_4.created':       handleVentaCreated,
  'cotizacion.created':    handleCotizacionCreated,
  'tarea.created':         handleTareaCreated,
  'tarea.updated':         handleTareaCreated,
};

// â”€â”€â”€ Handler principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function POST(req: NextRequest) {
  try {
    // Validar secreto si estÃ¡ configurado
    if (WEBHOOK_SECRET) {
      const secret = req.headers.get('x-obuma-secret') || req.nextUrl.searchParams.get('secret');
      if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();
    // Obuma puede enviar el evento en distintos campos
    const evento: string = body.event || body.evento || body.type || 'unknown';
    const payload = body.data || body.payload || body;

    console.log(`[webhook/obuma] evento recibido: ${evento}`, payload);

    const handler = HANDLERS[evento];
    if (handler) {
      await handler(payload);
      await logEvento(evento, payload, 'procesado');
      return NextResponse.json({ ok: true, evento, procesado: true });
    }

    // Evento no manejado â€” lo registramos igual para trazabilidad
    await logEvento(evento, payload, 'sin_handler');
    return NextResponse.json({ ok: true, evento, procesado: false, nota: 'evento no tiene handler' });

  } catch (err: any) {
    console.error('[webhook/obuma] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET para verificar que el endpoint estÃ¡ activo (Obuma puede hacer un ping)
export async function GET() {
  return NextResponse.json({
    status: 'activo',
    url: '/api/webhooks/obuma',
    eventos_soportados: Object.keys(HANDLERS),
    instrucciones: 'Configura esta URL en Obuma ERP â†’ ConfiguraciÃ³n â†’ Webhooks',
  });
}

