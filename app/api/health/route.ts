// app/api/health/route.ts — endpoint liviano para keep-alive (evita el sleep de Render free)
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', time: new Date().toISOString() });
}
