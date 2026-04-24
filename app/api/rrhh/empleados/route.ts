// app/api/rrhh/empleados/route.ts - VERSIÓN CORREGIDA
// ELIMINA la sección que crea el perfil automáticamente

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Listar empleados con filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const estado = searchParams.get('estado') || '';
    const area = searchParams.get('area') || '';
    
    let query = supabase
      .from('empleados')
      .select('*', { count: 'exact' });
    
    if (search) {
      query = query.or(`nombre_completo.ilike.%${search}%,rut.ilike.%${search}%,email_corporativo.ilike.%${search}%`);
    }
    if (estado) {
      query = query.eq('estado', estado);
    }
    if (area) {
      query = query.eq('area', area);
    }
    
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    const { data, error, count } = await query
      .order('nombre_completo', { ascending: true })
      .range(from, to);
    
    if (error) throw error;
    
    const { data: areas } = await supabase
      .from('empleados')
      .select('area')
      .not('area', 'is', null)
      .eq('activo', true);
    
    const areasUnicas = [...new Set(areas?.map(a => a.area).filter(Boolean))];
    
    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        current_page: page,
        per_page: limit,
        total: count || 0,
        last_page: Math.ceil((count || 0) / limit),
      },
      filters: {
        areas: areasUnicas,
      },
    });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/empleados:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener empleados' },
      { status: 500 }
    );
  }
}

// POST: Crear nuevo empleado (SIN CREAR PERFIL AUTOMÁTICAMENTE)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('📥 Datos recibidos:', body);
    
    if (!body.rut) {
      return NextResponse.json({ error: 'El RUT es obligatorio' }, { status: 400 });
    }
    if (!body.nombre_completo) {
      return NextResponse.json({ error: 'El nombre completo es obligatorio' }, { status: 400 });
    }
    if (!body.fecha_ingreso) {
      return NextResponse.json({ error: 'La fecha de ingreso es obligatoria' }, { status: 400 });
    }
    
    // Verificar si el RUT ya existe
    const { data: existente } = await supabase
      .from('empleados')
      .select('id')
      .eq('rut', body.rut)
      .maybeSingle();
    
    if (existente) {
      return NextResponse.json({ error: 'Ya existe un empleado con este RUT' }, { status: 400 });
    }
    
    // ✅ Preparar datos
    const nuevoEmpleado: any = {
      rut: body.rut,
      nombre_completo: body.nombre_completo,
      apellido_paterno: body.apellido_paterno || '',
      apellido_materno: body.apellido_materno || null,
      email_personal: body.email_personal || null,
      email_corporativo: body.email_corporativo || null,
      telefono: body.telefono || null,
      telefono_emergencia: body.telefono_emergencia || null,
      fecha_nacimiento: body.fecha_nacimiento || null,
      genero: body.genero || null,
      estado_civil: body.estado_civil || null,
      nacionalidad: body.nacionalidad || 'Chilena',
      numero_hijos: body.numero_hijos || 0,
      direccion: body.direccion || null,
      comuna: body.comuna || null,
      ciudad: body.ciudad || null,
      region: body.region || null,
      cargo: body.cargo || null,
      area: body.area || null,
      departamento: body.departamento || null,
      jefe_directo_id: null,
      fecha_ingreso: body.fecha_ingreso,
      fecha_termino: body.fecha_termino || null,
      tipo_contrato: body.tipo_contrato || null,
      jornada: body.jornada || null,
      sueldo_base: body.sueldo_base ? parseInt(body.sueldo_base) : null,
      banco: body.banco || null,
      cuenta_tipo: body.cuenta_tipo || null,
      cuenta_numero: body.cuenta_numero || null,
      afp: body.afp || null,
      salud: body.salud || null,
      isapre_nombre: body.isapre_nombre || null,
      mutual_seguridad: body.mutual_seguridad || null,
      cesantia: body.cesantia === true || body.cesantia === 'true',
      dias_vacacion_anual: 15,
      dias_vacacion_disponibles: 15,
      dias_permiso_anual: 12,
      dias_permiso_disponibles: 12,
      activo: true,
      estado: 'activo',
      contacto_emergencia_nombre: body.contacto_emergencia_nombre || null,
      contacto_emergencia_telefono: body.contacto_emergencia_telefono || null,
      contacto_emergencia_parentesco: body.contacto_emergencia_parentesco || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    Object.keys(nuevoEmpleado).forEach(key => {
      if (nuevoEmpleado[key] === undefined) {
        delete nuevoEmpleado[key];
      }
    });
    
    console.log('📤 Datos a insertar:', nuevoEmpleado);
    
    const { data, error } = await supabase
      .from('empleados')
      .insert([nuevoEmpleado])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error al insertar:', error);
      throw error;
    }
    
    // ✅ IMPORTANTE: NO CREAR PERFIL AUTOMÁTICAMENTE
    // El perfil debe crearse manualmente desde el panel de usuarios
    // Esto evita que se sobrescriban perfiles existentes
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('❌ Error en POST /api/rrhh/empleados:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear empleado' },
      { status: 500 }
    );
  }
}