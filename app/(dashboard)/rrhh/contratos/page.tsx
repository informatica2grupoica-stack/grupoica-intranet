// app/(dashboard)/rrhh/contratos/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRrhh } from '@/app/hooks/useRrhh';
import { useContratos } from '@/app/hooks/useContratos';
import { Plus, Loader2, FileText, Filter } from 'lucide-react';
import ContratoCard from '@/app/components/rrhh/ContratoCard';
import PaginacionRRHH from '@/app/components/rrhh/PaginacionRRHH';

export default function ContratosPage() {
  const { empleados, loading: loadingEmpleados } = useRrhh();
  const { contratos, loading, filtros, setFiltros, eliminarContrato, pagination, cambiarPagina } = useContratos();
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState('');
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null);

  const handleEliminar = async (id: string) => {
    const result = await eliminarContrato(id);
    if (result.success) {
      setConfirmarEliminar(null);
    }
  };

  const handleFiltrar = () => {
    setFiltros({ ...filtros, empleadoId: empleadoSeleccionado });
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
            Gestión de <span className="text-blue-600">Contratos</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Historial laboral y documentos oficiales
          </p>
        </div>

        <Link
          href="/rrhh/contratos/nuevo"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide shadow-lg transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          Nuevo Contrato
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl p-4 border border-slate-200">
        <div className="flex-1 min-w-[200px]">
          <select
            value={empleadoSeleccionado}
            onChange={(e) => setEmpleadoSeleccionado(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm"
          >
            <option value="">Todos los empleados</option>
            {empleados.filter(e => e.activo).map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.nombre_completo}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleFiltrar}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2"
        >
          <Filter size={14} />
          Filtrar
        </button>

        <button
          onClick={() => setFiltros({ empleadoId: '', vigente: '' })}
          className="text-xs text-slate-500 hover:text-blue-600"
        >
          Limpiar filtros
        </button>
      </div>

      {/* Listado de contratos */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : contratos.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <FileText size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No hay contratos registrados</p>
          <Link href="/rrhh/contratos/nuevo" className="mt-3 inline-block text-blue-600 text-sm font-bold">
            + Crear primer contrato
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contratos.map((contrato) => (
              <ContratoCard
                key={contrato.id}
                contrato={contrato}
                onDelete={eliminarContrato}
              />
            ))}
          </div>

          {/* Paginación */}
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
    </div>
  );
}