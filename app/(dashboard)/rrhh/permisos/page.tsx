// app/(dashboard)/rrhh/permisos/page.tsx
'use client';
import { useState } from 'react';
import { useRrhh } from '@/app/hooks/useRrhh';
import { usePermisos } from '@/app/hooks/usePermisos';
import { useAuth } from '@/app/hooks/useAuth';
import { Plus, Loader2, Eye } from 'lucide-react';
import SolicitarPermisoModal from '@/app/components/rrhh/SolicitarPermisoModal';
import AprobarPermisoModal from '@/app/components/rrhh/AprobarPermisoModal';

export default function PermisosPage() {
  const { empleados, loading: loadingEmpleados } = useRrhh();
  const { permisos, loading, filtros, setFiltros, crearPermiso, aprobarPermiso, rechazarPermiso } = usePermisos();
  const { puedeAprobarPermisos } = useAuth();

  const [mostrarModalSolicitud, setMostrarModalSolicitud] = useState(false);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState('');
  const [permisoSeleccionado, setPermisoSeleccionado] = useState<any>(null);
  const [mostrarModalAprobacion, setMostrarModalAprobacion] = useState(false);

  // Buscar el empleado actual con sus días de vacaciones
  const empleadoActual = empleados.find(e => e.id === empleadoSeleccionado);
  
  // Obtener días de vacaciones disponibles (con valor por defecto 15)
  const diasVacacionDisponibles = empleadoActual?.dias_vacacion_disponibles ?? 15;

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'aprobado':
        return { label: 'Aprobado', color: 'bg-emerald-100 text-emerald-600' };
      case 'rechazado':
        return { label: 'Rechazado', color: 'bg-red-100 text-red-600' };
      case 'pendiente':
        return { label: 'Pendiente', color: 'bg-amber-100 text-amber-600' };
      default:
        return { label: estado, color: 'bg-slate-100 text-slate-600' };
    }
  };

  const getTipoLabel = (tipo: string) => {
    const tipos: Record<string, string> = {
      vacaciones: '🏖️ Vacaciones',
      licencia_medica: '🏥 Licencia Médica',
      permiso_administrativo: '📋 Permiso Administrativo',
      estudio: '📚 Estudio',
      personal: '🏠 Personal',
      matrimonio: '💒 Matrimonio',
      luto: '⚫ Luto',
      otro: '📝 Otro',
    };
    return tipos[tipo] || tipo;
  };

  if (loadingEmpleados) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic">
            Gestión de <span className="text-blue-600">Permisos y Vacaciones</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Solicitudes, aprobaciones y seguimiento
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={empleadoSeleccionado}
            onChange={(e) => setEmpleadoSeleccionado(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl py-2.5 px-4 text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los empleados</option>
            {empleados.filter(e => e.activo).map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.nombre_completo}</option>
            ))}
          </select>

          <button
            onClick={() => setMostrarModalSolicitud(true)}
            disabled={!empleadoSeleccionado}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            Solicitar Permiso
          </button>
        </div>
      </div>

      {/* Advertencia si no hay empleado seleccionado */}
      {!empleadoSeleccionado && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <p className="text-sm text-amber-700">
            ⚠️ Selecciona un empleado para solicitar un permiso
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl p-4 border border-slate-200">
        <select
          value={filtros.estado}
          onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
          className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="aprobado">Aprobados</option>
          <option value="rechazado">Rechazados</option>
        </select>

        <select
          value={filtros.tipo}
          onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
          className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="vacaciones">Vacaciones</option>
          <option value="licencia_medica">Licencia Médica</option>
          <option value="permiso_administrativo">Permiso Administrativo</option>
          <option value="estudio">Estudio</option>
          <option value="personal">Personal</option>
        </select>

        <button
          onClick={() => setFiltros({ empleadoId: empleadoSeleccionado, estado: '', tipo: '' })}
          className="text-xs text-slate-500 hover:text-blue-600"
        >
          Limpiar filtros
        </button>
      </div>

      {/* Listado de permisos */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : permisos.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <p className="text-slate-500">No hay solicitudes de permiso</p>
          {empleadoSeleccionado && (
            <button
              onClick={() => setMostrarModalSolicitud(true)}
              className="mt-3 text-blue-600 text-sm font-bold"
            >
              + Crear primera solicitud
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Empleado</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Período</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Días</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {permisos.map((perm) => {
                  const estadoBadge = getEstadoBadge(perm.estado);
                  return (
                    <tr key={perm.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{perm.empleado?.nombre_completo || '—'}</p>
                          <p className="text-[10px] text-slate-400">{perm.empleado?.cargo || '—'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm">{getTipoLabel(perm.tipo)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-600">
                          {perm.fecha_inicio ? new Date(perm.fecha_inicio).toLocaleDateString() : '—'}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          → {perm.fecha_fin ? new Date(perm.fecha_fin).toLocaleDateString() : '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-slate-700">{perm.dias_solicitados || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${estadoBadge.color}`}>
                          {estadoBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setPermisoSeleccionado(perm);
                              setMostrarModalAprobacion(true);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Ver/Revisar"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de solicitud */}
      {mostrarModalSolicitud && empleadoSeleccionado && empleadoActual && (
        <SolicitarPermisoModal
          empleadoId={empleadoSeleccionado}
          empleadoNombre={empleadoActual.nombre_completo}
          diasVacacionDisponibles={diasVacacionDisponibles}
          onSave={crearPermiso}
          onClose={() => setMostrarModalSolicitud(false)}
        />
      )}

      {/* Modal de aprobación */}
      {mostrarModalAprobacion && permisoSeleccionado && (
        <AprobarPermisoModal
          permiso={permisoSeleccionado}
          onAprobar={aprobarPermiso}
          onRechazar={rechazarPermiso}
          onClose={() => {
            setMostrarModalAprobacion(false);
            setPermisoSeleccionado(null);
          }}
        />
      )}
    </div>
  );
}