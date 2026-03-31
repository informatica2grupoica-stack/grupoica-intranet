import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefijoSub = searchParams.get('prefijoSub'); // Ej: "60264"

  if (!prefijoSub) {
    return NextResponse.json({ error: 'Falta base de canal y subcategoría' }, { status: 400 });
  }

  try {
    // 1. Buscamos productos en Obuma que tengan ese prefijo en el código
    const res = await fetch(`https://api.obuma.cl/v1/productos.list.json?codigo=${prefijoSub}`, {
      headers: {
        'App-Id': process.env.OBUMA_APP_ID || '',
        'App-Token': process.env.OBUMA_APP_TOKEN || '',
      }
    });

    const result = await res.json();
    const productos = result.data || [];

    // 2. Extraemos los correlativos numéricos después del prefijo
    const numerosUsados = productos
      .map((p: any) => {
        const skuStr = String(p.producto_codigo_comercial);
        if (skuStr.startsWith(prefijoSub)) {
          // Extraemos la parte numérica final (los últimos 3 o lo que sobre)
          const suffix = skuStr.replace(prefijoSub, "");
          const num = parseInt(suffix);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      })
      .filter((n: number) => n > 0); // Filtramos para quedarnos solo con números válidos

    // 3. LÓGICA CLAVE: 
    // Si no hay productos (numerosUsados vacío), empezamos en 4.
    // Si hay productos, buscamos el mayor y sumamos 1.
    // Pero si el mayor es menor a 3, forzamos que el siguiente sea 4.
    
    let proximoNumero = 4; // Valor inicial por defecto si no hay nada

    if (numerosUsados.length > 0) {
      const maxActual = Math.max(...numerosUsados);
      // Si el máximo encontrado es 5, el siguiente será 6.
      // Si el máximo encontrado es 1 (porque alguien creó uno manual), el siguiente será 4.
      proximoNumero = Math.max(maxActual + 1, 4);
    }

    const siguienteCorrelativo = String(proximoNumero).padStart(3, '0'); 

    return NextResponse.json({ 
      sku: `${prefijoSub}${siguienteCorrelativo}` 
    });

  } catch (error) {
    console.error("Error en API SKU:", error);
    // En caso de error de red, devolvemos el 004 como segurida
    return NextResponse.json({ sku: `${prefijoSub}005` });
  }
}