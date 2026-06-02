// app/api/bases-upload-url/route.ts
// Crea (si no existe) el bucket de bases y devuelve una URL firmada de subida.
// El navegador sube el PDF directo a Supabase Storage (evita el límite de 4.5MB de Vercel).
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET = 'bases-licitaciones';

export async function POST() {
  try {
    // Asegurar bucket (privado). Si ya existe, ignora el error.
    await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: '50MB',
      allowedMimeTypes: ['application/pdf'],
    }).catch(() => {});

    const path = `bases_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: `No se pudo crear URL de subida: ${error?.message}` }, { status: 500 });
    }
    return NextResponse.json({ bucket: BUCKET, path, token: data.token, signedUrl: data.signedUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
