// app/api/gemini-test/route.ts — diagnóstico de la key y modelos disponibles
import { NextResponse } from 'next/server';

const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro'];
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function GET() {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });

  const results: Record<string, any> = { key_prefix: key.slice(0, 8) + '...', models: {} };

  for (const model of MODELS) {
    try {
      const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Di solo: OK' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      if (res.ok) {
        const data = JSON.parse(text);
        results.models[model] = { status: res.status, ok: true, reply: data.candidates?.[0]?.content?.parts?.[0]?.text };
      } else {
        results.models[model] = { status: res.status, ok: false, error: text.slice(0, 200) };
      }
    } catch (e: any) {
      results.models[model] = { ok: false, error: e.message };
    }
  }

  return NextResponse.json(results);
}
