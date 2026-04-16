// app/api/deepseek/verificar-producto/route.ts
import { NextResponse } from 'next/server';
import { callDeepSeek } from '@/app/lib/deepseek/client';

export async function POST(req: Request) {
  try {
    const { nombreProducto, productosExistentes } = await req.json();

    if (!nombreProducto || nombreProducto.trim() === "") {
      return NextResponse.json({ existe: false, productosSimilares: [] });
    }

    // Buscar productos similares en los existentes
    const productosSimilares = productosExistentes
      ?.filter((p: any) => {
        const nombreProductoLower = nombreProducto.toLowerCase();
        const nombreExistente = (p.producto_nombre || "").toLowerCase();
        return nombreExistente.includes(nombreProductoLower) || 
               nombreProductoLower.includes(nombreExistente);
      })
      .slice(0, 5) || [];

    if (productosSimilares.length === 0) {
      return NextResponse.json({ existe: false, productosSimilares: [] });
    }

    // Usar IA para determinar si es realmente duplicado
    const prompt = `Analiza si el siguiente producto es similar a alguno existente:

Producto a crear: "${nombreProducto}"

Productos existentes similares:
${productosSimilares.map((p: any, i: number) => `${i+1}. ${p.producto_nombre} (SKU: ${p.producto_codigo_comercial})`).join('\n')}

Responde SOLO con JSON: {"esDuplicado": true/false, "recomendacion": "mensaje corto", "productoRecomendado": "nombre del producto similar si aplica"}`;

    const result = await callDeepSeek([
      { role: "system", content: "Eres un validador de productos. Solo respondes con JSON." },
      { role: "user", content: prompt }
    ], 0.1, 200);

    if (result.error) {
      return NextResponse.json({ existe: productosSimilares.length > 0, productosSimilares });
    }

    try {
      const parsed = JSON.parse(result.content);
      return NextResponse.json({
        existe: parsed.esDuplicado || productosSimilares.length > 0,
        productosSimilares,
        recomendacion: parsed.recomendacion,
        productoRecomendado: parsed.productoRecomendado
      });
    } catch {
      return NextResponse.json({ existe: productosSimilares.length > 0, productosSimilares });
    }

  } catch (error: any) {
    console.error("Error en verificar-producto:", error);
    return NextResponse.json({ existe: false, productosSimilares: [] });
  }
}