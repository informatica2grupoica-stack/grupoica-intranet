// app/(dashboard)/rrhh/empleados/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRrhh } from '@/app/hooks/useRrhh';
import { Plus, Loader2, Eye, Edit3, Trash2, Users, X } from 'lucide-react';
import FiltrosEmpleados from '@/app/components/rrhh/FiltrosEmpleados';
import EmpleadoCard from '@/app/components/rrhh/EmpleadoCard';
import PaginacionRRHH from '@/app/components/rrhh/PaginacionRRHH';
import ModalDetalleEmpleado from '@/app/components/rrhh/ModalDetalleEmpleado';

type VistaType = 'grid' | 'lista';

export default function EmpleadosPage() {
  const { empleados, loading, pagination, filtros, setFiltros, areasDisponibles, cambiarPagina, eliminarEmpleado } = useRrhh();
  const [vista, setVista] = useState<VistaType>('grid');
  const [empleadoAEliminar, setEmpleadoAEliminar] = useState<any>(null);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<any>(null);
  const [eliminando, setEliminando] = useState(false);

  const handleEliminar = async () => {
    if (!empleadoAEliminar) return;
    
    setEliminando(true);
    const result = await eliminarEmpleado(empleadoAEliminar.id);
    setEliminando(false);
    
    if (result.success) {
      setEmpleadoAEliminar(null);
    } else {
      alert(result.error || 'Error al eliminar el empleado');
    }
  };

  if (loading && empleados.length === 0) {
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
            Gestión de <span className="text-blue-600">Empleados</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            {pagination.total} trabajadores registrados
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Vista toggle */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setVista('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${vista === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              📱 Grid
            </button>
            <button
              onClick={() => setVista('lista')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${vista === 'lista' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              📋 Lista
            </button>
          </div>

          <Link
            href="/rrhh/empleados/nuevo"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide shadow-lg transition-all flex items-center gap-2"
          >
            <Plus size={16} />
            Nuevo Empleado
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <FiltrosEmpleados filtros={filtros} setFiltros={setFiltros} areasDisponibles={areasDisponibles} />

      {/* Listado */}
      {empleados.length === 0 && !loading ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={40} className="text-slate-300" />
          </div>
          <p className="text-slate-500 font-bold text-lg">No se encontraron empleados</p>
          <p className="text-slate-400 text-sm mt-1">Ajusta los filtros o crea un nuevo empleado</p>
        </div>
      ) : vista === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {empleados.map((emp) => (
            <EmpleadoCard key={emp.id} empleado={emp} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Empleado</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cargo / Área</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contacto</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold">
                          {emp.nombre_completo?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{emp.nombre_completo}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{emp.rut}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-700">{emp.cargo || '—'}</p>
                      <p className="text-[10px] text-slate-400">{emp.area || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      {emp.email_corporativo && <p className="text-xs text-slate-600 truncate max-w-[200px]">{emp.email_corporativo}</p>}
                      {emp.telefono && <p className="text-[10px] text-slate-400">{emp.telefono}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${
                        emp.estado === 'activo' ? 'bg-emerald-100 text-emerald-600' :
                        emp.estado === 'vacaciones' ? 'bg-amber-100 text-amber-600' :
                        emp.estado === 'licencia' ? 'bg-blue-100 text-blue-600' :
                        emp.estado === 'despedido' ? 'bg-red-100 text-red-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {emp.estado === 'activo' ? 'Activo' : 
                         emp.estado === 'vacaciones' ? 'Vacaciones' : 
                         emp.estado === 'licencia' ? 'Licencia' :
                         emp.estado === 'despedido' ? 'Despedido' : 'Renunció'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setEmpleadoSeleccionado(emp)} 
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors" 
                          title="Ver"
                        >
                          <Eye size={16} />
                        </button>
                        <Link href={`/rrhh/empleados/${emp.id}/editar`} className="p-2 text-slate-400 hover:text-amber-600 transition-colors" title="Editar">
                          <Edit3 size={16} />
                        </Link>
                        <button 
                          onClick={() => setEmpleadoAEliminar(emp)} 
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors" 
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginación */}
      {pagination.total > 0 && pagination.last_page > 1 && (
        <PaginacionRRHH
          currentPage={pagination.current_page}
          totalPages={pagination.last_page}
          onPageChange={cambiarPagina}
          totalItems={pagination.total}
          itemsPerPage={pagination.per_page}
        />
      )}

      {/* Modal de detalles */}
      {empleadoSeleccionado && (
        <ModalDetalleEmpleado
          empleado={empleadoSeleccionado}
          onClose={() => setEmpleadoSeleccionado(null)}
        />
      )}

      {/* Modal de confirmación de eliminación */}
      {empleadoAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">⚠️ Confirmar eliminación</h3>
                <button onClick={() => setEmpleadoAEliminar(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={28} className="text-red-600" />
              </div>
              <p className="text-slate-800 font-medium mb-2">
                ¿Estás seguro de que deseas eliminar permanentemente a <strong>{empleadoAEliminar.nombre_completo}</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-4">
                <p className="text-xs text-red-700 font-semibold mb-2">
                  ⚠️ Esta acción es <strong>permanente</strong> y no se puede deshacer.
                </p>
                <p className="text-xs text-red-600">
                  Se eliminarán todos los registros asociados (asistencias, permisos, contratos, capacitaciones, evaluaciones).
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setEmpleadoAEliminar(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                disabled={eliminando}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {eliminando && <Loader2 size={14} className="animate-spin" />}
                <Trash2 size={14} />
                {eliminando ? 'Eliminando...' : 'Eliminar permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}