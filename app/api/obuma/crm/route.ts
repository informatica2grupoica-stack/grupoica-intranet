import { NextRequest, NextResponse } from 'next/server';
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campos = ['titulo','nombre_empresa','contacto','telefono','celular','email','importe',
      'f_desde_ultimaaccion','f_hasta_ultimaaccion','f_desde_registro','f_hasta_registro',
      'fecha_proximaaccion','accion_tarea','responsable','estado','etapa','campana','cl_esProspecto'];
    const filtros: Record<string,string> = {};
    campos.forEach(c => { const v = searchParams.get(c); if (v) filtros[c] = v; });
    const qs = new URLSearchParams(filtros).toString();
    const res = await fetch(`${process.env.OBUMA_API_URL}/crm.list.json${qs?`?${qs}`:''}`, {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN||'' }, cache: 'no-store',
    });
    return NextResponse.json(await res.json());
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${process.env.OBUMA_API_URL}/crm.create.json`, {
      method: 'POST',
      headers: { 'access-token': process.env.OBUMA_API_TOKEN||'', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json());
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
