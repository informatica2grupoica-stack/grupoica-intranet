// app/api/obuma/stock/sku/[sku]/route.ts
import { NextResponse, NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  try {
    const { sku } = await params;
    const { searchParams } = new URL(request.url);
    const id_bodega = searchParams.get('id_bodega') || '1';
    
    const response = await fetch(`${process.env.OBUMA_API_URL}/productosStock.findByCodigoSku.json/${sku}?id_bodega=${id_bodega}`, {
      method: 'GET',
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      stock: data.stock_actual || data.cantidad || 0,
      detalle: data
    });
    
  } catch (error: any) {
    console.error("Error consultando stock:", error);
    return NextResponse.json(
      { error: 'Error al consultar stock', details: error.message },
      { status: 500 }
    );
  }
}