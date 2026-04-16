// app/api/deepseek/sugerir-sku/route.ts
import { NextResponse } from 'next/server';
import { callDeepSeek } from '@/app/lib/deepseek/client';
import { buscarAprendizajeSimilar } from '@/app/lib/deepseek/aprendizaje';

export async function POST(req: Request) {
  try {
    const { nombreProducto, categoria, subcategoria, productosExistentes } = await req.json();

    if (!nombreProducto || nombreProducto.trim() === "") {
      return NextResponse.json({ error: "Nombre de producto requerido" }, { status: 400 });
    }

    // Buscar aprendizaje similar
    const aprendizajesSimilares = await buscarAprendizajeSimilar(nombreProducto);
    
    // Determinar prefijo según categoría
    let prefijo = "50"; // Default
    if (categoria?.toUpperCase().includes("MERCADO PUBLICO")) {
      prefijo = "60";
    } else if (categoria?.toUpperCase().includes("B2B")) {
      prefijo = "40";
    }

    // Obtener últimos SKUs usados para ese prefijo
    const skusExistentes = productosExistentes
      ?.filter((p: any) => String(p.producto_codigo_comercial).startsWith(prefijo))
      .map((p: any) => p.producto_codigo_comercial) || [];

    const prompt = `Eres un experto en generación de SKUs para productos.
    
Reglas:
- El SKU debe comenzar con el prefijo "${prefijo}"
- Luego debe tener 7 dígitos correlativos (ej: ${prefijo}1234567)
- No debe repetir SKUs existentes: ${skusExistentes.join(', ')}
- El SKU debe ser fácil de recordar y relacionado con el producto

Producto: "${nombreProducto}"
Categoría: ${categoria || "No especificada"}
Subcategoría: ${subcategoria || "No especificada"}

Basado en aprendizajes anteriores: ${JSON.stringify(aprendizajesSimilares)}

Responde SOLO con un JSON: {"sku": "60XXXXXXX", "explicacion": "breve razón del SKU"}`;

    const result = await callDeepSeek([
      { role: "system", content: "Eres un generador de SKUs. Solo respondes con JSON válido." },
      { role: "user", content: prompt }
    ], 0.2, 200);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Parsear respuesta
    let skuSugerido = "";
    let explicacion = "";
    try {
      const parsed = JSON.parse(result.content);
      skuSugerido = parsed.sku;
      explicacion = parsed.explicacion;
    } catch {
      // Si no es JSON, extraer SKU del texto
      const match = result.content.match(/\d{10,}/);
      skuSugerido = match ? match[0] : `${prefijo}${Date.now().toString().slice(-7)}`;
      explicacion = "SKU generado automáticamente";
    }

    return NextResponse.json({
      sku: skuSugerido,
      explicacion,
      prefijo
    });

  } catch (error: any) {
    console.error("Error en sugerir-sku:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}