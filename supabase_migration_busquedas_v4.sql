-- =============================================
-- MIGRACIÓN v4: Guardar región y contexto de búsqueda
-- Correr en: Supabase → SQL Editor → New Query
-- REQUIERE haber corrido las migraciones anteriores primero
-- =============================================

ALTER TABLE public.busquedas_guardadas
  -- Región de Chile seleccionada al buscar (ej: "Valparaíso", "Metropolitana")
  ADD COLUMN IF NOT EXISTS region    TEXT    DEFAULT NULL,

  -- Contexto del rubro ingresado por el usuario (ej: "ferretería construcción")
  ADD COLUMN IF NOT EXISTS contexto  TEXT    DEFAULT NULL;
