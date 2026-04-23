// components/rrhh/FiltrosEmpleados.tsx
'use client';
import { Search, Filter, X } from 'lucide-react';

interface FiltrosEmpleadosProps {
  filtros: {
    search: string;
    estado: string;
    area: string;
  };
  setFiltros: (filtros: any) => void;
  areasDisponibles: string[];
}

export default function FiltrosEmpleados({ filtros, setFiltros, areasDisponibles }: FiltrosEmpleadosProps) {
  const estados = [
    { value: '', label: 'Todos los estados' },
    { value: 'activo', label: 'Activos' },
    { value: 'vacaciones', label: 'Vacaciones' },
    { value: 'licencia', label: 'Licencia' },
    { value: 'despedido', label: 'Despedidos' },
    { value: 'renuncio', label: 'Renunciaron' },
  ];

  const limpiarFiltros = () => {
    setFiltros({ search: '', estado: '', area: '' });
  };

  const tieneFiltrosActivos = filtros.search || filtros.estado || filtros.area;

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={filtros.search}
            onChange={(e) => setFiltros({ ...filtros, search: e.target.value })}
            placeholder="Buscar por nombre, RUT o email..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filtro por estado */}
        <select
          value={filtros.estado}
          onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
          className="bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          {estados.map((est) => (
            <option key={est.value} value={est.value}>{est.label}</option>
          ))}
        </select>

        {/* Filtro por área */}
        {areasDisponibles.length > 0 && (
          <select
            value={filtros.area}
            onChange={(e) => setFiltros({ ...filtros, area: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">Todas las áreas</option>
            {areasDisponibles.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        )}

        {/* Botón limpiar filtros */}
        {tieneFiltrosActivos && (
          <button
            onClick={limpiarFiltros}
            className="flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
          >
            <X size={14} />
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}