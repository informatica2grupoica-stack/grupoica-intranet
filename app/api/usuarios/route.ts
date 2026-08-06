// app/api/usuarios/route.ts
// Gestión de usuarios en el SERVIDOR con la service role.
//
// Por qué existe: antes la página /usuarios creaba la cuenta desde el navegador
// con supabase.auth.signUp(). Eso rompía de dos formas:
//   1. signUp reemplaza la sesión del admin por la del usuario recién creado, así
//      que el INSERT posterior en "perfiles" corría como el usuario nuevo (no admin)
//      y la política RLS "perfiles_insert_admin" lo rechazaba.
//   2. Dependía del correo de confirmación de Supabase, que con el SMTP por
//      defecto no llega a direcciones fuera del equipo del proyecto.
// Aquí usamos auth.admin.createUser con email_confirm: true — cuenta activa al
// instante, sin correo de por medio, y la sesión del admin nunca se toca.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRol } from '@/lib/authServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// requireRol([]) => solo admin/superuser: el helper deja pasar siempre a ambos
// y la lista vacía no añade ningún otro rol.

const CAMPOS_PERFIL = [
  'nombre', 'apellido', 'rut', 'fecha_nacimiento', 'telefono', 'direccion',
  'comuna', 'ciudad', 'region', 'cargo', 'rol', 'permisos',
] as const;

const ROLES_VALIDOS = ['superuser', 'admin', 'user', 'rrhh', 'jefe', 'vendedor'];

function soloCamposPerfil(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of CAMPOS_PERFIL) {
    if (body[k] !== undefined) out[k] = body[k] === '' ? null : body[k];
  }
  return out;
}

/** Recorre auth.users completo (paginado) y devuelve un mapa email → usuario. */
async function listarAuthUsers() {
  const porEmail = new Map<string, { id: string; email: string; confirmado: boolean }>();
  const porId = new Map<string, { id: string; email: string; confirmado: boolean }>();

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      const item = {
        id: u.id,
        email: (u.email || '').toLowerCase(),
        confirmado: !!u.email_confirmed_at,
      };
      if (item.email) porEmail.set(item.email, item);
      porId.set(item.id, item);
    }
    if (data.users.length < 1000) break;
  }
  return { porEmail, porId };
}

