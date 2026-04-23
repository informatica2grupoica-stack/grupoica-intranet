// components/rrhh/ModalDetalleEmpleado.tsx
'use client';
import Link from 'next/link';
import { X, Calendar, Mail, Phone, MapPin, Briefcase, Building2, CreditCard, Heart, User, FileText } from 'lucide-react';

interface ModalDetalleEmpleadoProps {
  empleado: any;
  onClose: () => void;
}

export default function ModalDetalleEmpleado({ empleado, onClose }: ModalDetalleEmpleadoProps) {
  if (!empleado) return null;

  const formatFecha = (fecha: string) => {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  const formatSueldo = (sueldo: number) => {
    if (!sueldo) return '—';
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(sueldo);
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white rounded-2xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-white font-bold text-2xl">
              {empleado.nombre_completo?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="text-white">
              <h2 className="text-xl font-bold">{empleado.nombre_completo}</h2>
              <p className="text-sm text-blue-100">{empleado.cargo || 'Sin cargo'} • {empleado.area || 'Sin área'}</p>
              <p className="text-xs text-blue-200 font-mono">RUT: {empleado.rut}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Datos Personales */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
              <User size={16} className="text-blue-500" />
              Datos Personales
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Nombres</p>
                <p className="font-medium text-slate-700">{empleado.nombre_completo || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">RUT</p>
                <p className="font-medium text-slate-700">{empleado.rut || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Género</p>
                <p className="font-medium text-slate-700">{empleado.genero || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Estado Civil</p>
                <p className="font-medium text-slate-700">{empleado.estado_civil || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Nacionalidad</p>
                <p className="font-medium text-slate-700">{empleado.nacionalidad || 'Chilena'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Fecha Nacimiento</p>
                <p className="font-medium text-slate-700">{formatFecha(empleado.fecha_nacimiento)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Número Hijos</p>
                <p className="font-medium text-slate-700">{empleado.numero_hijos || 0}</p>
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Phone size={16} className="text-blue-500" />
              Contacto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Email Personal</p>
                  <p className="text-slate-700">{empleado.email_personal || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Email Corporativo</p>
                  <p className="text-slate-700">{empleado.email_corporativo || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Teléfono</p>
                  <p className="text-slate-700">{empleado.telefono || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Teléfono Emergencia</p>
                  <p className="text-slate-700">{empleado.telefono_emergencia || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <Heart size={14} className="text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Contacto Emergencia</p>
                  <p className="text-slate-700">
                    {empleado.contacto_emergencia_nombre || '—'} 
                    {empleado.contacto_emergencia_parentesco && ` (${empleado.contacto_emergencia_parentesco})`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Ubicación */}
          {empleado.direccion && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                <MapPin size={16} className="text-blue-500" />
                Ubicación
              </h3>
              <div className="text-sm text-slate-700">
                <p>{empleado.direccion}</p>
                <p>{empleado.comuna && `${empleado.comuna}, `}{empleado.ciudad && `${empleado.ciudad}, `}{empleado.region && `Región ${empleado.region}`}</p>
              </div>
            </div>
          )}

          {/* Datos Laborales */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Briefcase size={16} className="text-blue-500" />
              Datos Laborales
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Cargo</p>
                <p className="font-medium text-slate-700">{empleado.cargo || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Área</p>
                <p className="font-medium text-slate-700">{empleado.area || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Departamento</p>
                <p className="font-medium text-slate-700">{empleado.departamento || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Tipo Contrato</p>
                <p className="font-medium text-slate-700">{empleado.tipo_contrato || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Jornada</p>
                <p className="font-medium text-slate-700">{empleado.jornada || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Sueldo Base</p>
                <p className="font-medium text-slate-700">{formatSueldo(empleado.sueldo_base)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Fecha Ingreso</p>
                <p className="font-medium text-slate-700">{formatFecha(empleado.fecha_ingreso)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Vacaciones Disponibles</p>
                <p className="font-medium text-slate-700">{empleado.dias_vacacion_disponibles || 15} días</p>
              </div>
            </div>
          </div>

          {/* Datos Bancarios */}
          {(empleado.banco || empleado.cuenta_tipo || empleado.cuenta_numero) && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                <CreditCard size={16} className="text-blue-500" />
                Datos Bancarios
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Banco</p>
                  <p className="font-medium text-slate-700">{empleado.banco || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Tipo Cuenta</p>
                  <p className="font-medium text-slate-700">{empleado.cuenta_tipo || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Número Cuenta</p>
                  <p className="font-medium text-slate-700">{empleado.cuenta_numero || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Previsión y Salud */}
          {(empleado.afp || empleado.salud) && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Building2 size={16} className="text-blue-500" />
                Previsión y Salud
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">AFP</p>
                  <p className="font-medium text-slate-700">{empleado.afp || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Salud</p>
                  <p className="font-medium text-slate-700">{empleado.salud || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Isapre</p>
                  <p className="font-medium text-slate-700">{empleado.isapre_nombre || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Mutual</p>
                  <p className="font-medium text-slate-700">{empleado.mutual_seguridad || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-slate-400 pt-4 border-t border-slate-100">
            <p>Registrado el: {formatFecha(empleado.created_at)}</p>
            <p className="text-[9px] font-mono">ID: {empleado.id}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <Link
            href={`/rrhh/empleados/${empleado.id}/editar`}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Editar Empleado
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  );
}