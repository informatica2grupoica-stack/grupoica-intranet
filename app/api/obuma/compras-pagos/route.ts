// app/api/obuma/compras-pagos/route.ts — Pagos de compras
import { NextRequest, NextResponse } from 'next/server';

const ORIGEN_NOMBRE: Record<string, string> = {
  '0': 'Compras',
  '1': 'Boletas Honorarios',
  '2': 'Pago IVA',
  '3': 'Remuneraciones',
  '4': 'Anticipos Proveedores',
  '5': 'Pago Imposiciones',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filtros: Record<string, string> = {};
    const campos = [
      'mes', 'ano',
      'fecha_ingreso_desde', 'fecha_ingreso_hasta',
      'origen', 'compra_id',
    ];
    campos.forEach((c) => {
      const v = searchParams.get(c);
      if (v) filtros[c] = v;
    });

    const qs = new URLSearchParams(filtros).toString();
    const url = `${process.env.OBUMA_API_URL}/comprasPagos.list.json${qs ? `?${qs}` : ''}`;

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
        { error: result.message || 'Error al consultar pagos', details: result },
        { status: 400 }
      );
    }

    // Enriquecer con nombre de origen
    const data = Array.isArray(result.data || result)
      ? (result.data || result).map((p: any) => ({
          ...p,
          cp_origen_nombre: ORIGEN_NOMBRE[String(p.cp_origen)] || `Origen ${p.cp_origen}`,
        }))
      : [];

    return NextResponse.json({ ...result, data });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error al obtener pagos', details: error.message },
      { status: 500 }
    );
  }
}
