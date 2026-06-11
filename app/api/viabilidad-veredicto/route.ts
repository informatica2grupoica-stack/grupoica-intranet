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
    const itemsAltoRiesgo: Array<{ numero: string; nombre: string; motivo: string; match: number }> =
      Array.isArray(body.itemsAltoRiesgo) ? body.itemsAltoRiesgo : [];

    const presupuesto = parsearMontoCLP(analisis.presupuesto_con_iva || '');
    const margenPct = presupuesto > 0 ? ((presupuesto - costoTotalConIva) / presupuesto) * 100 : null;
    const formaEval = analisis.forma_evaluacion || {};

    const itemsSinPrecio = Math.max(totalItems - itemsConPrecio, 0);
    const coberturaPct = totalItems > 0 ? (itemsConPrecio / totalItems) * 100 : 100;

    const prompt = `Eres un analista experto en licitaciones de Mercado Público (Chile), especializado en evaluar la viabilidad financiera de participar en un proceso. Responde de forma EXACTA y CONSISTENTE, basándote SOLO en los datos entregados — no inventes cifras ni supuestos que no estén aquí.

DATOS DEL PROCESO:
- Presupuesto disponible (con IVA): ${analisis.presupuesto_con_iva || 'no especificado'}${presupuesto > 0 ? ` (≈ $${presupuesto.toLocaleString('es-CL')})` : ''}
- Costo real de los productos con IVA, según precios de mercado encontrados por el buscador: $${costoTotalConIva.toLocaleString('es-CL')}
- Costo neto estimado: $${costoTotalNeto.toLocaleString('es-CL')}
- Cobertura de cotización: ${itemsConPrecio} de ${totalItems} ítems con precio encontrado (${coberturaPct.toFixed(0)}%)${itemsSinPrecio > 0 ? ` — ${itemsSinPrecio} ítem(s) SIN precio, su costo NO está incluido en el total anterior` : ''}
${margenPct !== null ? `- Margen real (presupuesto vs costo encontrado): ${margenPct.toFixed(1)}% ${margenPct >= 0 ? '(el costo cabe dentro del presupuesto)' : '(el costo YA SUPERA el presupuesto disponible)'}` : '- Margen: no se pudo calcular (presupuesto no especificado en los documentos)'}
- Plazo aceptación OC: ${analisis.plazo_aceptacion_oc || '—'}
- Garantías exigidas: ${analisis.garantias || '—'}
- Multas: ${analisis.multas || '—'}
- Forma de evaluación: precio ${formaEval.criterio_economico || '—'}, técnico ${formaEval.criterio_tecnico || '—'}, programa ${formaEval.programa || '—'}, requisitos formales ${formaEval.requisitos_formales || '—'}
- Veredicto previo (basado solo en documentos, sin precios reales): proyecto_viable=${analisis.proyecto_viable || '—'} — "${analisis.justificacion_viabilidad || '—'}"
- Productos críticos detectados previamente en los documentos: ${analisis.productos_criticos || '—'}
${itemsAltoRiesgo.length ? `- ÍTEMS DE ALTO RIESGO DE BÚSQUEDA (coincidencia poco confiable, posible diferencia de unidad o sin resultados — su precio real puede ser DISTINTO al usado en el cálculo, conviene verificar la ficha técnica antes de cotizar):
${itemsAltoRiesgo.map(it => `  · #${it.numero} ${it.nombre} — ${it.motivo}${it.match > 0 ? ` (match ${it.match}%)` : ''}`).join('\n')}` : '- No se detectaron ítems de alto riesgo de búsqueda.'}

REGLAS DE DECISIÓN — aplícalas en este orden:
1. Si el presupuesto no está especificado (margen no calculable), decide SOLO según criterios de evaluación, multas, garantías y plazos, y dilo explícitamente en "observaciones".
2. Si hay ítems sin precio (itemsSinPrecio > 0) o ítems de alto riesgo de búsqueda, el costo real puede estar SUBESTIMADO. Trátalos como un riesgo adicional sobre el margen, no los ignores.
3. Margen ≥ 15% (considerando el riesgo del punto 2): VIABLE ("SI"), salvo que multas, garantías o plazos sean por sí solos prohibitivos.
4. Margen entre 0% y 15%: caso límite. VIABLE ("SI") solo si el criterio económico tiene peso relevante en la evaluación Y no hay riesgos adicionales importantes (ítems sin precio relevantes, muchos ítems de alto riesgo, multas/plazos desfavorables). En cualquier otro caso: "NO".
5. Margen negativo: NO VIABLE ("NO"), salvo que el déficit sea menor al 3% del presupuesto Y los ítems sin precio/alto riesgo sugieran que el costo real podría terminar siendo menor — en ese caso responde "SI" pero indica claramente la reserva en "observaciones".
6. Sé conservador ante la duda: si los datos son insuficientes para confirmar viabilidad, responde "NO" y explica qué falta verificar.

Responde SOLO con este JSON, sin texto antes ni después, sin markdown, todos los valores en una sola línea (sin saltos de línea):
{
  "proyecto_viable": "SI o NO",
  "justificacion_viabilidad": "explicación breve (2-4 frases) del veredicto, citando el margen real, la regla de decisión aplicada y los criterios/riesgos que la sustentan",
  "observaciones": "alertas y recomendaciones concretas para el equipo comercial (ítems sin precio, ítems de alto riesgo, riesgos de margen, plazos o garantías ajustadas)",
  "productos_criticos": "lista breve de ítems (número y nombre) que deben verificarse manualmente con su ficha técnica antes de cotizar, combinando los detectados antes con los nuevos del buscador, o '${analisis.productos_criticos || ''}' si no hay nuevos"
}`;

    const txt = await generarConGemini([{ text: prompt }], 4096);
    const parsed = parsearJSONSeguro(txt);

    return NextResponse.json({
      ok: true,
      proyecto_viable: String(parsed.proyecto_viable ?? '').trim(),
      justificacion_viabilidad: String(parsed.justificacion_viabilidad ?? '').trim(),
      observaciones: String(parsed.observaciones ?? '').trim(),
      productos_criticos: String(parsed.productos_criticos ?? '').trim(),
      presupuesto,
      margen_pct: margenPct,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    console.error('[viabilidad-veredicto] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
