// components/rrhh/EmpleadoCard.tsx
'use client';
import { useState } from 'react';
import { Mail, Phone, Briefcase, MapPin, Eye } from 'lucide-react';
import ModalDetalleEmpleado from './ModalDetalleEmpleado';

interface EmpleadoCardProps {
  empleado: {
    id: string;
    nombre_completo: string;
    rut: string;
    cargo: string | null;
    area: string | null;
    email_corporativo: string | null;
    telefono: string | null;
    estado: string;
    fecha_ingreso: string;
    direccion?: string;
    comuna?: string;
  };
}

export default function EmpleadoCard({ empleado }: EmpleadoCardProps) {
  const [mostrarModal, setMostrarModal] = useState(false);

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'activo': return 'bg-emerald-100 text-emerald-600';
      case 'vacaciones': return 'bg-amber-100 text-amber-600';
      case 'licencia': return 'bg-red-100 text-red-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'activo': return 'Activo';
      case 'vacaciones': return 'Vacaciones';
      case 'licencia': return 'Licencia';
      default: return estado;
    }
  };

  const antiguedad = empleado.fecha_ingreso 
    ? Math.floor((new Date().getTime() - new Date(empleado.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : 0;

  return (
    <>
      <div 
        onClick={() => setMostrarModal(true)}
        className="bg-white rounded-2xl border border-slate-200 hover:shadow-lg transition-all overflow-hidden group cursor-pointer h-full flex flex-col"
      >
        <div className="p-5 flex-1">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0">
                {empleado.nombre_completo?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-800 truncate">{empleado.nombre_completo}</h3>
                <p className="text-[10px] text-slate-400 font-mono truncate">{empleado.rut}</p>
              </div>
            </div>
            <span className={`text-[9px] font-bold px-2 py-1 rounded-full shrink-0 ${getEstadoColor(empleado.estado)}`}>
              {getEstadoLabel(empleado.estado)}
            </span>
          </div>

          {/* Detalles */}
          <div className="space-y-2 mb-4">
            {empleado.cargo && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Briefcase size={14} className="text-slate-400 shrink-0" />
                <span className="truncate">{empleado.cargo}</span>
                {empleado.area && <span className="text-slate-400 text-xs">• {empleado.area}</span>}
              </div>
            )}
            {empleado.email_corporativo && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail size={14} className="text-slate-400 shrink-0" />
                <span className="truncate">{empleado.email_corporativo}</span>
              </div>
            )}
            {empleado.telefono && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone size={14} className="text-slate-400 shrink-0" />
                <span>{empleado.telefono}</span>
              </div>
            )}
            {empleado.direccion && (
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                <span className="line-clamp-1">{empleado.direccion}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 pt-0">
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span>{antiguedad} años en la empresa</span>
          </div>
          <div className="text-blue-600 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            Ver detalles <Eye size={12} />
          </div>
        </div>
      </div>

      {/* Modal de detalles */}
      {mostrarModal && (
        <ModalDetalleEmpleado
          empleado={empleado}
          onClose={() => setMostrarModal(false)}
        />
      )}
    </>
  );
}