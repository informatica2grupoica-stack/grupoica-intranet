// components/rrhh/EmpleadoCard.tsx
'use client';
import { User, Mail, Phone, MapPin, Briefcase, Calendar, MoreVertical } from 'lucide-react';
import Link from 'next/link';

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
  };
}

export default function EmpleadoCard({ empleado }: EmpleadoCardProps) {
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
      case 'despedido': return 'Despedido';
      case 'renuncio': return 'Renunció';
      default: return estado;
    }
  };

  const fechaIngreso = new Date(empleado.fecha_ingreso).toLocaleDateString('es-CL');
  const añosAntiguedad = Math.floor((new Date().getTime() - new Date(empleado.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24 * 365));

  return (
    <Link href={`/rrhh/empleados/${empleado.id}`}>
      <div className="bg-white rounded-2xl border border-slate-200 hover:shadow-lg transition-all overflow-hidden group cursor-pointer">
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                {empleado.nombre_completo.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{empleado.nombre_completo}</h3>
                <p className="text-[10px] text-slate-400 font-mono">{empleado.rut}</p>
              </div>
            </div>
            <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${getEstadoColor(empleado.estado)}`}>
              {getEstadoLabel(empleado.estado)}
            </span>
          </div>

          <div className="space-y-2 mb-4">
            {empleado.cargo && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Briefcase size={14} className="text-slate-400" />
                <span>{empleado.cargo}</span>
                {empleado.area && <span className="text-slate-400">• {empleado.area}</span>}
              </div>
            )}
            {empleado.email_corporativo && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail size={14} className="text-slate-400" />
                <span className="truncate">{empleado.email_corporativo}</span>
              </div>
            )}
            {empleado.telefono && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone size={14} className="text-slate-400" />
                <span>{empleado.telefono}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar size={14} className="text-slate-400" />
              <span>{añosAntiguedad} años en la empresa</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <MapPin size={12} />
              <span>Ingreso: {fechaIngreso}</span>
            </div>
            <div className="text-blue-600 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              Ver detalles →
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}