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

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Proxy] ${url} →`, msg)
    return NextResponse.json(
      { error: 'Servidor local no disponible. Enciende el notebook servidor y ejecuta iniciar.bat' },
      { status: 503 }
    )
  }
}

// Next.js 15+ requiere que params sea awaited
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params
  return proxy(req, path ?? [])
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params
  return proxy(req, path ?? [])
}
