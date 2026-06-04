-- =============================================
-- MIGRACIÓN: Tabla busquedas_guardadas
-- Correr en: Supabase → SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS public.busquedas_guardadas (
  id            UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre        VARCHAR(200)    NOT NULL,
  nombre_archivo VARCHAR(255)   DEFAULT '',
  id_proyecto   VARCHAR(100)    DEFAULT '',
  items_excel   JSONB           DEFAULT '[]'::jsonb,
  items_lista   JSONB           DEFAULT '[]'::jsonb,
  seleccion     JSONB           DEFAULT '{}'::jsonb,
  total_productos INTEGER        DEFAULT 0,
  con_resultados  INTEGER        DEFAULT 0,
  avg_match       INTEGER        DEFAULT 0,
  created_at    TIMESTAMPTZ     DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     DEFAULT NOW()
);

-- Índice por fecha para paginación rápida
CREATE INDEX IF NOT EXISTS idx_busquedas_guardadas_created
  ON public.busquedas_guardadas (created_at DESC);

-- Índice por id_proyecto para búsqueda por proyecto
CREATE INDEX IF NOT EXISTS idx_busquedas_guardadas_proyecto
  ON public.busquedas_guardadas (id_proyecto)
  WHERE id_proyecto <> '';

-- Trigger para actualizar updated_at automáticamente
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

-- RLS: habilitado — cualquier usuario autenticado puede leer/escribir sus búsquedas.
-- Ajustar según necesidades de seguridad del proyecto.
ALTER TABLE public.busquedas_guardadas ENABLE ROW LEVEL SECURITY;

-- Política permisiva para service_role (las rutas API usan supabaseAdmin)
CREATE POLICY "service_role_full_access"
  ON public.busquedas_guardadas
  FOR ALL
  USING (true)
  WITH CHECK (true);
