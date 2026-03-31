import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefijoSub = searchParams.get('prefijoSub'); // Ej: "60264"

  if (!prefijoSub) {
    return NextResponse.json({ error: 'Falta base de canal y subcategoría' }, { status: 400 });
  }

  try {
    // Buscamos productos en Obuma que empiecen con ese código
    const res = await fetch(`https://api.obuma.cl/v1/productos.list.json?codigo=${prefijoSub}`, {
      headers: {
        'App-Id': process.env.OBUMA_APP_ID || '',
        'App-Token': process.env.OBUMA_APP_TOKEN || '',
      }
    });

    const result = await res.json();
    const productos = result.data || [];

    // Extraemos los correlativos finales
    const numerosUsados = productos
      .map((p: any) => {
        const skuStr = String(p.producto_codigo_comercial);
        if (skuStr.startsWith(prefijoSub)) {
          // Tomamos lo que sigue después de la base
          const suffix = skuStr.replace(prefijoSub, "");
          const num = parseInt(suffix);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      });

    // Buscamos el mayor y sumamos 1
    const maxNumero = numerosUsados.length > 0 ? Math.max(...numerosUsados) : 0;
    const siguienteCorrelativo = String(maxNumero + 1).padStart(3, '0'); 

    return NextResponse.json({ 
      sku: `${prefijoSub}${siguienteCorrelativo}` 
    });

  } catch (error) {
    console.error("Error en API SKU:", error);
    return NextResponse.json({ sku: `${prefijoSub}001` }); // Fallback por defecto
  }
}