// app/api/viabilidad-upload-url/route.ts
// Crea (si no existe) el bucket de documentos de viabilidad y devuelve una URL firmada de subida.
// El navegador sube cada documento directo a Supabase Storage (evita el límite de 4.5MB de Vercel).
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET = 'viabilidad-docs';

const EXT_POR_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const mimeType: string = body.mimeType || 'application/pdf';
    if (!Object.keys(EXT_POR_MIME).includes(mimeType)) {
      return NextResponse.json({ error: `Tipo de archivo no permitido: ${mimeType}` }, { status: 400 });
    }

    // Asegurar bucket (privado). Si ya existe, ignora el error.
    await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: '50MB',
      allowedMimeTypes: Object.keys(EXT_POR_MIME),
    }).catch(() => {});

    const ext = EXT_POR_MIME[mimeType];
    const path = `viab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: `No se pudo crear URL de subida: ${error?.message}` }, { status: 500 });
    }
    return NextResponse.json({ bucket: BUCKET, path, token: data.token, signedUrl: data.signedUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
