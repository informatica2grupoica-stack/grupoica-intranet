-- supabase_rls_perfiles.sql
-- Bloquea la escalación de privilegios desde el navegador.
-- Hoy la página de Usuarios escribe en "perfiles" (incluido el campo rol) con la
-- anon key desde el cliente: sin RLS, CUALQUIER usuario autenticado puede
-- cambiarse su propio rol a admin con un fetch desde la consola.
-- Ejecutar en el SQL Editor de Supabase.

-- Helper SECURITY DEFINER para evitar recursión de RLS sobre la propia tabla
create or replace function public.es_admin_o_super()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfiles
    where user_id = auth.uid() and rol in ('admin', 'superuser')
  );
$$;

alter table public.perfiles enable row level security;

-- Limpieza por si se re-ejecuta
drop policy if exists "perfiles_select_autenticados" on public.perfiles;
drop policy if exists "perfiles_insert_admin" on public.perfiles;
drop policy if exists "perfiles_update_admin" on public.perfiles;
drop policy if exists "perfiles_update_propio_sin_privilegios" on public.perfiles;
drop policy if exists "perfiles_delete_admin" on public.perfiles;

-- Lectura: cualquier usuario autenticado (el layout, chat y tareas listan usuarios)
create policy "perfiles_select_autenticados"
  on public.perfiles for select
  to authenticated
  using (true);

-- Insertar/eliminar perfiles: solo admin/superuser
create policy "perfiles_insert_admin"
  on public.perfiles for insert
  to authenticated
  with check (public.es_admin_o_super());

create policy "perfiles_delete_admin"
  on public.perfiles for delete
  to authenticated
  using (public.es_admin_o_super());

-- Actualizar: admin/superuser puede todo
create policy "perfiles_update_admin"
  on public.perfiles for update
  to authenticated
  using (public.es_admin_o_super())
  with check (public.es_admin_o_super());

-- Un usuario normal solo puede editar SU fila y SIN tocar rol/activo/permisos
-- (la comparación con la fila vieja se hace vía trigger, ver abajo)
create policy "perfiles_update_propio_sin_privilegios"
  on public.perfiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Trigger que impide a un no-admin modificar sus campos de privilegio
create or replace function public.proteger_campos_privilegio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_o_super() then
    if new.rol is distinct from old.rol
       or new.activo is distinct from old.activo
       or new.permisos is distinct from old.permisos then
      raise exception 'No tienes permiso para modificar rol/activo/permisos';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_privilegios on public.perfiles;
create trigger trg_proteger_privilegios
  before update on public.perfiles
  for each row execute function public.proteger_campos_privilegio();
