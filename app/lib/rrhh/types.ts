// lib/rrhh/types.ts
export interface Empleado {
  id: string;
  perfil_id: string | null;
  
  // Datos personales
  rut: string;
  nombre_completo: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  email_personal: string | null;
  email_corporativo: string | null;
  telefono: string | null;
  telefono_emergencia: string | null;
  fecha_nacimiento: string | null;
  genero: 'masculino' | 'femenino' | 'otro' | 'prefiero_no_decir' | null;
  estado_civil: 'soltero' | 'casado' | 'divorciado' | 'viudo' | 'union_civil' | null;
  nacionalidad: string;
  numero_hijos: number;
  
  // Dirección
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  region: string | null;
  
  // Datos laborales
  cargo: string | null;
  area: string | null;
  departamento: string | null;
  jefe_directo_id: string | null;
  jefe_directo?: { nombre_completo: string } | null;
  fecha_ingreso: string;
  fecha_termino: string | null;
  tipo_contrato: 'indefinido' | 'plazo_fijo' | 'honorarios' | 'practica' | 'temporal' | null;
  jornada: 'completa' | 'parcial' | 'turnos' | 'por_horas' | null;
  sueldo_base: number | null;
  banco: string | null;
  cuenta_tipo: 'corriente' | 'vista' | 'rut' | null;
  cuenta_numero: string | null;
  
  // Previsión y salud
  afp: string | null;
  salud: 'fonasa' | 'isapre' | 'otro' | null;
  isapre_nombre: string | null;
  mutual_seguridad: string | null;
  cesantia: boolean;
  
  // Vacaciones
  dias_vacacion_anual: number;
  dias_vacacion_disponibles: number;
  dias_permiso_anual: number;
  dias_permiso_disponibles: number;
  
  // Estado
  estado: 'activo' | 'vacaciones' | 'licencia' | 'despedido' | 'renuncio';
  activo: boolean;
  
  // Contacto emergencia
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_telefono: string | null;
  contacto_emergencia_parentesco: string | null;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Contrato {
  id: string;
  empleado_id: string;
  numero_contrato: string;
  tipo_contrato: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  sueldo_base: number | null;
  cargo: string | null;
  area: string | null;
  jornada: string | null;
  archivo_url: string | null;
  observaciones: string | null;
  vigente: boolean;
  created_at: string;
}

export interface Permiso {
  id: string;
  empleado_id: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias_solicitados: number;
  motivo: string | null;
  documento_url: string | null;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado';
  aprobado_por: string | null;
  fecha_aprobacion: string | null;
  comentarios_aprobador: string | null;
  created_at: string;
}

export interface Asistencia {
  id: string;
  empleado_id: string;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  horas_trabajadas: number | null;
  horas_extras: number | null;
  estado: string;
  justificacion: string | null;
}

export interface EstadisticasRRHH {
  total_empleados: number;
  empleados_activos: number;
  empleados_ausentes: number;
  empleados_baja: number;
  contrataciones_anio: number;
  antiguedad_promedio: number;
  mujeres: number;
  hombres: number;
  por_area: Array<{ area: string; cantidad: number }>;
  por_cargo: Array<{ cargo: string; cantidad: number }>;
}