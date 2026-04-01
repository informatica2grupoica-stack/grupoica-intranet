// /api/obuma/siguiente-sku/route.ts (o tu archivo de ruta)
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefijoSub = searchParams.get('prefijoSub'); // Ej: "60264"

  if (!prefijoSub) {
    return NextResponse.json({ error: 'Falta prefijo' }, { status: 400 });
  }

  try {
    // CAMBIO CLAVE: Usamos 'busqueda' en lugar de 'codigo' para que sea más amplio
    // o simplemente traemos la lista. Obuma a veces no filtra bien prefijos cortos.
    const res = await fetch(`https://api.obuma.cl/v1/productos.list.json`, {
      headers: {
        'App-Id': process.env.OBUMA_APP_ID || '',
        'App-Token': process.env.OBUMA_APP_TOKEN || '',
      }
    });

    const result = await res.json();
    // Obuma devuelve los productos en result.data
    const todosLosProductos = result.data || [];

    // 2. Filtramos nosotros manualmente los que EMPIECEN con tu prefijo
    const numerosUsados = todosLosProductos
      .filter((p: any) => String(p.producto_codigo_comercial).startsWith(prefijoSub))
      .map((p: any) => {
        const skuStr = String(p.producto_codigo_comercial);
        // Extraemos solo los últimos 3 dígitos
        const suffix = skuStr.substring(prefijoSub.length);
        const num = parseInt(suffix);
        return isNaN(num) ? 0 : num;
      });

    // 3. Calculamos el siguiente
    let proximoNumero = 1; // Por defecto empezamos en 1 si no hay nada

    if (numerosUsados.length > 0) {
      const maxActual = Math.max(...numerosUsados);
      proximoNumero = maxActual + 1;
    }

    // Si quieres forzar que el mínimo sea 4 como dijiste antes, descomenta la línea de abajo:
    // proximoNumero = Math.max(proximoNumero, 4);

    const siguienteCorrelativo = String(proximoNumero).padStart(3, '0'); 

    return NextResponse.json({ 
      sku: `${prefijoSub}${siguienteCorrelativo}` 
    });

  } catch (error) {
    console.error("Error en API SKU:", error);
    return NextResponse.json({ sku: `${prefijoSub}002` });
  }
}