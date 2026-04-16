// app/api/deepseek/autocompletar/route.ts
import { NextResponse } from 'next/server';
import { callDeepSeek } from '@/app/lib/deepseek/client';

export async function POST(req: Request) {
  try {
    const { nombreProducto } = await req.json();

    if (!nombreProducto || nombreProducto.trim() === "") {
      return NextResponse.json({ error: "Nombre de producto requerido" }, { status: 400 });
    }

    const prompt = `Analiza el siguiente nombre de producto y divídelo en 4 partes:

Producto: "${nombreProducto}"

Reglas:
- c1 = Tipo de producto (ej: "CABLE", "MONITOR", "TECLADO")
- c2 = Atributo/Especificación (ej: "USB C", "HDMI", "MECÁNICO")
- c3 = Medida/Tamaño (solo número, sin "MT")
- c4 = Marca o detalle adicional

Ejemplo:
"MONITOR LED 24 LG" → {"c1":"MONITOR", "c2":"LED", "c3":"24", "c4":"LG"}

Responde SOLO con JSON: {"c1":"", "c2":"", "c3":"", "c4":""}`;

    const result = await callDeepSeek([
      { role: "system", content: "Eres un analizador de nombres de productos. Solo respondes con JSON." },
      { role: "user", content: prompt }
    ], 0.2, 200);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    try {
      const parsed = JSON.parse(result.content);
      return NextResponse.json({
        c1: parsed.c1 || "",
        c2: parsed.c2 || "",
        c3: parsed.c3 || "",
        c4: parsed.c4 || ""
      });
    } catch {
      return NextResponse.json({ error: "Error parseando respuesta" }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Error en autocompletar:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}