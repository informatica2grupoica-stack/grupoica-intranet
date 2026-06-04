// app/api/capacitaciones/upload-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const BUCKET = 'comercialMP';

export async function POST(request: NextRequest) {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url)  return NextResponse.json({ error: 'NEXT_PUBLIC_SUPABASE_URL no configurada' }, { status: 500 });
  if (!sKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada en Vercel' }, { status: 500 });

  const supabase = createClient(url, sKey);

  try {
    const body = await request.json().catch(() => ({}));
    const ext  = body.tipo_archivo === 'pptx' ? 'pptx' : 'pdf';

    // Generar path único dentro del bucket existente
    const path = `capacitaciones/cap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { data, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (signErr || !data) {
      return NextResponse.json(
        { error: `No se pudo generar URL firmada: ${signErr?.message ?? 'respuesta vacía'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bucket: BUCKET,
      path,
      tipo_archivo: ext,
      token:     data.token,
      signedUrl: data.signedUrl,
    });

  } catch (e: any) {
    return NextResponse.json({ error: `Error inesperado: ${e.message}` }, { status: 500 });
  }
}
