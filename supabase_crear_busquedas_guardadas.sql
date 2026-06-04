-- =============================================
-- CREAR TABLA busquedas_guardadas (desde cero)
-- Correr en: Supabase → SQL Editor → New Query
-- =============================================

CREATE TABLE IF NOT EXISTS public.busquedas_guardadas (
  -- Identificador único
  id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Nombre del proyecto / búsqueda (extraído del Excel o escrito por el usuario)
  nombre           VARCHAR(200)  NOT NULL,
  nombre_archivo   VARCHAR(255)  DEFAULT '',
  id_proyecto      VARCHAR(100)  DEFAULT '',

  -- Datos guardados de la sesión de búsqueda (JSON)
  items_excel      JSONB         DEFAULT '[]'::jsonb,   -- ProductoExcel[]
  items_lista      JSONB         DEFAULT '[]'::jsonb,   -- ItemLista[] con resultados
  seleccion        JSONB         DEFAULT '{}'::jsonb,   -- selección manual por ítem

  -- Métricas de resumen (para mostrar en la lista sin deserializar todo el JSON)
  total_productos  INTEGER       DEFAULT 0,
  con_resultados   INTEGER       DEFAULT 0,
  avg_match        INTEGER       DEFAULT 0,

  -- Usuario que guardó la búsqueda (FK a auth.users)
  user_id          UUID          REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email       TEXT          DEFAULT '',
  user_nombre      TEXT          DEFAULT '',

  -- Auditoría
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- ─── Índices ──────────────────────────────────────────────────────────────────

-- Listado por usuario (la consulta más frecuente)
CREATE INDEX IF NOT EXISTS idx_bg_user_created
  ON public.busquedas_guardadas (user_id, created_at DESC);

-- Búsqueda por id_proyecto
CREATE INDEX IF NOT EXISTS idx_bg_id_proyecto
  ON public.busquedas_guardadas (id_proyecto)
  WHERE id_proyecto <> '';

-- Fecha general (para la vista de admin que trae todo)
CREATE INDEX IF NOT EXISTS idx_bg_created
  ON public.busquedas_guardadas (created_at DESC);

-- ─── Trigger: updated_at automático ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_busquedas_guardadas_updated
  BEFORE UPDATE ON public.busquedas_guardadas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS (Row Level Security) ────────────────────────────────────────────────
-- Las rutas API usan supabaseAdmin (service_role) que bypassa RLS.
-- El filtrado por user_id se hace en código (lib/authServer.ts).
-- Habilitamos RLS igualmente como capa de seguridad extra para accesos directos.

ALTER TABLE public.busquedas_guardadas ENABLE ROW LEVEL SECURITY;

-- La service_role key (usada por supabaseAdmin en las rutas API) bypassa RLS automáticamente.
-- Esta política solo aplica a conexiones con la anon key o tokens de usuario:

-- Usuarios normales: solo ven y modifican sus propias búsquedas
CREATE POLICY "usuario_ve_las_suyas"
  ON public.busquedas_guardadas
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "usuario_inserta_las_suyas"
  ON public.busquedas_guardadas
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usuario_elimina_las_suyas"
  ON public.busquedas_guardadas
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admin y superuser: acceso total
CREATE POLICY "admin_acceso_total"
  ON public.busquedas_guardadas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'superuser')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'superuser')
    )
  );
