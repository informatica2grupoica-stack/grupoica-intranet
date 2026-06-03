import { NextRequest, NextResponse } from 'next/server';
export async function GET(request: NextRequest) {
  try {
    const tipo = request.nextUrl.searchParams.get('tipo') || 'all';
    const endpoints: Record<string,string> = {
      all: 'empleados.list.json',
      activos: 'empleados.listActivos.json',
      inactivos: 'empleados.listInactivos.json',
      usuarios: 'empleados.listUsuarios.json',
    };
    const ep = endpoints[tipo] || endpoints.all;
    const res = await fetch(`${process.env.OBUMA_API_URL}/${ep}`, {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN||'' }, cache: 'no-store',
    });
    return NextResponse.json(await res.json());
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
