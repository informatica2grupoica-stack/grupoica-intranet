// src/app/api/obuma/siguiente-sku/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefijoSub = searchParams.get('prefijoSub'); // Ejemplo: "6026419"

  if (!prefijoSub) {
    return NextResponse.json({ error: 'Falta prefijo y subcategoría' }, { status: 400 });
  }

  try {
    // 1. Buscamos productos en Obuma que empiecen con esa base
    // Usamos el filtro 'codigo' que permite la API de Obuma
    const res = await fetch(`https://api.obuma.cl/v1/productos.list.json?codigo=${prefijoSub}`, {
      headers: {
        'App-Id': process.env.OBUMA_APP_ID || '',
        'App-Token': process.env.OBUMA_APP_TOKEN || '',
      }
    });

    const result = await res.json();
    const productos = result.data || [];

    // 2. Extraemos los correlativos (los últimos 3 dígitos)
    const numerosUsados = productos
      .map((p: any) => {
        const skuStr = String(p.producto_codigo_comercial);
        if (skuStr.startsWith(prefijoSub)) {
          // Extraemos lo que hay después del prefijo+subid
          const suffix = skuStr.replace(prefijoSub, "");
          return parseInt(suffix) || 0;
        }
        return 0;
      });

    // 3. Calculamos el siguiente
    const maxNumero = numerosUsados.length > 0 ? Math.max(...numerosUsados) : 0;
    const siguiente = String(maxNumero + 1).padStart(3, '0'); 

    return NextResponse.json({ sku: `${prefijoSub}${siguiente}` });

  } catch (error) {
    console.error("Error en API SKU:", error);
    return NextResponse.json({ sku: `${prefijoSub}001` }); // Fallback
  }
}