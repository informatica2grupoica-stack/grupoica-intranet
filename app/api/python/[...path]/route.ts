import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BACKEND = process.env.PYTHON_BACKEND_URL || 'http://localhost:5000'

async function proxy(req: NextRequest, params: { path: string[] }) {
  const path = params.path.join('/')
  const search = req.nextUrl.search
  const url = `${BACKEND}/python/${path}${search}`

  try {
    const isMultipart = req.headers.get('content-type')?.includes('multipart/form-data')

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Accept': req.headers.get('accept') || '*/*',
        ...(isMultipart ? {} : { 'Content-Type': req.headers.get('content-type') || 'application/json' }),
      },
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = isMultipart ? await req.blob() : await req.text()
    }

    const res = await fetch(url, fetchOptions)

    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/vnd.openxml') || contentType.includes('octet-stream')) {
      const buffer = await res.arrayBuffer()
      return new NextResponse(buffer, {
        status: res.status,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': res.headers.get('content-disposition') || 'attachment',
        },
      })
    }

    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': contentType || 'application/json' },
    })

  } catch (err: any) {
    console.error(`[Proxy] Error → ${url}:`, err.message)
    return NextResponse.json(
      { error: 'Servidor local no disponible. Verifica que el notebook servidor esté encendido y con iniciar.bat ejecutado.' },
      { status: 503 }
    )
  }
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params)
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params)
}
