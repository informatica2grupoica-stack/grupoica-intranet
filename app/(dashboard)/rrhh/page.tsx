// app/(dashboard)/rrhh/page.tsx
'use client';
import { useState } from 'react';
import { useRrhh } from '@/app/hooks/useRrhh';
import EstadisticasRRHH from '@/app/components/rrhh/EstadisticasRRHH';
import DashboardAvanzado from '@/app/components/rrhh/DashboardAvanzado';
import { Loader2, RefreshCw, BarChart3, PieChart } from 'lucide-react';

type TipoVista = 'basico' | 'avanzado';

export default function RRHHDashboardPage() {
  const { estadisticas, loading, cargarEstadisticas } = useRrhh();
  const [vista, setVista] = useState<TipoVista>('avanzado');

  if (loading && !estadisticas) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (!estadisticas) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">No se pudieron cargar las estadísticas</p>
        <button 
          onClick={() => cargarEstadisticas()} 
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic">
            Dashboard <span className="text-blue-600">RRHH</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Visión general del talento humano
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setVista('basico')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                vista === 'basico' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <PieChart size={14} />
              Básico
            </button>
            <button
              onClick={() => setVista('avanzado')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                vista === 'avanzado' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <BarChart3 size={14} />
              Avanzado
            </button>
          </div>

          <button
            onClick={() => cargarEstadisticas()}
            className="p-2 text-slate-500 hover:text-blue-600 transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Estadísticas según vista */}
      {vista === 'basico' ? (
        <EstadisticasRRHH stats={estadisticas} />
      ) : (
        <DashboardAvanzado />
      )}
    </div>
  );
}