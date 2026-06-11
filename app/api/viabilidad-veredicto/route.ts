// app/api/viabilidad-veredicto/route.ts
// Veredicto final de viabilidad: cruza el análisis de documentos con el costo
// real encontrado por el buscador de productos vs. el presupuesto de la licitación.
import { NextResponse } from 'next/server';
import { GEMINI_KEY, generarConGemini, parsearJSONSeguro } from '@/lib/gemini/documentos';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Convierte montos en formato chileno ("$5.000.000", "5.000.000,50") a número
function parsearMontoCLP(str: string): number {
  if (!str) return 0;
  const limpio = String(str).replace(/[^\d,.-]/g, '');
  if (!limpio) return 0;
  const normalizado = limpio.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalizado);
  return isNaN(n) ? 0 : n;
}

export async function POST(req: Request) {
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY no configurada en el servidor' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const analisis = (body.analisis && typeof body.analisis === 'object') ? body.analisis : {};
    const costoTotalConIva = Number(body.costoTotalConIva) || 0;
    const costoTotalNeto = Number(body.costoTotalNeto) || 0;
    const totalItems = Number(body.totalItems) || 0;
    const itemsConPrecio = Number(body.itemsConPrecio) || 0;

    const presupuesto = parsearMontoCLP(analisis.presupuesto_con_iva || '');
    const margenPct = presupuesto > 0 ? ((presupuesto - costoTotalConIva) / presupuesto) * 100 : null;
    const formaEval = analisis.forma_evaluacion || {};

    const prompt = `Eres un experto en licitaciones de Mercado Público (Chile). Con la siguiente información, entrega un VEREDICTO FINAL ACTUALIZADO sobre si conviene participar en esta licitación.

DATOS DEL PROCESO:
- Presupuesto disponible (con IVA): ${analisis.presupuesto_con_iva || 'no especificado'}${presupuesto > 0 ? ` (≈ $${presupuesto.toLocaleString('es-CL')})` : ''}
- Costo estimado real de los productos (con IVA, según buscador de precios): $${costoTotalConIva.toLocaleString('es-CL')}
- Costo neto estimado: $${costoTotalNeto.toLocaleString('es-CL')}
- Ítems cotizados con precio encontrado: ${itemsConPrecio} de ${totalItems}
${margenPct !== null ? `- Margen estimado (presupuesto vs costo real): ${margenPct.toFixed(1)}% ${margenPct >= 0 ? '(el costo cabe dentro del presupuesto)' : '(el costo SUPERA el presupuesto disponible)'}` : '- No se pudo calcular el margen (presupuesto no especificado en los documentos)'}
- Plazo aceptación OC: ${analisis.plazo_aceptacion_oc || '—'}
- Garantías exigidas: ${analisis.garantias || '—'}
- Multas: ${analisis.multas || '—'}
- Forma de evaluación: precio ${formaEval.criterio_economico || '—'}, técnico ${formaEval.criterio_tecnico || '—'}, programa ${formaEval.programa || '—'}, requisitos formales ${formaEval.requisitos_formales || '—'}
- Veredicto previo (basado solo en documentos, sin precios reales): proyecto_viable=${analisis.proyecto_viable || '—'} — "${analisis.justificacion_viabilidad || '—'}"

Responde SOLO con este JSON, sin texto antes ni después:
{
  "proyecto_viable": "SI o NO",
  "justificacion_viabilidad": "explicación breve y concreta del veredicto final, considerando el margen real entre presupuesto y costo, los criterios de evaluación y los riesgos (multas, garantías, plazos)",
  "observaciones": "alertas o recomendaciones adicionales para el equipo comercial (ej. ítems sin precio encontrado, riesgos de margen, plazos ajustados)"
}`;

    const txt = await generarConGemini([{ text: prompt }], 2048);
    const parsed = parsearJSONSeguro(txt);

    return NextResponse.json({
      ok: true,
      proyecto_viable: String(parsed.proyecto_viable ?? '').trim(),
      justificacion_viabilidad: String(parsed.justificacion_viabilidad ?? '').trim(),
      observaciones: String(parsed.observaciones ?? '').trim(),
      presupuesto,
      margen_pct: margenPct,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    console.error('[viabilidad-veredicto] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
