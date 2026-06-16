// app/api/licitapyme/[...proxy]/route.ts
// Proxy hacia licitapyme-clone corriendo en Docker (localhost:3001).
// Todos los requests de la intranet pasan por aquí — nunca exponemos
// el microservicio directamente al cliente.
import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.LICITAPYME_URL || "http://localhost:3003";

type Ctx = { params: Promise<{ proxy: string[] }> };

async function handler(req: NextRequest, ctx: Ctx) {
  const { proxy } = await ctx.params;
  const path = proxy.join("/");
  const search = req.nextUrl.search;
  const target = `${BASE}/${path}${search}`;

  const headers = new Headers();
  // Reenvía Content-Type si hay body
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  // Clave interna para que licitapyme-clone identifique al proxy
  const internalKey = process.env.LICITAPYME_INTERNAL_KEY;
  if (internalKey) headers.set("x-internal-key", internalKey);

  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer();

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body ?? undefined,
      cache: "no-store",
    });

    const respHeaders = new Headers();
    const passThroughHeaders = ["content-type", "cache-control", "x-request-id"];
    passThroughHeaders.forEach(h => {
      const v = upstream.headers.get(h);
      if (v) respHeaders.set(h, v);
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "licitapyme-clone no disponible", detail: err?.message },
      { status: 503 }
    );
  }
}

export const GET     = handler;
export const POST    = handler;
export const PUT     = handler;
export const PATCH   = handler;
export const DELETE  = handler;
