"use client";
import { useEffect, useState } from "react";
import { Search, Download, RefreshCcw, CheckCircle2, Clock, FileText } from "lucide-react";

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const loadOC = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/obuma/oc');
      const data = await res.json();
      setOrdenes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOC(); }, []);

  const filtered = ordenes.filter(o => 
    (o.ocNumber || "").toString().includes(filter) ||
    (o.proveedorId || "").toString().includes(filter)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Órdenes de Compra</h1>
          <p className="text-xs text-slate-400 font-medium">Panel de Control Central Mayorista</p>
        </div>
        <button onClick={loadOC} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
          <RefreshCcw className={`w-5 h-5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Filtrar por folio o ID de proveedor..." 
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500/10"
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <th className="px-6 py-4">Documento</th>
              <th className="px-6 py-4">ID Proveedor</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="p-20 text-center text-slate-400 animate-pulse">Cargando datos de Obuma...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-20 text-center text-slate-400">No hay registros para mostrar.</td></tr>
            ) : filtered.map((oc) => (
              <tr key={oc.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">OC #{oc.ocNumber}</span>
                    <span className="text-[10px] text-slate-400">{oc.fecha?.split('T')[0]}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-600">
                  ID: {oc.proveedorId}
                </td>
                <td className="px-6 py-4 text-sm font-bold text-blue-600">
                  ${Number(oc.total).toLocaleString('es-CL')}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 uppercase">
                    {oc.estado}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <a 
                    href={`https://www.obuma.cl/compras/orden-compra/imprimir/${oc.id}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl inline-block transition-all"
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