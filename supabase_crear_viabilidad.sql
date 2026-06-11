-- =============================================
-- CREAR TABLA viabilidad_analisis (desde cero)
-- Correr en: Supabase → SQL Editor → New Query
-- =============================================

CREATE TABLE IF NOT EXISTS public.viabilidad_analisis (
  -- Identificador único
  id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identificación del proceso/licitación
  nombre                VARCHAR(200)  NOT NULL,
  id_proceso            VARCHAR(100)  DEFAULT '',
  cliente               VARCHAR(255)  DEFAULT '',
  proyecto_viable       VARCHAR(10)   DEFAULT '',   -- "SI" | "NO" | ""

  -- Resultado del análisis de Gemini (campos de la pestaña "Analisis")
  analisis              JSONB         DEFAULT '{}'::jsonb,

  -- Ítems detectados en los documentos (cruzados con el Excel COSTEO)
  items                 JSONB         DEFAULT '[]'::jsonb,

  -- Ítems del Excel COSTEO (ProductoExcel[]) — para reenviar al buscador de productos
  items_excel           JSONB         DEFAULT '[]'::jsonb,

  -- Documentos subidos (nombre, bucket, path, mimeType)
  archivos              JSONB         DEFAULT '[]'::jsonb,

  -- Excel original codificado en base64 (permite reconstruir el File al restaurar)
  excel_base64          TEXT          DEFAULT NULL,
  cols_excel            JSONB         DEFAULT NULL,
  sheet_name            TEXT          DEFAULT 'COSTEO',

  -- Usuario que generó el análisis (FK a auth.users)
  user_id               UUID          REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email            TEXT          DEFAULT '',
  user_nombre           TEXT          DEFAULT '',

  -- Auditoría
  created_at            TIMESTAMPTZ   DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   DEFAULT NOW()
);

-- ─── Índices ──────────────────────────────────────────────────────────────────

-- Listado por usuario (la consulta más frecuente)
CREATE INDEX IF NOT EXISTS idx_viab_user_created
  ON public.viabilidad_analisis (user_id, created_at DESC);

-- Búsqueda por id_proceso
CREATE INDEX IF NOT EXISTS idx_viab_id_proceso
  ON public.viabilidad_analisis (id_proceso)
  WHERE id_proceso <> '';

-- Fecha general (para la vista de admin que trae todo)
CREATE INDEX IF NOT EXISTS idx_viab_created
  ON public.viabilidad_analisis (created_at DESC);

-- ─── Trigger: updated_at automático ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_viabilidad_analisis_updated ON public.viabilidad_analisis;
CREATE TRIGGER trg_viabilidad_analisis_updated
  BEFORE UPDATE ON public.viabilidad_analisis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS (Row Level Security) ────────────────────────────────────────────────
-- Las rutas API usan supabaseAdmin (service_role) que bypassa RLS.
-- El filtrado por user_id se hace en código (lib/authServer.ts).
-- Habilitamos RLS igualmente como capa de seguridad extra para accesos directos.

ALTER TABLE public.viabilidad_analisis ENABLE ROW LEVEL SECURITY;

-- Usuarios normales: solo ven y modifican sus propios análisis
CREATE POLICY "usuario_ve_los_suyos"
  ON public.viabilidad_analisis
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "usuario_inserta_los_suyos"
  ON public.viabilidad_analisis
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usuario_elimina_los_suyos"
  ON public.viabilidad_analisis
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admin y superuser: acceso total
CREATE POLICY "admin_acceso_total"
  ON public.viabilidad_analisis
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
