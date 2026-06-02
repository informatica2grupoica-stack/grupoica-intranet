"use client";
import React, { useState, useEffect } from "react";
import {
  RefreshCcw,
  Loader2,
  Sparkles,
  Clock
} from "lucide-react";

// Componentes internos
import StatsCards from "./components/StatsCards";
import ProductosChart from "./components/ProductosChart";
import StockChart from "./components/StockChart";
import AlertasStock from "./components/AlertasStock";
import InsightsIA from "./components/InsightsIA";

interface DashboardData {
  stats: {
    total_productos: number;
    total_stock: number;
    total_valor_inventario: number;
    productos_con_stock_bajo: number;
    productos_sin_stock: number;
    categorias_count: number;
    precio_promedio: number;
  };
  ultima_sincronizacion: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargarDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      const result = await res.json();
      if (result.success) {
        setData(result);
      }
    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const actualizarDatos = async () => {
    setRefreshing(true);
    await cargarDashboard();
  };

  useEffect(() => {
    cargarDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="relative mb-5 inline-block">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center shadow-lg shadow-emerald-900/20">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <Loader2 className="w-20 h-20 animate-spin text-[#059669]/30 absolute -top-3 -left-3" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">Cargando dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">

      {/* ── Banner de cabecera ───────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#111827] p-6 md:p-7 shadow-xl shadow-slate-900/20">
        <div className="absolute -top-16 -right-8 w-64 h-64 bg-[#10B981]/20 blur-[90px] rounded-full" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#D1FAE5] text-[#059669] px-2.5 py-1 rounded-full">
              <Sparkles className="w-3 h-3" /> Análisis en tiempo real
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white mt-3 leading-tight">
              Dashboard de <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#10B981] to-[#34D399]">Inventario</span>
            </h1>
            {data && (
              <p className="text-slate-400 text-xs mt-1.5 flex items-center gap-1.5">
                <Clock size={12} /> Última sincronización: {new Date(data.ultima_sincronizacion).toLocaleString('es-CL')}
              </p>
            )}
          </div>

          <button
            onClick={actualizarDatos}
            disabled={refreshing}
            className="self-start md:self-center bg-gradient-to-r from-[#059669] to-[#10B981] hover:shadow-lg hover:shadow-emerald-900/30 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Actualizar
          </button>
        </div>
      </div>

      {/* Tarjetas de KPIs */}
      {data && <StatsCards stats={data.stats} />}

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProductosChart />
        <StockChart />
      </div>

      {/* Alertas e Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertasStock />
        <InsightsIA stats={data?.stats} />
      </div>
    </div>
  );
}
