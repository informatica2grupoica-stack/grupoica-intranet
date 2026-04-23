// components/rrhh/EmpleadoForm.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, X } from 'lucide-react';

interface EmpleadoFormProps {
  empleado?: any;
  onSubmit: (data: any) => Promise<any>;
  loading: boolean;
}

export default function EmpleadoForm({ empleado, onSubmit, loading }: EmpleadoFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    rut: empleado?.rut || '',
    nombre_completo: empleado?.nombre_completo || '',
    apellido_paterno: empleado?.apellido_paterno || '',
    apellido_materno: empleado?.apellido_materno || '',
    email_personal: empleado?.email_personal || '',
    email_corporativo: empleado?.email_corporativo || '',
    telefono: empleado?.telefono || '',
    telefono_emergencia: empleado?.telefono_emergencia || '',
    fecha_nacimiento: empleado?.fecha_nacimiento?.split('T')[0] || '',
    genero: empleado?.genero || '',
    estado_civil: empleado?.estado_civil || '',
    nacionalidad: empleado?.nacionalidad || 'Chilena',
    numero_hijos: empleado?.numero_hijos || 0,
    direccion: empleado?.direccion || '',
    comuna: empleado?.comuna || '',
    ciudad: empleado?.ciudad || '',
    region: empleado?.region || '',
    cargo: empleado?.cargo || '',
    area: empleado?.area || '',
    departamento: empleado?.departamento || '',
    jefe_directo_id: empleado?.jefe_directo_id || '',
    fecha_ingreso: empleado?.fecha_ingreso?.split('T')[0] || '',
    tipo_contrato: empleado?.tipo_contrato || '',
    jornada: empleado?.jornada || '',
    sueldo_base: empleado?.sueldo_base || '',
    banco: empleado?.banco || '',
    cuenta_tipo: empleado?.cuenta_tipo || '',
    cuenta_numero: empleado?.cuenta_numero || '',
    afp: empleado?.afp || '',
    salud: empleado?.salud || '',
    isapre_nombre: empleado?.isapre_nombre || '',
    mutual_seguridad: empleado?.mutual_seguridad || '',
    cesantia: empleado?.cesantia ?? true,
    contacto_emergencia_nombre: empleado?.contacto_emergencia_nombre || '',
    contacto_emergencia_telefono: empleado?.contacto_emergencia_telefono || '',
    contacto_emergencia_parentesco: empleado?.contacto_emergencia_parentesco || '',
  });

  // ✅ Función para limpiar datos antes de enviar
  const limpiarDatosParaEnviar = (datos: any) => {
    const datosLimpios: any = {};
    
    Object.keys(datos).forEach(key => {
      const valor = datos[key];
      
      // ✅ Convertir strings vacíos a null
      if (valor === '' || valor === 'null') {
        datosLimpios[key] = null;
      } 
      // ✅ Mantener números
      else if (typeof valor === 'number') {
        datosLimpios[key] = valor;
      }
      // ✅ Mantener booleanos
      else if (typeof valor === 'boolean') {
        datosLimpios[key] = valor;
      }
      // ✅ Mantener strings con contenido
      else if (typeof valor === 'string' && valor.trim() !== '') {
        datosLimpios[key] = valor;
      }
      // ✅ Valores válidos
      else if (valor !== undefined && valor !== null) {
        datosLimpios[key] = valor;
      }
      // ✅ Todo lo demás va como null
      else {
        datosLimpios[key] = null;
      }
    });
    
    return datosLimpios;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones básicas
    if (!form.rut) {
      setError('El RUT es obligatorio');
      return;
    }
    if (!form.nombre_completo) {
      setError('El nombre completo es obligatorio');
      return;
    }
    if (!form.fecha_ingreso) {
      setError('La fecha de ingreso es obligatoria');
      return;
    }

    // ✅ Limpiar datos antes de enviar
    const datosLimpios = limpiarDatosParaEnviar(form);
    
    // ✅ Asegurar que jefe_directo_id sea null si está vacío
    if (!datosLimpios.jefe_directo_id || datosLimpios.jefe_directo_id === '') {
      datosLimpios.jefe_directo_id = null;
    }

    console.log('📤 Enviando datos limpios:', datosLimpios);
    
    const result = await onSubmit(datosLimpios);
    if (result.success) {
      router.push('/rrhh/empleados');
    } else {
      setError(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-black text-slate-800">
          {empleado ? '✏️ Editar Empleado' : '➕ Nuevo Empleado'}
        </h2>
        <button type="button" onClick={() => router.back()} className="p-2 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Sección: Datos Personales */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">📋 Datos Personales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">RUT *</label>
            <input 
              value={form.rut} 
              onChange={e => setForm({...form, rut: e.target.value})} 
              className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200" 
              placeholder="12.345.678-9" 
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Nombre Completo *</label>
            <input 
              value={form.nombre_completo} 
              onChange={e => setForm({...form, nombre_completo: e.target.value})} 
              className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200" 
              required
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Apellido Paterno</label>
            <input value={form.apellido_paterno} onChange={e => setForm({...form, apellido_paterno: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Apellido Materno</label>
            <input value={form.apellido_materno} onChange={e => setForm({...form, apellido_materno: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Fecha Nacimiento</label>
            <input type="date" value={form.fecha_nacimiento} onChange={e => setForm({...form, fecha_nacimiento: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Género</label>
            <select value={form.genero} onChange={e => setForm({...form, genero: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm">
              <option value="">Seleccionar</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Estado Civil</label>
            <select value={form.estado_civil} onChange={e => setForm({...form, estado_civil: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm">
              <option value="">Seleccionar</option>
              <option value="soltero">Soltero/a</option>
              <option value="casado">Casado/a</option>
              <option value="divorciado">Divorciado/a</option>
              <option value="viudo">Viudo/a</option>
              <option value="union_civil">Unión Civil</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Nacionalidad</label>
            <input value={form.nacionalidad} onChange={e => setForm({...form, nacionalidad: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Número de Hijos</label>
            <input type="number" value={form.numero_hijos} onChange={e => setForm({...form, numero_hijos: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
        </div>
      </div>

      {/* Sección: Contacto */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">📞 Contacto</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Email Personal</label>
            <input type="email" value={form.email_personal} onChange={e => setForm({...form, email_personal: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Email Corporativo</label>
            <input type="email" value={form.email_corporativo} onChange={e => setForm({...form, email_corporativo: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Teléfono</label>
            <input value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Teléfono Emergencia</label>
            <input value={form.telefono_emergencia} onChange={e => setForm({...form, telefono_emergencia: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Contacto Emergencia</label>
            <input value={form.contacto_emergencia_nombre} onChange={e => setForm({...form, contacto_emergencia_nombre: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" placeholder="Nombre" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Parentesco</label>
            <input value={form.contacto_emergencia_parentesco} onChange={e => setForm({...form, contacto_emergencia_parentesco: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
        </div>
      </div>

      {/* Sección: Dirección */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">📍 Ubicación</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Dirección</label>
            <input value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Comuna</label>
            <input value={form.comuna} onChange={e => setForm({...form, comuna: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Ciudad</label>
            <input value={form.ciudad} onChange={e => setForm({...form, ciudad: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Región</label>
            <select value={form.region} onChange={e => setForm({...form, region: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm">
              <option value="">Seleccionar</option>
              <option value="01">Tarapacá</option>
              <option value="02">Antofagasta</option>
              <option value="03">Atacama</option>
              <option value="04">Coquimbo</option>
              <option value="05">Valparaíso</option>
              <option value="06">O'Higgins</option>
              <option value="07">Maule</option>
              <option value="08">Biobío</option>
              <option value="09">Araucanía</option>
              <option value="10">Los Lagos</option>
              <option value="11">Aysén</option>
              <option value="12">Magallanes</option>
              <option value="13">Metropolitana</option>
              <option value="14">Los Ríos</option>
              <option value="15">Arica y Parinacota</option>
              <option value="16">Ñuble</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sección: Datos Laborales */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">💼 Datos Laborales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Cargo</label>
            <input value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Área</label>
            <input value={form.area} onChange={e => setForm({...form, area: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Departamento</label>
            <input value={form.departamento} onChange={e => setForm({...form, departamento: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Jefe Directo ID</label>
            <input value={form.jefe_directo_id} onChange={e => setForm({...form, jefe_directo_id: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" placeholder="UUID del jefe" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Fecha Ingreso *</label>
            <input type="date" value={form.fecha_ingreso} onChange={e => setForm({...form, fecha_ingreso: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" required />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Tipo Contrato</label>
            <select value={form.tipo_contrato} onChange={e => setForm({...form, tipo_contrato: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm">
              <option value="">Seleccionar</option>
              <option value="indefinido">Indefinido</option>
              <option value="plazo_fijo">Plazo Fijo</option>
              <option value="honorarios">Honorarios</option>
              <option value="practica">Práctica</option>
              <option value="temporal">Temporal</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Jornada</label>
            <select value={form.jornada} onChange={e => setForm({...form, jornada: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm">
              <option value="">Seleccionar</option>
              <option value="completa">Completa (45 hrs)</option>
              <option value="parcial">Parcial</option>
              <option value="turnos">Turnos</option>
              <option value="por_horas">Por Horas</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Sueldo Base</label>
            <input type="number" value={form.sueldo_base} onChange={e => setForm({...form, sueldo_base: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" placeholder="$" />
          </div>
        </div>
      </div>

      {/* Sección: Datos Bancarios */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">🏦 Datos Bancarios</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Banco</label>
            <input value={form.banco} onChange={e => setForm({...form, banco: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Tipo Cuenta</label>
            <select value={form.cuenta_tipo} onChange={e => setForm({...form, cuenta_tipo: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm">
              <option value="">Seleccionar</option>
              <option value="corriente">Corriente</option>
              <option value="vista">Vista / RUT</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Número Cuenta</label>
            <input value={form.cuenta_numero} onChange={e => setForm({...form, cuenta_numero: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
        </div>
      </div>

      {/* Sección: Previsión y Salud */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">🏥 Previsión y Salud</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">AFP</label>
            <input value={form.afp} onChange={e => setForm({...form, afp: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Salud</label>
            <select value={form.salud} onChange={e => setForm({...form, salud: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm">
              <option value="">Seleccionar</option>
              <option value="fonasa">Fonasa</option>
              <option value="isapre">Isapre</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Isapre</label>
            <input value={form.isapre_nombre} onChange={e => setForm({...form, isapre_nombre: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Mutual Seguridad</label>
            <input value={form.mutual_seguridad} onChange={e => setForm({...form, mutual_seguridad: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500 cursor-pointer">
              <input type="checkbox" checked={form.cesantia} onChange={e => setForm({...form, cesantia: e.target.checked})} className="rounded border-slate-300" />
              Seguro de Cesantía
            </label>
          </div>
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={() => router.back()} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-2">
          {loading && <Loader2 size={16} className="animate-spin" />}
          <Save size={16} />
          {empleado ? 'Actualizar' : 'Guardar Empleado'}
        </button>
      </div>
    </form>
  );
}