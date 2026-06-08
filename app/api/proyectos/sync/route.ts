// app/api/proyectos/sync/route.ts
// Sincroniza proyectos desde Obuma → Supabase
// Cuando Obuma active el módulo, este endpoint traerá todo automáticamente
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const OBUMA_URL   = process.env.OBUMA_API_URL || '';
const OBUMA_TOKEN = process.env.OBUMA_API_TOKEN || '';

function mapObumaToProyecto(p: any) {
  return {
    obuma_id:           String(p.proyecto_id || p.id || ''),
    nombre:             p.proyecto_nombre || p.nombre || 'Sin nombre',
    descripcion:        p.proyecto_descripcion || p.descripcion || null,
    estado:             (p.proyecto_estado || p.estado || 'activo').toLowerCase(),
    tipo:               p.proyecto_tipo || p.tipo || null,
    cliente_nombre:     p.cliente_razon_social || p.cliente_nombre || null,
    cliente_rut:        p.cliente_rut || null,
    cliente_id:         p.cliente_id ? String(p.cliente_id) : null,
    responsable_nombre: p.responsable_nombre || p.usuario_nombre || null,
    fecha_inicio:       p.proyecto_fecha_inicio || p.fecha_inicio || null,
    fecha_fin:          p.proyecto_fecha_fin || p.fecha_fin || null,
    monto_contrato:     Number(p.proyecto_monto || p.monto || 0),
    monto_ejecutado:    Number(p.proyecto_monto_ejecutado || p.monto_ejecutado || 0),
    avance_pct:         Number(p.avance_pct || p.proyecto_avance || 0),
    ubicacion:          p.ubicacion || null,
    notas:              p.notas || null,
    activo:             true,
    synced_at:          new Date().toISOString(),
    updated_at:         new Date().toISOString(),
  };
}

export async function POST() {
  const result = { obuma_ok: false, sincronizados: 0, creados: 0, actualizados: 0, error: null as string | null };

  try {
    // Intentar obtener proyectos desde Obuma
    const res = await fetch(`${OBUMA_URL}/proyectos.list.json`, {
      headers: { 'access-token': OBUMA_TOKEN },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const json = await res.json();
      const proyectos: any[] = json.data || json.docs || (Array.isArray(json) ? json : []);
      result.obuma_ok = true;

      for (const p of proyectos) {
        const mapped = mapObumaToProyecto(p);
        if (!mapped.obuma_id) continue;

        const { data: exists } = await supabase
          .from('proyectos').select('id').eq('obuma_id', mapped.obuma_id).single();

        if (exists) {
          await supabase.from('proyectos').update(mapped).eq('obuma_id', mapped.obuma_id);
          result.actualizados++;
        } else {
          await supabase.from('proyectos').insert(mapped);
          result.creados++;
        }
        result.sincronizados++;
      }
    } else {
      // Obuma aún no tiene el módulo activo — devolvemos stats de Supabase
      result.error = `Obuma devolvió ${res.status}. El módulo de Proyectos puede no estar activo en tu plan.`;
    }
  } catch (e: any) {
    result.error = e.message;
  }

  // Siempre devolver cuántos proyectos hay en Supabase
  const { count } = await supabase.from('proyectos').select('*', { count: 'exact', head: true }).eq('activo', true);
  return NextResponse.json({ ...result, total_en_bd: count || 0 });
}

export async function GET() {
  const { count } = await supabase.from('proyectos').select('*', { count: 'exact', head: true }).eq('activo', true);
  return NextResponse.json({
    total_en_bd: count || 0,
    obuma_endpoint: '/proyectos.list.json',
    estado: 'Listo para sincronizar cuando Obuma active el módulo',
  });
}
