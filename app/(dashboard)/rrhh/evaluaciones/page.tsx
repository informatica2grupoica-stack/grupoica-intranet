// app/(dashboard)/rrhh/evaluaciones/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRrhh } from '@/app/hooks/useRrhh';
import { useEvaluaciones } from '@/app/hooks/useEvaluaciones';
import { useAuth } from '@/app/hooks/useAuth';
import { Plus, Loader2, Filter, Eye, Edit3, Trash2, Star } from 'lucide-react';
import EvaluacionCard from '@/app/components/rrhh/EvaluacionCard';
import PaginacionRRHH from '@/app/components/rrhh/PaginacionRRHH';

export default function EvaluacionesPage() {
  const { empleados } = useRrhh();
  const { evaluaciones, loading, pagination, filtros, setFiltros, eliminarEvaluacion, cambiarPagina } = useEvaluaciones();
  const { perfil } = useAuth();
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null);

  const periodos = [
    { value: '', label: 'Todos los períodos' },
    { value: 'Q1', label: '1er Trimestre' },
    { value: 'Q2', label: '2do Trimestre' },
    { value: 'Q3', label: '3er Trimestre' },
    { value: 'Q4', label: '4to Trimestre' },
    { value: 'semestral', label: 'Semestral' },
    { value: 'anual', label: 'Anual' },
  ];

  const handleEliminar = async (id: string) => {
    const result = await eliminarEvaluacion(id);
    if (result.success) {
      setConfirmarEliminar(null);
    }
  };

  if (loading && evaluaciones.length === 0) {
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
            Evaluaciones de <span className="text-blue-600">Desempeño</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Seguimiento y desarrollo del talento
          </p>
        </div>

        <Link
          href="/rrhh/evaluaciones/nueva"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide shadow-lg transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          Nueva Evaluación
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl p-4 border border-slate-200">
        <div className="flex-1 min-w-[200px]">
          <select
            value={filtros.empleadoId}
            onChange={(e) => setFiltros({ ...filtros, empleadoId: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm"
          >
            <option value="">Todos los empleados</option>
            {empleados?.filter(e => e.activo).map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.nombre_completo}</option>
            ))}
          </select>
        </div>

        <select
          value={filtros.periodo}
          onChange={(e) => setFiltros({ ...filtros, periodo: e.target.value })}
          className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm"
        >
          {periodos.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <button
          onClick={() => setFiltros({ empleadoId: '', evaluadorId: '', periodo: '' })}
          className="text-xs text-slate-500 hover:text-blue-600"
        >
          Limpiar filtros
        </button>
      </div>

      {/* Listado */}
      {evaluaciones.length === 0 && !loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Star size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No hay evaluaciones registradas</p>
          <Link href="/rrhh/evaluaciones/nueva" className="mt-3 inline-block text-blue-600 text-sm font-bold">
            + Crear primera evaluación
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {evaluaciones.map((evalucion) => (
            <EvaluacionCard
              key={evalucion.id}
              evaluacion={evalucion}
              onDelete={eliminarEvaluacion}
            />
          ))}
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
    </div>
  );
}