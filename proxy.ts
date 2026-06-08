import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Next.js 16: el antiguo "middleware" ahora se llama "proxy" (runtime nodejs).
// Protege todas las rutas: sin sesión válida → login (páginas) o 401 (APIs).

const RUTAS_PUBLICAS = ['/login', '/forgot-password', '/update-password', '/auth', '/api/webhooks', '/api/indicadores']

function esRutaPublica(path: string): boolean {
  return RUTAS_PUBLICAS.some((r) => path === r || path.startsWith(r + '/'))
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() revalida el token con Supabase (más seguro que getSession)
  const { data: { user } } = await supabase.auth.getUser()

  // Rutas públicas → pasar siempre
  if (esRutaPublica(path)) {
    return response
  }

  // Sin sesión válida
  if (!user) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado. Inicia sesión.' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Corre en todo EXCEPTO assets estáticos
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)$).*)',
  ],
}
