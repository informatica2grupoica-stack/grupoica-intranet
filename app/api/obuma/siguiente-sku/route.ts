import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefijoSub = searchParams.get('prefijoSub'); // Ejemplo: 60264

  if (!prefijoSub) return NextResponse.json({ error: 'Falta prefijo' }, { status: 400 });

  try {
    // Pedimos la lista a Obuma
    const res = await fetch(`https://api.obuma.cl/v1/productos.list.json`, {
      headers: {
        'App-Id': process.env.OBUMA_APP_ID || '',
        'App-Token': process.env.OBUMA_APP_TOKEN || ''
      },
      cache: 'no-store' // CRÍTICO: Para que no use caché y vea el producto que acabas de crear
    });

    const result = await res.json();
    const productos = result.data || [];

    // Buscamos el número más alto que empiece con ese prefijo
    const numerosUsados = productos
      .filter((p: any) => String(p.producto_codigo_comercial).startsWith(prefijoSub))
      .map((p: any) => {
        const skuStr = String(p.producto_codigo_comercial);
        const sufijo = skuStr.replace(prefijoSub, "");
        return parseInt(sufijo) || 0;
      });

    // Si el máximo es 0 y tu base es 60264, el primero será 60264001
    // Si ya usaste el 001, el máximo será 1 y el siguiente 2 (002)
    const maxNumero = numerosUsados.length > 0 ? Math.max(...numerosUsados) : 0;
    const proximoNumero = maxNumero + 1;
    
    const nuevoSku = `${prefijoSub}${String(proximoNumero).padStart(3, '0')}`;

    return NextResponse.json({ sku: nuevoSku });

  } catch (error) {
    // Si falla la API, por seguridad damos el 001 del prefijo
    return NextResponse.json({ sku: `${prefijoSub}002` });
  }
}