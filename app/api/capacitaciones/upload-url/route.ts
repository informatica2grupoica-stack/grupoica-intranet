// app/api/capacitaciones/upload-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const BUCKET = 'capacitaciones-archivos';

export async function POST(request: NextRequest) {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const aKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Diagnóstico de variables de entorno
  if (!url)  return NextResponse.json({ error: 'NEXT_PUBLIC_SUPABASE_URL no está configurada' }, { status: 500 });
  if (!sKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en las variables de entorno del servidor (Vercel). Agrégala en Vercel → Settings → Environment Variables.' }, { status: 500 });

  const supabase = createClient(url, sKey);

  try {
    const body = await request.json().catch(() => ({}));
    const ext  = body.tipo_archivo === 'pptx' ? 'pptx' : 'pdf';

    // 1. Asegurar que el bucket existe
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    if (listErr) {
      return NextResponse.json(
        { error: `No se pudo listar buckets (¿SERVICE_ROLE_KEY correcta?): ${listErr.message}` },
        { status: 500 }
      );
    }

    const existe = (buckets || []).some((b: any) => b.name === BUCKET);

    if (!existe) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 104857600, // 100 MB en bytes
        allowedMimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-powerpoint',
        ],
      });
      if (createErr) {
        return NextResponse.json(
          { error: `No se pudo crear el bucket "${BUCKET}": ${createErr.message}` },
          { status: 500 }
        );
      }
    }

    // 2. Generar URL firmada de subida
    const path = `cap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
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
