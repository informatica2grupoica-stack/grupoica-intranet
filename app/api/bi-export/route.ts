// app/api/bi-export/route.ts
// Proxy server-side hacia el endpoint BI de LiciTaLab.
// Cachea 20 minutos en el edge para no golpear la API externa en cada render.
import { NextResponse } from "next/server";

const BI_API_URL = "https://biapi.licitalab.cl/bi/opportunities";
const CACHE_TTL  = 1200; // 20 min en segundos

export async function GET() {
  const apiKey = process.env.X_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta configurar X_API_KEY en las variables de entorno del servidor." },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(BI_API_URL, {
      headers: { "x-api-key": apiKey },
      next: { revalidate: CACHE_TTL }, // ISR-style cache en el runtime de Next.js
    });

    const text = await res.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = text; }

    if (!res.ok) {
      const mensaje = typeof body === "string" ? body : body?.message || body?.error || `Error ${res.status}`;
      return NextResponse.json({ error: mensaje, status: res.status }, { status: res.status });
    }

    const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];

    const response = NextResponse.json({
      rows,
      count: rows.length,
      fetchedAt: new Date().toISOString(),
    });

    // Cache-Control para el cliente: 5 min fresh, luego stale-while-revalidate 15 min
    response.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
    return response;

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "No se pudo conectar con la API de BI." },
      { status: 502 }
    );
  }
}
