// app/api/obuma/diagnostico/route.ts
// Diagnóstico: compara el catálogo REAL de Obuma vs lo sincronizado en Supabase.
// Ayuda a saber por qué el chatbot no encuentra ciertos productos.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const OBUMA_URL = process.env.OBUMA_API_URL;
const OBUMA_TOKEN = process.env.OBUMA_API_TOKEN || '';

async function obumaPagina(page: number, limit: number) {
  const url = new URL(`${OBUMA_URL}/productos.list.json`);
  url.searchParams.append('page', String(page));
  url.searchParams.append('limit', String(limit));
  const r = await fetch(url.toString(), {
    headers: { 'access-token': OBUMA_TOKEN, 'Content-Type': 'application/json' },
  });
  const data = await r.json().catch(() => ({}));
  const productos = data.data || data.productos || [];
  return { http: r.status, productos, pagination: data.pagination || null, rawKeys: Object.keys(data) };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const buscar = (searchParams.get('buscar') || '').toLowerCase();

  if (!OBUMA_URL || !OBUMA_TOKEN) {
    return NextResponse.json({ error: 'Faltan OBUMA_API_URL / OBUMA_API_TOKEN en el entorno' }, { status: 500 });
  }

  try {
    // Recorrer Obuma con paginación y juntar TODO
    let pagina = 1;
    let todos: any[] = [];
    let paginasInfo: any[] = [];
    let hayMas = true;
    let primeraPaginacion: any = null;

    while (hayMas && pagina <= 60) {
      const { http, productos, pagination, rawKeys } = await obumaPagina(pagina, 200);
      if (pagina === 1) primeraPaginacion = { http, pagination, rawKeys, ejemplo_campos: productos[0] ? Object.keys(productos[0]) : [] };
      paginasInfo.push({ pagina, recibidos: productos.length });
      if (!productos.length) { hayMas = false; }
      else { todos.push(...productos); pagina++; }
    }

    // Nombres de muestra
    const nombres = todos.map((p) => p.producto_nombre || '').filter(Boolean);
    const muestra = nombres.slice(0, 25);

    // ¿Cuántos contienen el término buscado?
    let coincidencias: string[] = [];
    if (buscar) {
      coincidencias = nombres.filter((n) => n.toLowerCase().includes(buscar)).slice(0, 30);
    }

    // Conteo en Supabase
    const { count: supaCount } = await supabase
      .from('productos_obuma')
      .select('*', { count: 'exact', head: true });

    // Categorías presentes (top)
    const cats: Record<string, number> = {};
    todos.forEach((p) => {
      const c = p.categoria_nombre || p.producto_categoria || 'sin_categoria';
      cats[c] = (cats[c] || 0) + 1;
    });
    const categoriasTop = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 15);

    return NextResponse.json({
      obuma_total_productos: todos.length,
      supabase_total_productos: supaCount || 0,
      diferencia: todos.length - (supaCount || 0),
      paginacion_funciona: paginasInfo.length > 1 && paginasInfo[1].recibidos > 0,
      paginas: paginasInfo,
      primera_pagina_info: primeraPaginacion,
      categorias_top: categoriasTop,
      muestra_nombres: muestra,
      buscar_termino: buscar || null,
      coincidencias_en_obuma: buscar ? coincidencias : 'usa ?buscar=martillo para probar',
      coincidencias_total: buscar ? coincidencias.length : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
