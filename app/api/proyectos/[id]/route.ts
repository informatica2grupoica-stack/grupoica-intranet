// app/api/proyectos/[id]/route.ts — GET/PUT/DELETE por ID
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: proyecto, error } = await supabase
      .from('proyectos').select('*').eq('id', params.id).single();
    if (error) throw error;

    const { data: hitos } = await supabase
      .from('proyectos_hitos')
      .select('*').eq('proyecto_id', params.id).order('fecha_limite');

    const { data: documentos } = await supabase
      .from('proyectos_documentos')
      .select('*').eq('proyecto_id', params.id).order('created_at');

    return NextResponse.json({ data: { ...proyecto, hitos: hitos || [], documentos: documentos || [] } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { data, error } = await supabase
      .from('proyectos')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select().single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabase
      .from('proyectos').update({ activo: false, updated_at: new Date().toISOString() }).eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
