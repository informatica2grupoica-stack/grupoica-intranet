// app/api/buscar/route.ts (CREAR ESTE ARCHIVO NUEVO)
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { producto, numero_item = "" } = body;

    const pythonUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:5000';
    
    const response = await fetch(`${pythonUrl}/buscar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ producto, numero_item }),
    });

    const data = await response.json();
    
    // Transformar al formato que espera el frontend
    const resultadosFormateados = (data.resultados || []).map((r: any) => ({
      tienda: r.tienda,
      nombre: r.nombre,
      precio_valor: r.precio_con_iva,
      precio_formateado: r.precio_formateado,
      link: r.url,
      canal: r.fuente || 'web',
      busqueda_original: producto,
      matching: {
        porcentaje: r.score,
        nivel: r.nivel_concordancia === 'exacta' ? 'exacto' : r.nivel_concordancia === 'parcial' ? 'parcial' : 'bajo',
        razon: r.etiqueta_concordancia
      }
    }));

    return NextResponse.json({
      success: true,
      numero_item: data.numero_item,
      producto: data.producto,
      resultados: resultadosFormateados,
      total_encontrados: resultadosFormateados.length,
      suficientes: resultadosFormateados.length >= 9,
      deficit: Math.max(0, 9 - resultadosFormateados.length),
      mejor_match: resultadosFormateados[0] || null
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}