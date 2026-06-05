"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCcw, Loader2, Sparkles, Clock, BarChart3,
  TrendingDown, TrendingUp, Minus, Package, DollarSign,
  AlertTriangle, Users, ShoppingCart, Building2,
  Laptop, ArrowRight, CheckCircle2, XCircle
} from "lucide-react";
import Link from "next/link";
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

interface PrecioItem {
  tendencia: string;
  tienda: string;
  producto: string;
  precio_anterior: number;
  precio_actual: number;
  diferencia: number;
  sku?: string;
}

interface OCResumen {
  total: number;
  facturadas: number;
  pendientes: number;
  monto_total: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [precios, setPrecios] = useState<PrecioItem[]>([]);
  const [ocResumen, setOcResumen] = useState<OCResumen | null>(null);
  const [clientesStats, setClientesStats] = useState<any>(null);
  const [dispositivosResumen, setDispositivosResumen] = useState<any>(null);

  const cargarDashboard = useCallback(async () => {
    try {
      const [resStats, resPrecios, resOC, resCli] = await Promise.allSettled([
        fetch("/api/dashboard/stats").then((r) => r.json()),
        fetch("/api/analizar-precios").then((r) => r.json()),
        fetch("/api/obuma/oc").then((r) => r.json()),
        fetch("/api/obuma/clientes/list?estado=todos&limit=500").then((r) => r.json()),
      ]);

      if (resStats.status === "fulfilled" && resStats.value.success) {
        setData(resStats.value);
      }
      if (resPrecios.status === "fulfilled" && Array.isArray(resPrecios.value)) {
        setPrecios(resPrecios.value.slice(0, 6));
      }
      if (resOC.status === "fulfilled" && resOC.value?.data) {
        const ocs = resOC.value.data;
        setOcResumen({
          total: ocs.length,
          facturadas: ocs.filter((o: any) => o.compra_oc_estado === "FACTURADA").length,
          pendientes: ocs.filter((o: any) => !o.compra_oc_estado || o.compra_oc_estado === "PENDIENTE").length,
          monto_total: ocs.reduce((s: number, o: any) => s + Number(o.compra_oc_total || 0), 0),
        });
      }
      if (resCli.status === "fulfilled" && resCli.value?.stats) {
        setClientesStats(resCli.value.stats);
      }
    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargarDashboard(); }, [cargarDashboard]);

  const actualizarDatos = () => { setRefreshing(true); cargarDashboard(); };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="relative mb-5 inline-block">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#6366F1] flex items-center justify-center shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <Loader2 className="w-20 h-20 animate-spin text-[#4F46E5]/30 absolute -top-3 -left-3" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">Cargando dashboard…</p>
        </div>
      </div>
    );
  }

  const preciosBajas = precios.filter((p) => p.tendencia === "BAJA").length;
  const preciosSubidas = precios.filter((p) => p.tendencia === "SUBE").length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">

      {/* ── Banner cabecera ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#111827] via-[#1E293B] to-[#111827] p-6 shadow-xl">
        <div className="absolute -top-16 -right-8 w-64 h-64 bg-[#6366F1]/20 blur-[90px] rounded-full" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#EEF2FF] text-[#4F46E5] px-2.5 py-1 rounded-full">
              <Sparkles className="w-3 h-3" /> Análisis en tiempo real
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white mt-3 leading-tight">
              Dashboard de <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#818CF8]">Análisis</span>
            </h1>
            {data && (
              <p className="text-slate-400 text-xs mt-1.5 flex items-center gap-1.5">
                <Clock size={12} /> Última sync: {new Date(data.ultima_sincronizacion).toLocaleString("es-CL")}
              </p>
            )}
          </div>
          <button onClick={actualizarDatos} disabled={refreshing}
            className="self-start md:self-center bg-gradient-to-r from-[#4F46E5] to-[#6366F1] hover:shadow-lg text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Actualizar todo
          </button>
        </div>
      </div>

      {/* ── KPIs principales inventario ─────────────────────────────────── */}
      {data && <StatsCards stats={data.stats} />}

      {/* ── Fila 2: KPIs módulos secundarios ──────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* OC */}
        <Link href="/compras" className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Órdenes de Compra</p>
              <p className="text-3xl font-black text-slate-800 mt-1">{ocResumen?.total ?? "—"}</p>
            </div>
            <div className="bg-blue-100 p-2.5 rounded-xl"><ShoppingCart size={18} className="text-blue-600" /></div>
          </div>
          <div className="flex gap-3 text-[9px] font-bold">
            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={9} />{ocResumen?.facturadas ?? 0} facturadas</span>
            <span className="flex items-center gap-1 text-amber-500"><AlertTriangle size={9} />{ocResumen?.pendientes ?? 0} pendientes</span>
          </div>
          {ocResumen && (
            <p className="text-[10px] font-black text-slate-600 mt-2">${ocResumen.monto_total.toLocaleString("es-CL")}</p>
          )}
          <div className="mt-2 flex items-center gap-1 text-[9px] text-[#4F46E5] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
            Ver órdenes <ArrowRight size={10} />
          </div>
        </Link>

        {/* Clientes */}
        <Link href="/obuma-clientes" className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Clientes Obuma</p>
              <p className="text-3xl font-black text-slate-800 mt-1">{clientesStats?.total_clientes ?? "—"}</p>
            </div>
            <div className="bg-purple-100 p-2.5 rounded-xl"><Users size={18} className="text-purple-600" /></div>
          </div>
          <div className="flex gap-3 text-[9px] font-bold">
            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={9} />{clientesStats?.clientes_activos ?? 0} activos</span>
            <span className="flex items-center gap-1 text-rose-500"><XCircle size={9} />{clientesStats?.clientes_inactivos ?? 0} inactivos</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[9px] text-[#4F46E5] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
            Ver clientes <ArrowRight size={10} />
          </div>
        </Link>

        {/* Precios bajas */}
        <Link href="/historial-precios" className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Movimientos de Precio</p>
              <p className="text-3xl font-black text-slate-800 mt-1">{precios.length > 0 ? precios.length : "—"}</p>
            </div>
            <div className="bg-emerald-100 p-2.5 rounded-xl"><TrendingDown size={18} className="text-emerald-600" /></div>
          </div>
          <div className="flex gap-3 text-[9px] font-bold">
            <span className="flex items-center gap-1 text-emerald-600"><TrendingDown size={9} />{preciosBajas} bajas</span>
            <span className="flex items-center gap-1 text-rose-500"><TrendingUp size={9} />{preciosSubidas} subidas</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[9px] text-[#4F46E5] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
            Ver historial <ArrowRight size={10} />
          </div>
        </Link>

        {/* Alertas stock */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 shadow-sm border border-amber-100">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-[9px] font-black uppercase text-amber-600 tracking-widest">Alertas Stock</p>
              <p className="text-3xl font-black text-amber-700 mt-1">
                {data ? data.stats.productos_con_stock_bajo + data.stats.productos_sin_stock : "—"}
              </p>
            </div>
            <div className="bg-amber-100 p-2.5 rounded-xl"><AlertTriangle size={18} className="text-amber-600" /></div>
          </div>
          <div className="flex gap-3 text-[9px] font-bold">
            <span className="text-amber-600">{data?.stats.productos_con_stock_bajo ?? 0} stock bajo</span>
            <span className="text-rose-600">{data?.stats.productos_sin_stock ?? 0} sin stock</span>
          </div>
          <Link href="/obuma-productos" className="mt-2 flex items-center gap-1 text-[9px] text-amber-600 font-bold hover:text-amber-700">
            Revisar <ArrowRight size={10} />
          </Link>
        </div>
      </div>

      {/* ── Fila 3: Gráficos principales ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProductosChart />
        <StockChart />
      </div>

      {/* ── Fila 4: Widget historial de precios + Alertas ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Historial precios — widget */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <BarChart3 size={17} />
              </span>
              <h3 className="text-sm font-black uppercase text-slate-700">Últimos Movimientos de Precio</h3>
            </div>
            <Link href="/historial-precios" className="text-[9px] font-bold uppercase text-[#4F46E5] hover:text-[#4338CA] flex items-center gap-1">
              Ver todo <ArrowRight size={10} />
            </Link>
          </div>

          {precios.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">Sin datos de precios disponibles</div>
          ) : (
            <div className="space-y-2">
              {precios.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.tendencia === "BAJA" ? "bg-emerald-100" :
                    item.tendencia === "SUBE" ? "bg-rose-100" : "bg-slate-100"
                  }`}>
                    {item.tendencia === "BAJA" ? <TrendingDown size={14} className="text-emerald-600" /> :
                     item.tendencia === "SUBE" ? <TrendingUp size={14} className="text-rose-500" /> :
                     <Minus size={14} className="text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{item.producto}</p>
                    <p className="text-[9px] text-slate-400">{item.tienda}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-black text-slate-800">${item.precio_actual?.toLocaleString("es-CL")}</p>
                    <p className={`text-[9px] font-bold ${item.tendencia === "BAJA" ? "text-emerald-500" : item.tendencia === "SUBE" ? "text-rose-500" : "text-slate-400"}`}>
                      {item.diferencia > 0 ? "+" : ""}{item.diferencia?.toLocaleString("es-CL")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas stock */}
        <AlertasStock />
      </div>

      {/* ── Fila 5: Insights IA + accesos rápidos ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsIA stats={data?.stats} />

        {/* Accesos rápidos */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Sparkles size={17} />
            </span>
            <h3 className="text-sm font-black uppercase text-slate-700">Accesos Rápidos</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/obuma-productos", icon: Package, label: "Productos", desc: "Gestión de inventario", color: "text-[#4F46E5]", bg: "bg-[#EEF2FF]" },
              { href: "/compras", icon: ShoppingCart, label: "Compras", desc: "Órdenes de compra", color: "text-blue-600", bg: "bg-blue-100" },
              { href: "/obuma-clientes", icon: Users, label: "Clientes", desc: "CRM Obuma", color: "text-purple-600", bg: "bg-purple-100" },
              { href: "/obuma-proveedores", icon: Building2, label: "Proveedores", desc: "Gestión proveedores", color: "text-amber-600", bg: "bg-amber-100" },
              { href: "/historial-precios", icon: TrendingDown, label: "Precios", desc: "Historial inteligente", color: "text-rose-600", bg: "bg-rose-100" },
              { href: "/dispositivos", icon: Laptop, label: "Dispositivos", desc: "Inventario TI", color: "text-slate-600", bg: "bg-slate-100" },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all group">
                <div className={`p-2 rounded-lg ${item.bg}`}>
                  <item.icon size={16} className={item.color} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">{item.label}</p>
                  <p className="text-[9px] text-slate-400">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
