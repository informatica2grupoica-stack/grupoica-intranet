import { NextResponse } from 'next/server';
export async function GET() {
  try {
    const res = await fetch(`${process.env.OBUMA_API_URL}/contabilidadPlanDeCuentas.list.json`, {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN||'' }, cache: 'no-store',
    });
    return NextResponse.json(await res.json());
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
