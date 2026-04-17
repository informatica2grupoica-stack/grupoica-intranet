"use client";
import React, { useState, useEffect } from "react";
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  DollarSign, 
  ShoppingCart,
  RefreshCcw,
  Loader2,
  BarChart3,
  PieChart,
  Zap
} from "lucide-react";
import Link from "next/link";

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
          <Loader2 className="animate-spin mx-auto text-[#00338d] mb-4" size={48} />
          <p className="text-slate-500">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 bg-[#f8fafc] min-h-screen">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">
            Dashboard de Productos
          </h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
            Análisis en tiempo real de tu inventario
          </p>
        </div>
        
        <button
          onClick={actualizarDatos}
          disabled={refreshing}
          className="bg-[#00338d] hover:bg-[#00266b] text-white px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
          Actualizar
        </button>
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

      {/* Footer con última sincronización */}
      {data && (
        <div className="text-center text-[9px] text-slate-400 pt-4">
          Última sincronización: {new Date(data.ultima_sincronizacion).toLocaleString('es-CL')}
        </div>
      )}
    </div>
  );
}