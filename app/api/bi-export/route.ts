// app/api/bi-export/route.ts
// Proxy server-side hacia el endpoint BI de LiciTaLab — mantiene la x-api-key
// fuera del cliente. Consumido por la vista de prueba en /bi-export.
import { NextResponse } from "next/server";

const BI_API_URL = "https://biapi.licitalab.cl/bi/opportunities";

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
      cache: "no-store",
    });

    const text = await res.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = text; }

    if (!res.ok) {
      const mensaje = typeof body === "string" ? body : body?.message || body?.error || `Error ${res.status}`;
      return NextResponse.json({ error: mensaje, status: res.status }, { status: res.status });
    }

    const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];

    return NextResponse.json({
      rows,
      count: rows.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "No se pudo conectar con la API de BI." },
      { status: 502 }
    );
  }
}
