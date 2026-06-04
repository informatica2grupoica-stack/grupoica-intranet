-- =============================================
-- MIGRACIÓN v2: Búsquedas por perfil de usuario
-- Correr DESPUÉS de supabase_migration_busquedas.sql
-- =============================================

-- 1) Agregar columnas de usuario a la tabla existente
ALTER TABLE public.busquedas_guardadas
  ADD COLUMN IF NOT EXISTS user_id    UUID    REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_email TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_nombre TEXT   DEFAULT '';

-- 2) Índice para búsqueda por usuario (el más frecuente)
CREATE INDEX IF NOT EXISTS idx_busquedas_guardadas_user_id
  ON public.busquedas_guardadas (user_id, created_at DESC);

-- Política anterior era permisiva (service_role). Las rutas API usan
-- supabaseAdmin (service_role key) que ya bypassa RLS.
-- Dejamos RLS habilitado y la política del service_role intacta.
-- El filtrado por user_id se hace en código dentro de las rutas API.

-- Si quieres RLS también para accesos directos desde el cliente (seguridad extra):
-- DROP POLICY IF EXISTS "service_role_full_access" ON public.busquedas_guardadas;
--
-- CREATE POLICY "users_see_own" ON public.busquedas_guardadas
--   FOR SELECT USING (
--     auth.uid() = user_id
--     OR EXISTS (
--       SELECT 1 FROM public.perfiles
--       WHERE user_id = auth.uid() AND rol IN ('admin','superuser')
--     )
--   );
--
-- CREATE POLICY "users_insert_own" ON public.busquedas_guardadas
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "users_delete_own" ON public.busquedas_guardadas
--   FOR DELETE USING (
--     auth.uid() = user_id
--     OR EXISTS (
--       SELECT 1 FROM public.perfiles
--       WHERE user_id = auth.uid() AND rol IN ('admin','superuser')
--     )
--   );
