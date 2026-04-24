// app/api/rrhh/organigrama/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Obtener todos los empleados activos
    const { data: empleados, error } = await supabase
      .from('empleados')
      .select(`
        id,
        nombre_completo,
        cargo,
        area,
        jefe_directo_id,
        email_corporativo,
        telefono
      `)
      .eq('activo', true)
      .order('nombre_completo', { ascending: true });

    if (error) throw error;

    if (!empleados || empleados.length === 0) {
      return NextResponse.json({ success: true, data: null });
    }

    // Construir árbol jerárquico
    const empleadosMap = new Map();
    const raices: any[] = [];

    // Primero, mapear todos los empleados
    empleados.forEach(emp => {
      empleadosMap.set(emp.id, {
        id: emp.id,
        name: emp.nombre_completo,
        title: emp.cargo || 'Sin cargo',
        department: emp.area || 'Sin área',
        email: emp.email_corporativo,
        phone: emp.telefono,
        children: [],
        parentId: emp.jefe_directo_id
      });
    });

    // Construir jerarquía
    empleadosMap.forEach(emp => {
      if (emp.parentId && empleadosMap.has(emp.parentId)) {
        const parent = empleadosMap.get(emp.parentId);
        parent.children.push(emp);
      } else {
        raices.push(emp);
      }
    });

    // Si no hay jerarquía definida, crear una raíz virtual con todos
    if (raices.length > 1) {
      const rootNode = {
        id: 'root',
        name: 'Organigrama',
        title: 'Estructura Empresarial',
        department: 'Grupo ICA',
        children: raices,
        parentId: null
      };
      return NextResponse.json({ success: true, data: rootNode });
    }

    return NextResponse.json({ success: true, data: raices[0] || null });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/organigrama:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener organigrama' },
      { status: 500 }
    );
  }
}