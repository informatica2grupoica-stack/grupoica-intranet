// app/(dashboard)/rrhh/capacitaciones/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRrhh } from '@/app/hooks/useRrhh';
import { useCapacitaciones } from '@/app/hooks/useCapacitaciones';
import { Plus, Loader2, Search, BookOpen, Users } from 'lucide-react';
import CapacitacionCard from '@/app/components/rrhh/CapacitacionCard';
import AsignacionCapacitacionCard from '@/app/components/rrhh/AsignacionCapacitacionCard';
import PaginacionRRHH from '@/app/components/rrhh/PaginacionRRHH';

type TabType = 'catalogo' | 'mis-capacitaciones';

export default function CapacitacionesPage() {
  const { empleados } = useRrhh();
  const { capacitaciones, asignaciones, loading, pagination, eliminarCapacitacion, asignarCapacitacion, completarCapacitacion, cambiarPagina } = useCapacitaciones();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabType>('catalogo');

  const capacitacionesFiltradas = capacitaciones.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.proveedor?.toLowerCase().includes(search.toLowerCase())
  );

  // Asignaciones del empleado actual (simplificado - puedes pasar el empleadoId)
  const misAsignaciones = asignaciones; // Aquí podrías filtrar por empleado actual

  if (loading && capacitaciones.length === 0) {
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
            Gestión de <span className="text-blue-600">Capacitaciones</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Cursos, certificaciones y desarrollo profesional
          </p>
        </div>

        <Link
          href="/rrhh/capacitaciones/nueva"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide shadow-lg transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          Nueva Capacitación
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab('catalogo')}
          className={`px-5 py-2.5 text-sm font-bold transition-all rounded-t-xl ${tab === 'catalogo' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <BookOpen size={16} className="inline mr-2" />
          Catálogo
        </button>
        <button
          onClick={() => setTab('mis-capacitaciones')}
          className={`px-5 py-2.5 text-sm font-bold transition-all rounded-t-xl ${tab === 'mis-capacitaciones' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users size={16} className="inline mr-2" />
          Mis Capacitaciones
        </button>
      </div>

      {/* Búsqueda (solo en catálogo) */}
      {tab === 'catalogo' && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o proveedor..."
            className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Tab: Catálogo */}
      {tab === 'catalogo' && (
        <>
          {capacitacionesFiltradas.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No hay capacitaciones registradas</p>
              <Link href="/rrhh/capacitaciones/nueva" className="mt-3 inline-block text-blue-600 text-sm font-bold">
                + Crear primera capacitación
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {capacitacionesFiltradas.map((cap) => (
                <CapacitacionCard
                  key={cap.id}
                  capacitacion={cap}
                  empleados={empleados}
                  onAssign={asignarCapacitacion}
                  onDelete={eliminarCapacitacion}
                  asignaciones={asignaciones}
                />
              ))}
            </div>
          )}

          {pagination.total > 0 && (
            <PaginacionRRHH
              currentPage={pagination.current_page}
              totalPages={pagination.last_page}
              onPageChange={cambiarPagina}
              totalItems={pagination.total}
              itemsPerPage={pagination.per_page}
            />
          )}
        </>
      )}

      {/* Tab: Mis Capacitaciones */}
      {tab === 'mis-capacitaciones' && (
        <>
          {misAsignaciones.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <Users size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No tienes capacitaciones asignadas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {misAsignaciones.map((asig) => (
                <AsignacionCapacitacionCard
                  key={asig.id}
                  asignacion={asig}
                  onCompletar={completarCapacitacion}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}