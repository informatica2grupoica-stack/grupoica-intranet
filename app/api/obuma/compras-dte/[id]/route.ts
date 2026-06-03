// app/api/obuma/compras-dte/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = `${process.env.OBUMA_API_URL}/comprasDte.findById.json/${id}`;
    const res = await fetch(url, {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' },
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok || data.status === false) {
      return NextResponse.json({ error: data.message || 'Error DTE' }, { status: 400 });
    }
    return NextResponse.json(data.data?.[0] || data.docs?.[0] || data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
