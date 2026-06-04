-- =============================================
-- MIGRACIÓN v3: Guardar el Excel original para exportar al restaurar
-- Correr en: Supabase → SQL Editor → New Query
-- REQUIERE haber corrido supabase_crear_busquedas_guardadas.sql primero
-- =============================================

ALTER TABLE public.busquedas_guardadas
  -- El archivo Excel codificado en base64 (permite reconstruir el File al restaurar)
  ADD COLUMN IF NOT EXISTS excel_base64  TEXT    DEFAULT NULL,

  -- Posiciones de columnas detectadas por SheetJS (para que el servidor las use en ExcelJS)
  ADD COLUMN IF NOT EXISTS cols_excel    JSONB   DEFAULT NULL,

  -- Nombre de la pestaña activa al guardar
  ADD COLUMN IF NOT EXISTS sheet_name    TEXT    DEFAULT 'COSTEO';
