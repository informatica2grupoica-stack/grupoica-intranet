import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSectionKeyForPath, puedeVerSeccion } from '@/lib/sections'

// Next.js 16: el antiguo "middleware" ahora se llama "proxy" (runtime nodejs).
// 1) Autenticación: sin sesión válida → login (páginas) o 401 (APIs).
// 2) Autorización centralizada: rutas sensibles exigen rol/permiso del perfil.

const RUTAS_PUBLICAS = ['/login', '/forgot-password', '/update-password', '/auth', '/api/webhooks', '/api/indicadores']

function esRutaPublica(path: string): boolean {
  return RUTAS_PUBLICAS.some((r) => path === r || path.startsWith(r + '/'))
}

interface PerfilProxy {
  rol: string
  permisos: { can_view_rrhh?: boolean; can_manage_rrhh?: boolean; secciones?: Record<string, boolean> } | null
}

// ── Reglas de autorización por prefijo de API ────────────────────────────────
// roles: roles que pasan además de admin/superuser.
// seccion: además pasa quien tenga esa sección habilitada en permisos.secciones
//          (mismo criterio que el sidebar — no rompe accesos configurados).
const REGLAS_API: Array<{ test: (p: string) => boolean; roles?: string[]; seccion?: string; permiso?: (perfil: PerfilProxy) => boolean }> = [
  { test: p => p.startsWith('/api/chatbot/acciones'), roles: [] }, // solo admin/superuser
  { test: p => p.startsWith('/api/rrhh'), roles: ['rrhh'], permiso: pf => !!(pf.permisos?.can_view_rrhh || pf.permisos?.can_manage_rrhh) },
  { test: p => p.startsWith('/api/obuma/contabilidad'), seccion: 'contabilidad' },
  { test: p => p.startsWith('/api/obuma/compras') || p.startsWith('/api/obuma/oc'), seccion: 'compras' },
  { test: p => p.startsWith('/api/obuma/ventas'), seccion: 'ventas' },
  { test: p => p.startsWith('/api/obuma/clientes') || p.startsWith('/api/obuma/crm'), seccion: 'obuma-clientes' },
  { test: p => p.startsWith('/api/obuma/proveedores'), seccion: 'obuma-proveedores' },
]

// Páginas de administración con regla dura adicional al criterio de secciones
const PAGINAS_ADMIN = ['/usuarios']
const ROLES_PAGINAS_ADMIN = ['rrhh']

function autorizado(perfil: PerfilProxy, regla: { roles?: string[]; seccion?: string; permiso?: (p: PerfilProxy) => boolean }): boolean {
  if (perfil.rol === 'admin' || perfil.rol === 'superuser') return true
  if (regla.roles?.includes(perfil.rol)) return true
  if (regla.permiso?.(perfil)) return true
  if (regla.seccion) return puedeVerSeccion(perfil.permisos?.secciones, regla.seccion)
  return false
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

  // ── Autorización: solo consulta el perfil si la ruta tiene regla ────────────
  const reglaApi = path.startsWith('/api/') ? REGLAS_API.find(r => r.test(path)) : undefined
  const esPaginaAdmin = PAGINAS_ADMIN.some(p => path === p || path.startsWith(p + '/'))
  const seccionPagina = !path.startsWith('/api/') ? getSectionKeyForPath(path) : null

  if (reglaApi || esPaginaAdmin || seccionPagina) {
    const { data } = await supabaseAdmin
      .from('perfiles')
      .select('rol, permisos')
      .eq('user_id', user.id)
      .single()
    const perfil: PerfilProxy = { rol: data?.rol ?? 'user', permisos: data?.permisos ?? null }

    if (reglaApi && !autorizado(perfil, reglaApi)) {
      return NextResponse.json({ error: 'Permiso denegado.' }, { status: 403 })
    }

    if (esPaginaAdmin && !autorizado(perfil, { roles: ROLES_PAGINAS_ADMIN })) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    // Páginas del dashboard: mismo criterio de secciones que el sidebar
    if (seccionPagina && !esPaginaAdmin && !autorizado(perfil, { seccion: seccionPagina })) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    // Corre en todo EXCEPTO assets estáticos
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)$).*)',
  ],
}
