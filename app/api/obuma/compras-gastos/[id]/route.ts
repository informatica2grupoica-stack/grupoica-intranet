import { NextRequest, NextResponse } from 'next/server';
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await fetch(`${process.env.OBUMA_API_URL}/comprasGastos.findById.json/${id}`, {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN||'' }, cache: 'no-store',
    });
    return NextResponse.json(await res.json());
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
