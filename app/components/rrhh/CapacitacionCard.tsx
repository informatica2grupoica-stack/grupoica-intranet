// components/rrhh/CapacitacionCard.tsx
'use client';
import { Calendar, Clock, Building2, DollarSign, Users, Edit3, Trash2, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface CapacitacionCardProps {
  capacitacion: any;
  empleados?: any[];
  onAssign?: (empleadoId: string, capacitacionId: string) => Promise<any>;
  onDelete?: (id: string) => void;
  asignaciones?: any[];
}

export default function CapacitacionCard({ capacitacion, empleados, onAssign, onDelete, asignaciones = [] }: CapacitacionCardProps) {
  const [mostrarAsignar, setMostrarAsignar] = useState(false);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState('');
  const [asignando, setAsignando] = useState(false);

  const empleadosAsignados = asignaciones.filter(a => a.capacitacion_id === capacitacion.id);
  const completados = empleadosAsignados.filter(a => a.completado).length;

  const getModalidadIcon = (modalidad: string) => {
    switch (modalidad) {
      case 'presencial': return '🏢';
      case 'online': return '💻';
      case 'mixto': return '🔄';
      default: return '📚';
    }
  };

  const handleAsignar = async () => {
    if (!empleadoSeleccionado || !onAssign) return;
    setAsignando(true);
    await onAssign(empleadoSeleccionado, capacitacion.id);
    setAsignando(false);
    setMostrarAsignar(false);
    setEmpleadoSeleccionado('');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:shadow-lg transition-all overflow-hidden">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center text-white text-lg">
              {getModalidadIcon(capacitacion.modalidad)}
            </div>
            <div>
              <h3 className="font-bold text-slate-800">{capacitacion.nombre}</h3>
              {capacitacion.proveedor && (
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Building2 size={10} /> {capacitacion.proveedor}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Link
              href={`/rrhh/capacitaciones/${capacitacion.id}/editar`}
              className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors rounded-lg"
            >
              <Edit3 size={14} />
            </Link>
            {onDelete && (
              <button
                onClick={() => onDelete(capacitacion.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-lg"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Detalles */}
        <div className="space-y-2 mb-4">
          {(capacitacion.fecha_inicio || capacitacion.fecha_fin) && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar size={14} className="text-slate-400" />
              <span>
                {capacitacion.fecha_inicio ? new Date(capacitacion.fecha_inicio).toLocaleDateString() : '—'}
                {capacitacion.fecha_fin && ` → ${new Date(capacitacion.fecha_fin).toLocaleDateString()}`}
              </span>
            </div>
          )}
          {capacitacion.horas_total && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock size={14} className="text-slate-400" />
              <span>{capacitacion.horas_total} horas</span>
            </div>
          )}
          {capacitacion.costo && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <DollarSign size={14} className="text-slate-400" />
              <span>{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(capacitacion.costo)}</span>
            </div>
          )}
          {capacitacion.descripcion && (
            <p className="text-xs text-slate-500 line-clamp-2">{capacitacion.descripcion}</p>
          )}
        </div>

        {/* Participantes */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Users size={12} />
            <span>{empleadosAsignados.length} participantes</span>
            {completados > 0 && (
              <span className="text-emerald-600">({completados} completados)</span>
            )}
          </div>
          {empleados && onAssign && (
            <div className="relative">
              <button
                onClick={() => setMostrarAsignar(!mostrarAsignar)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <LinkIcon size={12} />
                Asignar
              </button>

              {mostrarAsignar && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-10">
                  <p className="text-[10px] font-bold text-slate-500 mb-2">Seleccionar empleado</p>
                  <select
                    value={empleadoSeleccionado}
                    onChange={(e) => setEmpleadoSeleccionado(e.target.value)}
                    className="w-full bg-slate-50 rounded-lg p-2 text-sm mb-2"
                  >
                    <option value="">Elegir empleado...</option>
                    {empleados?.filter(e => !empleadosAsignados.some(a => a.empleado_id === e.id)).map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.nombre_completo}</option>
                    ))}
                  </select>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setMostrarAsignar(false)} className="px-3 py-1 text-xs text-slate-500">Cancelar</button>
                    <button onClick={handleAsignar} disabled={!empleadoSeleccionado || asignando} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">
                      {asignando ? '...' : 'Asignar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}