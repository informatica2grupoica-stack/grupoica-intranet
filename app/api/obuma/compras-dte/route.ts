// app/api/obuma/compras-dte/route.ts — DTE recibidos
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filtros: Record<string, string> = {};
    const campos = [
      'id_dcto', 'id_dcto_desde', 'tipo_dcto', 'folio_dcto',
      'mes_contable', 'ano_contable',
      'total', 'proveedor', 'id_proveedor', 'rut_proveedor', 'id_compra',
    ];
    campos.forEach((c) => {
      const v = searchParams.get(c);
      if (v) filtros[c] = v;
    });

    const qs = new URLSearchParams(filtros).toString();
    const url = `${process.env.OBUMA_API_URL}/comprasDte.list.json${qs ? `?${qs}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      cache: 'no-store',
    });

    const result = await response.json();

    if (result.success === false || result.status === false) {
      return NextResponse.json(
        { error: result.message || 'Error al consultar DTE', details: result },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error al obtener DTE', details: error.message },
      { status: 500 }
    );
  }
}
