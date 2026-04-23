// app/api/rrhh/empleados/route.ts
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
      .select(`
        id,
        perfil_id,
        rut,
        nombre_completo,
        apellido_paterno,
        apellido_materno,
        email_personal,
        email_corporativo,
        telefono,
        telefono_emergencia,
        fecha_nacimiento,
        genero,
        estado_civil,
        nacionalidad,
        numero_hijos,
        direccion,
        comuna,
        ciudad,
        region,
        cargo,
        area,
        departamento,
        jefe_directo_id,
        fecha_ingreso,
        fecha_termino,
        tipo_contrato,
        jornada,
        sueldo_base,
        banco,
        cuenta_tipo,
        cuenta_numero,
        afp,
        salud,
        isapre_nombre,
        mutual_seguridad,
        cesantia,
        dias_vacacion_anual,
        dias_vacacion_disponibles,
        dias_permiso_anual,
        dias_permiso_disponibles,
        estado,
        activo,
        contacto_emergencia_nombre,
        contacto_emergencia_telefono,
        contacto_emergencia_parentesco,
        created_at,
        updated_at,
        created_by,
        jefe_directo:empleados!empleados_jefe_directo_id_fkey(
          id,
          nombre_completo,
          cargo
        )
      `, { count: 'exact' });
    
    // Aplicar filtros
    if (search) {
      query = query.or(`nombre_completo.ilike.%${search}%,rut.ilike.%${search}%,email_corporativo.ilike.%${search}%`);
    }
    if (estado) {
      query = query.eq('estado', estado);
    }
    if (area) {
      query = query.eq('area', area);
    }
    
    // Paginación
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    const { data, error, count } = await query
      .order('nombre_completo', { ascending: true })
      .range(from, to);
    
    if (error) throw error;
    
    // Obtener áreas únicas para filtros
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

// POST: Crear nuevo empleado
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validaciones básicas
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
      .single();
    
    if (existente) {
      return NextResponse.json({ error: 'Ya existe un empleado con este RUT' }, { status: 400 });
    }
    
    // Calcular días de vacaciones disponibles según fecha de ingreso
    const fechaIngreso = new Date(body.fecha_ingreso);
    const hoy = new Date();
    let añosTrabajados = hoy.getFullYear() - fechaIngreso.getFullYear();
    const mesIngreso = fechaIngreso.getMonth();
    const mesActual = hoy.getMonth();
    
    // Ajustar si aún no ha cumplido el año
    if (mesActual < mesIngreso) {
      añosTrabajados--;
    }
    
    // Calcular días de vacación: 1.25 días por mes trabajado, máximo 15
    const mesesTrabajados = añosTrabajados * 12 + (mesActual - mesIngreso);
    const diasVacacion = Math.min(15, Math.floor(mesesTrabajados * 1.25));
    
    const nuevoEmpleado = {
      ...body,
      dias_vacacion_anual: 15,
      dias_vacacion_disponibles: Math.max(0, diasVacacion),
      dias_permiso_anual: 12,
      dias_permiso_disponibles: 12,
      activo: true,
      estado: 'activo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
      .from('empleados')
      .insert([nuevoEmpleado])
      .select()
      .single();
    
    if (error) throw error;
    
    // Si tiene email corporativo, crear perfil de usuario automáticamente
    if (body.email_corporativo) {
      const nombrePartes = body.nombre_completo.trim().split(' ');
      const primerNombre = nombrePartes[0] || '';
      const apellidos = nombrePartes.slice(1).join(' ') || '';
      
      const { error: perfilError } = await supabase
        .from('perfiles')
        .insert([{
          email: body.email_corporativo,
          nombre: primerNombre,
          apellido: apellidos,
          rol: 'user',
          empleado_id: data.id,
          rut: body.rut,
          telefono: body.telefono,
          cargo: body.cargo,
          activo: true,
          permisos: {
            can_create_tasks: false,
            can_assign_tasks: false,
            can_view_billing: false,
            can_manage_devices: false,
            can_create_products: false,
            can_view_rrhh: false,
            can_manage_rrhh: false,
            can_approve_permits: false
          }
        }]);
      
      if (perfilError) {
        console.error('Error creando perfil:', perfilError);
        // No fallamos la creación del empleado, solo registramos el error
      }
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en POST /api/rrhh/empleados:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear empleado' },
      { status: 500 }
    );
  }
}