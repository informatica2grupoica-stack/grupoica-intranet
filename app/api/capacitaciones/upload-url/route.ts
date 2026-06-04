// app/api/capacitaciones/upload-url/route.ts
// Genera URL firmada para subir PDF o PPTX directo a Supabase Storage.
// Solo accesible por admin/superuser (verificado en el cliente, pero el bucket es privado).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET = 'capacitaciones-archivos';
const ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
];

export async function POST(request: NextRequest) {
  try {
    const { tipo_archivo } = await request.json();
    const ext = tipo_archivo === 'pptx' ? 'pptx' : 'pdf';
    const mime = ext === 'pptx'
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      : 'application/pdf';

    // Crear bucket si no existe
    await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: '100MB',
      allowedMimeTypes: ALLOWED_MIME,
    }).catch(() => {});

    const path = `cap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);

    if (error || !data) {
      return NextResponse.json(
        { error: `No se pudo crear URL de subida: ${error?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bucket: BUCKET,
      path,
      tipo_archivo: ext,
      token: data.token,
      signedUrl: data.signedUrl,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
