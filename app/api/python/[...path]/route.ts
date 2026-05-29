import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BACKEND = process.env.PYTHON_BACKEND_URL || 'http://localhost:5000'

async function proxy(req: NextRequest, path: string[]) {
  const pathStr = path.join('/')
  const search = req.nextUrl.search
  const url = `${BACKEND}/python/${pathStr}${search}`

  try {
    const contentType = req.headers.get('content-type') || ''
    const isMultipart = contentType.includes('multipart/form-data')

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Accept': req.headers.get('accept') || '*/*',
        ...(!isMultipart && { 'Content-Type': contentType || 'application/json' }),
      },
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = isMultipart ? await req.blob() : await req.text()
    }

    const res = await fetch(url, fetchOptions)
    const resContentType = res.headers.get('content-type') || ''

    if (resContentType.includes('openxml') || resContentType.includes('octet-stream')) {
      const buffer = await res.arrayBuffer()
      return new NextResponse(buffer, {
        status: res.status,
        headers: {
          'Content-Type': resContentType,
          'Content-Disposition': res.headers.get('content-disposition') || 'attachment',
        },
      })
    }

    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': resContentType || 'application/json' },
    })

  } catch (err: any) {
    console.error(`[Proxy] Error → ${url}:`, err.message)
    return NextResponse.json(
      { error: 'Servidor local no disponible. Verifica que el notebook servidor esté encendido y con iniciar.bat ejecutado.' },
      { status: 503 }
    )
  }
}

type Params = Promise<{ path: string[] }>

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { path } = await params
  return proxy(req, path)
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { path } = await params
  return proxy(req, path)
}
