// app/api/viabilidad/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

// GET — lista análisis de viabilidad guardados
//   Usuario normal → solo los suyos
//   Admin/superuser → todos
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let query = supabaseAdmin
    .from('viabilidad_analisis')
    .select('id, nombre, id_proceso, cliente, proyecto_viable, created_at, user_id, user_email, user_nombre')
    .order('created_at', { ascending: false })
    .limit(200);

  if (!user.esAdminOSuper) {
    query = query.eq('user_id', user.id);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ analisis: data ?? [], esAdmin: user.esAdminOSuper });
}

// POST — guarda un nuevo análisis de viabilidad asociado al usuario autenticado
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      nombre,
      id_proceso = '',
      cliente = '',
      proyecto_viable = '',
      analisis = {},
      items = [],
      items_excel = [],
      archivos = [],
      excel_base64 = null,
      cols_excel = null,
      sheet_name = 'COSTEO',
    } = body;

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('viabilidad_analisis')
      .insert({
        nombre: nombre.trim(),
        id_proceso,
        cliente,
        proyecto_viable,
        analisis,
        items,
        items_excel,
        archivos,
        excel_base64,
        cols_excel,
        sheet_name,
        user_id: user.id,
        user_email: user.email,
        user_nombre: user.nombre,
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
