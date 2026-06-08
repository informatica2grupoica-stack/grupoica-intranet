// app/api/chatbot/feedback/route.ts
// Guarda el feedback 👍/👎 de una respuesta del chatbot para retroalimentación
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { historial_id, feedback, usuario_id } = await req.json();
    if (!historial_id) return NextResponse.json({ error: 'historial_id requerido' }, { status: 400 });

    const { error } = await supabase
      .from('chatbot_historial')
      .update({ feedback: feedback === true })
      .eq('id', historial_id)
      .eq('usuario_id', usuario_id); // solo el propio usuario puede evaluar

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
