// app/api/busquedas-guardadas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser } from '@/lib/authServer';

// GET — carga una búsqueda completa para restaurarla en el buscador
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;

  let query = supabaseAdmin
    .from('busquedas_guardadas')
    .select('*')
    .eq('id', id);

  // Usuario normal solo puede leer las suyas
  if (!user.esAdminOSuper) {
    query = query.eq('user_id', user.id);
  }

  const { data, error } = await query.single();

  if (error) {
    return NextResponse.json(
      { error: error.code === 'PGRST116' ? 'No encontrado o sin permiso' : error.message },
      { status: error.code === 'PGRST116' ? 404 : 500 }
    );
  }

  return NextResponse.json({ busqueda: data });
}

// DELETE — elimina; usuario normal solo puede borrar las suyas, admin puede borrar cualquiera
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;

  let query = supabaseAdmin
    .from('busquedas_guardadas')
    .delete()
    .eq('id', id);

  if (!user.esAdminOSuper) {
    query = query.eq('user_id', user.id);
  }

  const { error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
