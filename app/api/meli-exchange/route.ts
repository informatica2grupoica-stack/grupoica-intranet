// app/api/meli-exchange/route.ts
// Intercambia el authorization_code de ML por access_token + refresh_token
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CLIENT_ID     = process.env.MELI_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.MELI_CLIENT_SECRET || '';
const REDIRECT_URI  = process.env.MELI_REDIRECT_URI  || 'https://grupoica-intranet.vercel.app/callback';

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: 'Falta code' }, { status: 400 });

  const r = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      client_id:    CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const body = await r.json();
  if (!r.ok) {
    console.error('[meli-exchange] error:', r.status, body);
    return NextResponse.json({ error: body.error_description || body.message || `Error ${r.status}` }, { status: 400 });
  }

  console.log('[meli-exchange] tokens obtenidos para user_id:', body.user_id);
  return NextResponse.json({
    access_token:  body.access_token,
    refresh_token: body.refresh_token,
    expires_in:    body.expires_in,
    user_id:       body.user_id,
  });
}
