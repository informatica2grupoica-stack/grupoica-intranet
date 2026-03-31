"use client";
import { useEffect, useState } from "react";
import { 
  Search, 
  Download, 
  RefreshCcw,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface OrdenCompra {
  oc_id: number;
  oc_folio: string;
  oc_fecha: string;
  proveedor_razon_social: string;
  oc_total: string | number;
  oc_estado: string;
}

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const loadOC = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/obuma/oc');
      const data = await res.json();
      setOrdenes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOC(); }, []);

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s.includes("APROBADA")) return <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 text-[10px] font-bold"><CheckCircle2 className="w-3 h-3"/> {s}</span>;
    if (s.includes("SOLICITADA")) return <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 text-[10px] font-bold"><Clock className="w-3 h-3"/> {s}</span>;
    return <span className="flex items-center gap-1 text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold"><AlertCircle className="w-3 h-3"/> {s}</span>;
  };

  const filtered = ordenes.filter(o => 
    o.proveedor_razon_social?.toLowerCase().includes(filter.toLowerCase()) || 
    o.oc_folio?.toString().includes(filter)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Órdenes de Compra</h1>
          <p className="text-xs text-slate-400 font-medium">Gestión directa con Obuma ERP</p>
        </div>
        <button onClick={loadOC} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
          <RefreshCcw className={`w-5 h-5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Buscar por folio o proveedor..." 
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-50">
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documento</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proveedor</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [1,2,3].map(i => <tr key={i} className="animate-pulse"><td colSpan={5} className="p-10"></td></tr>)
            ) : filtered.map((oc) => (
              <tr key={oc.oc_id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">Folio {oc.oc_folio}</span>
                    <span className="text-[10px] text-slate-400">{oc.oc_fecha}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-600">{oc.proveedor_razon_social}</td>
                <td className="px-6 py-4 text-sm font-bold text-blue-600">
                  ${Number(oc.oc_total).toLocaleString('es-CL')}
                </td>
                <td className="px-6 py-4">{getStatusBadge(oc.oc_estado)}</td>
                <td className="px-6 py-4 text-right">
                  <a 
                    href={`https://www.obuma.cl/compras/orden-compra/imprimir/${oc.oc_id}`} 
                    target="_blank" 
                    className="inline-flex p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}