// app/api/proyectos/route.ts — CRUD de proyectos en Supabase
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sanitizarBusqueda } from '@/lib/sanitize';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET — listar proyectos con filtros
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const estado    = searchParams.get('estado');
    const tipo      = searchParams.get('tipo');
    const cliente   = searchParams.get('cliente');
    const busqueda  = searchParams.get('q');
    const activo    = searchParams.get('activo') !== 'false';

    let q = supabase
      .from('proyectos')
      .select(`
        id, obuma_id, nombre, descripcion, estado, tipo,
        cliente_nombre, cliente_rut, cliente_id,
        responsable_nombre, responsable_id,
        fecha_inicio, fecha_fin, fecha_fin_real,
        monto_contrato, monto_ejecutado, avance_pct,
        ubicacion, notas, etiquetas, activo,
        synced_at, created_at, updated_at
      `)
      .eq('activo', activo)
      .order('created_at', { ascending: false });

    if (estado)   q = q.eq('estado', estado);
    if (tipo)     q = q.eq('tipo', tipo);
    if (cliente)  q = q.ilike('cliente_nombre', `%${sanitizarBusqueda(cliente)}%`);
    const sb = sanitizarBusqueda(busqueda);
    if (sb) q = q.or(`nombre.ilike.%${sb}%,descripcion.ilike.%${sb}%,cliente_nombre.ilike.%${sb}%`);

    const { data, error, count } = await q;
    if (error) throw error;

    // Stats agregados
    const stats = {
      total:      data?.length || 0,
      activos:    data?.filter(p => p.estado === 'activo').length    || 0,
      pausados:   data?.filter(p => p.estado === 'pausado').length   || 0,
      completados:data?.filter(p => p.estado === 'completado').length|| 0,
      cancelados: data?.filter(p => p.estado === 'cancelado').length || 0,
      monto_total: data?.reduce((s, p) => s + Number(p.monto_contrato || 0), 0) || 0,
      monto_ejecutado: data?.reduce((s, p) => s + Number(p.monto_ejecutado || 0), 0) || 0,
    };

    return NextResponse.json({ data: data || [], stats, total: count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — crear proyecto
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await supabase
      .from('proyectos')
      .insert({
        nombre:              body.nombre,
        descripcion:         body.descripcion || null,
        estado:              body.estado || 'activo',
        tipo:                body.tipo || null,
        cliente_nombre:      body.cliente_nombre || null,
        cliente_rut:         body.cliente_rut || null,
        cliente_id:          body.cliente_id || null,
        responsable_id:      body.responsable_id || null,
        responsable_nombre:  body.responsable_nombre || null,
        fecha_inicio:        body.fecha_inicio || null,
        fecha_fin:           body.fecha_fin || null,
        monto_contrato:      body.monto_contrato || 0,
        monto_ejecutado:     body.monto_ejecutado || 0,
        avance_pct:          body.avance_pct || 0,
        ubicacion:           body.ubicacion || null,
        notas:               body.notas || null,
        etiquetas:           body.etiquetas || [],
        activo:              true,
      })
      .select().single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
