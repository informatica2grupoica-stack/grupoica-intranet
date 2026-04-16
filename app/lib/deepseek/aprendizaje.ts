// lib/deepseek/aprendizaje.ts
import { supabase } from '@/lib/supabase';

interface AprendizajeData {
  producto_nombre: string;
  producto_categoria?: string;
  producto_subcategoria?: string;
  sku_generado?: string;
  c1?: string;
  c2?: string;
  c3?: string;
  c4?: string;
  usado_en_creacion: boolean;
}

export async function guardarAprendizaje(data: AprendizajeData) {
  try {
    const { error } = await supabase
      .from('ia_aprendizaje')
      .insert({
        producto_nombre: data.producto_nombre,
        producto_categoria: data.producto_categoria || null,
        producto_subcategoria: data.producto_subcategoria || null,
        sku_generado: data.sku_generado || null,
        c1: data.c1 || null,
        c2: data.c2 || null,
        c3: data.c3 || null,
        c4: data.c4 || null,
        usado_en_creacion: data.usado_en_creacion,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error("Error guardando aprendizaje:", error);
    }
  } catch (error) {
    console.error("Error en guardarAprendizaje:", error);
  }
}

export async function buscarAprendizajeSimilar(nombre: string): Promise<any[]> {
  try {
    // Buscar productos similares en el aprendizaje
    const { data, error } = await supabase
      .from('ia_aprendizaje')
      .select('*')
      .ilike('producto_nombre', `%${nombre}%`)
      .limit(5);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error buscando aprendizaje:", error);
    return [];
  }
}