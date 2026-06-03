// app/api/obuma/ventas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await fetch(`${process.env.OBUMA_API_URL}/ventas.findById.json/${id}`, {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN||'' }, cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok || data.status === false) return NextResponse.json({ error: data.message }, { status: 400 });
    return NextResponse.json(data.data?.[0] || data.docs?.[0] || data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