// ─── GET: diagnóstico de correos/cuentas ─────────────────────────────────────
// Cruza la tabla "perfiles" con auth.users para detectar por qué a alguien no le
// llega el correo de recuperación: casi siempre es que el perfil existe pero la
// cuenta de auth no, o que el email de la tabla no coincide con el de auth.
export async function GET() {
  const auth = await requireRol([]);
  if (auth.error) return auth.error;

  try {
    const { data: perfiles, error } = await supabaseAdmin
      .from('perfiles')
      .select('id, user_id, email, nombre, apellido, rol, activo')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const { porEmail, porId } = await listarAuthUsers();

    const filas = (perfiles ?? []).map((p) => {
      const emailPerfil = (p.email || '').toLowerCase().trim();
      const porUserId = p.user_id ? porId.get(p.user_id) : undefined;
      const porCorreo = emailPerfil ? porEmail.get(emailPerfil) : undefined;
      const cuenta = porUserId ?? porCorreo;

      let estado: string;
      if (!cuenta) estado = 'SIN_CUENTA_AUTH';
      else if (!p.user_id) estado = 'USER_ID_VACIO';
      else if (!porUserId) estado = 'USER_ID_NO_EXISTE';
      else if (porUserId.email !== emailPerfil) estado = 'EMAIL_DESALINEADO';
      else if (!porUserId.confirmado) estado = 'EMAIL_SIN_CONFIRMAR';
      else estado = 'OK';

      return {
        id: p.id,
        nombre: `${p.nombre ?? ''} ${p.apellido ?? ''}`.trim(),
        rol: p.rol,
        activo: p.activo,
        email_perfil: emailPerfil || null,
        email_auth: cuenta?.email ?? null,
        confirmado: cuenta?.confirmado ?? false,
        estado,
      };
    });

    // Cuentas de auth que no tienen perfil (entran a la app sin permisos)
    const userIdsConPerfil = new Set((perfiles ?? []).map((p) => p.user_id).filter(Boolean));
    const authSinPerfil = [...porId.values()]
      .filter((u) => !userIdsConPerfil.has(u.id))
      .map((u) => ({ user_id: u.id, email: u.email, confirmado: u.confirmado }));

    return NextResponse.json({
      total_perfiles: filas.length,
      total_auth: porId.size,
      con_problemas: filas.filter((f) => f.estado !== 'OK').length,
      perfiles: filas,
      auth_sin_perfil: authSinPerfil,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── POST: crear usuario (cuenta auth + perfil) ──────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireRol([]);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const email = String(body.email ?? '').toLowerCase().trim();
  const password = String(body.password ?? '');
  const rol = String(body.rol ?? 'user');

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Correo inválido.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return NextResponse.json({ error: `Rol no válido: ${rol}` }, { status: 400 });
  }
  if (rol === 'superuser' && auth.user.rol !== 'superuser') {
    return NextResponse.json({ error: 'Solo un superusuario puede crear otro superusuario.' }, { status: 403 });
  }

  // ¿Ya existe la cuenta en auth? (p. ej. un intento anterior que dejó basura)
  const { porEmail } = await listarAuthUsers();
  const existente = porEmail.get(email);

  let userId: string;
  let reutilizada = false;

  if (existente) {
    const { data: perfilPrevio } = await supabaseAdmin
      .from('perfiles').select('id').eq('user_id', existente.id).maybeSingle();
    if (perfilPrevio) {
      return NextResponse.json({ error: 'Ya existe un usuario con ese correo.' }, { status: 409 });
    }
    // Cuenta huérfana: la reaprovechamos y le fijamos la contraseña indicada
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existente.id, {
      password,
      email_confirm: true,
    });
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
    userId = existente.id;
    reutilizada = true;
  } else {
    const { data: creado, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // cuenta activa sin depender del correo de confirmación
    });
    if (authErr || !creado?.user) {
      return NextResponse.json({ error: authErr?.message ?? 'No se pudo crear la cuenta.' }, { status: 400 });
    }
    userId = creado.user.id;
  }

  const { data: perfil, error: pErr } = await supabaseAdmin
    .from('perfiles')
    .insert([{
      ...soloCamposPerfil(body),
      user_id: userId,
      email,
      activo: true,
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (pErr) {
    // Rollback: no dejar cuentas de auth sin perfil (esas son las que luego
    // "no reciben el correo de recuperación" porque nadie sabe que existen).
    if (!reutilizada) await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: `Cuenta creada pero falló el perfil: ${pErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, perfil, reutilizada });
}

// ─── PATCH: actualizar perfil (y opcionalmente correo/contraseña) ────────────
export async function PATCH(req: NextRequest) {
  const auth = await requireRol([]);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const id = String(body.id ?? '');
  if (!id) return NextResponse.json({ error: 'Falta el id del perfil.' }, { status: 400 });

  const { data: actual, error: findErr } = await supabaseAdmin
    .from('perfiles').select('id, user_id, rol, email').eq('id', id).single();
  if (findErr || !actual) {
    return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 404 });
  }
  if (actual.rol === 'superuser' && auth.user.rol !== 'superuser') {
    return NextResponse.json({ error: 'No puedes modificar al superusuario.' }, { status: 403 });
  }

  const cambios = soloCamposPerfil(body);
  if (cambios.rol && !ROLES_VALIDOS.includes(String(cambios.rol))) {
    return NextResponse.json({ error: `Rol no válido: ${cambios.rol}` }, { status: 400 });
  }
  if (cambios.rol === 'superuser' && auth.user.rol !== 'superuser') {
    return NextResponse.json({ error: 'Solo un superusuario puede asignar ese rol.' }, { status: 403 });
  }
  if (body.activo !== undefined) cambios.activo = !!body.activo;

  const nuevoEmail = body.email ? String(body.email).toLowerCase().trim() : null;
  const nuevaPassword = body.password ? String(body.password) : null;

  if (nuevaPassword && nuevaPassword.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
  }

  // ¿La cuenta de auth de este perfil realmente existe? (perfiles "huérfanos"
  // que quedaron sin cuenta son la causa típica de "nunca me llega el correo").
  let cuentaValida = false;
  if (actual.user_id) {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(actual.user_id);
    cuentaValida = !!u?.user;
  }

  if (!cuentaValida && (nuevaPassword || nuevoEmail)) {
    // Reparar: crear la cuenta de auth que le falta a este perfil.
    const emailParaCuenta = nuevoEmail || actual.email;
    if (!emailParaCuenta) {
      return NextResponse.json({ error: 'Falta el correo para crear la cuenta de acceso.' }, { status: 400 });
    }
    if (!nuevaPassword) {
      return NextResponse.json({ error: 'Este perfil no tiene cuenta de acceso: define una contraseña para crearla.' }, { status: 400 });
    }
    const { data: creado, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: emailParaCuenta,
      password: nuevaPassword,
      email_confirm: true,
    });
    if (authErr || !creado?.user) {
      return NextResponse.json({ error: authErr?.message ?? 'No se pudo crear la cuenta.' }, { status: 400 });
    }
    cambios.user_id = creado.user.id;
    cambios.email = emailParaCuenta;
  } else if (cuentaValida && actual.user_id && (nuevaPassword || (nuevoEmail && nuevoEmail !== actual.email))) {
    // Cambios en auth.users — sin esto el perfil y la cuenta se desincronizan y
    // el usuario deja de poder entrar o recuperar su clave.
    const attrs: { password?: string; email?: string; email_confirm?: boolean } = {};
    if (nuevaPassword) attrs.password = nuevaPassword;
    if (nuevoEmail && nuevoEmail !== actual.email) {
      attrs.email = nuevoEmail;
      attrs.email_confirm = true;
    }
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(actual.user_id, attrs);
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });
    if (nuevoEmail) cambios.email = nuevoEmail;
  }

  const { data: perfil, error } = await supabaseAdmin
    .from('perfiles')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, perfil });
}

// ─── DELETE: eliminar perfil + cuenta auth ───────────────────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await requireRol([]);
  if (auth.error) return auth.error;

  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Falta el id del perfil.' }, { status: 400 });

  const { data: perfil, error: findErr } = await supabaseAdmin
    .from('perfiles').select('id, user_id, rol').eq('id', id).single();
  if (findErr || !perfil) {
    return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 404 });
  }
  if (perfil.rol === 'superuser') {
    return NextResponse.json({ error: 'El superusuario no se puede eliminar.' }, { status: 403 });
  }
  if (perfil.user_id === auth.user.id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('perfiles').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // La cuenta de auth se borra después: si quedara viva sin perfil, la persona
  // seguiría pudiendo autenticarse.
  if (perfil.user_id) await supabaseAdmin.auth.admin.deleteUser(perfil.user_id);

  return NextResponse.json({ ok: true });
}
