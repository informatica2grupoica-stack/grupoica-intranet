// app/api/busquedas-guardadas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

// GET — lista búsquedas guardadas
//   Usuario normal → solo las suyas
//   Admin/superuser → todas, con datos del perfil de cada usuario
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let query = supabaseAdmin
    .from('busquedas_guardadas')
    .select('id, nombre, nombre_archivo, id_proyecto, total_productos, con_resultados, avg_match, created_at, user_id, user_email, user_nombre')
    .order('created_at', { ascending: false })
    .limit(200);

  // Usuario normal: filtrar solo las suyas
  if (!user.esAdminOSuper) {
    query = query.eq('user_id', user.id);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ busquedas: data ?? [], esAdmin: user.esAdminOSuper });
}

// POST — guarda una nueva búsqueda asociada al usuario autenticado
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      nombre,
      nombre_archivo = '',
      id_proyecto = '',
      items_excel = [],
      items_lista = [],
      seleccion = {},
      total_productos = 0,
      con_resultados = 0,
      avg_match = 0,
      // Datos del Excel original para poder exportar al restaurar
      excel_base64 = null,
      cols_excel = null,
      sheet_name = 'COSTEO',
    } = body;

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('busquedas_guardadas')
      .insert({
        nombre: nombre.trim(),
        nombre_archivo,
        id_proyecto,
        items_excel,
        items_lista,
        seleccion,
        total_productos,
        con_resultados,
        avg_match,
        // Excel original para restaurar exportación
        excel_base64,
        cols_excel,
        sheet_name,
        // Datos del usuario autenticado
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
