/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BACKEND = process.env.PYTHON_BACKEND_URL || 'http://localhost:5000'

async function proxy(req: NextRequest, segments: string[]) {
  const url = `${BACKEND}/python/${segments.join('/')}${req.nextUrl.search}`

  try {
    const ct = req.headers.get('content-type') || ''
    const isMultipart = ct.includes('multipart/form-data')

    const init: RequestInit = {
      method: req.method,
      headers: {
        'Accept': req.headers.get('accept') || '*/*',
        ...(!isMultipart && ct ? { 'Content-Type': ct } : {}),
      },
      ...(req.method !== 'GET' && req.method !== 'HEAD'
        ? { body: isMultipart ? await req.blob() : await req.text() }
        : {}),
    }

    const res = await fetch(url, init)
    const resCt = res.headers.get('content-type') || ''

    if (resCt.includes('openxml') || resCt.includes('octet-stream')) {
      return new NextResponse(await res.arrayBuffer(), {
        status: res.status,
        headers: {
          'Content-Type': resCt,
          'Content-Disposition': res.headers.get('content-disposition') || 'attachment',
        },
      })
    }

    return new NextResponse(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': resCt || 'application/json' },
    })

  } catch (err: any) {
    console.error(`[Proxy] ${url} →`, err.message)
    return NextResponse.json(
      { error: 'Servidor local no disponible. Enciende el notebook servidor y ejecuta iniciar.bat' },
      { status: 503 }
    )
  }
}

export function GET(req: NextRequest, ctx: any) {
  return proxy(req, ctx.params.path)
}

export function POST(req: NextRequest, ctx: any) {
  return proxy(req, ctx.params.path)
}
