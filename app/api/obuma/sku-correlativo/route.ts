// src/app/api/obuma/sku-correlativo/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const baseSKU = searchParams.get('base'); // Ejemplo: 6026419

  if (!baseSKU) return NextResponse.json({ error: 'Falta base SKU' }, { status: 400 });

  try {
    // 1. Pedimos a Obuma la lista de productos (puedes filtrar por código si la API lo permite)
    // Para ser exactos, lo ideal es pedir los productos que EMPIECEN con ese baseSKU
    const res = await fetch(`https://api.obuma.cl/v1/productos.list.json?codigo=${baseSKU}`, {
      headers: {
        'App-Id': process.env.OBUMA_APP_ID || '',
        'App-Token': process.env.OBUMA_APP_TOKEN || ''
      }
    });

    const result = await res.json();
    const productos = result.data || [];

    // 2. Buscamos el correlativo más alto
    // Filtramos los que realmente empiezan con la base y extraemos los últimos 3 dígitos
    const numerosUsados = productos
      .map((p: any) => {
        const skuStr = String(p.producto_codigo_comercial);
        if (skuStr.startsWith(baseSKU)) {
          const suffix = skuStr.replace(baseSKU, "");
          return parseInt(suffix) || 0;
        }
        return 0;
      });

    const maxNumero = numerosUsados.length > 0 ? Math.max(...numerosUsados) : 0;
    const siguiente = String(maxNumero + 1).padStart(3, '0'); // Ejemplo: "001", "002"

    return NextResponse.json({ correlativo: siguiente });

  } catch (error) {
    return NextResponse.json({ correlativo: "001" }, { status: 500 });
  }
}