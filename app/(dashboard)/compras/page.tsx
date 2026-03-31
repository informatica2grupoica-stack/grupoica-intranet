"use client";
import { useEffect, useState } from "react";
import { Search, RefreshCcw, Download } from "lucide-react";

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const loadOC = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/obuma/oc');
      const data = await res.json();
      // Validamos si viene directo o en la propiedad data
      const listado = Array.isArray(data) ? data : (data.data || []);
      setOrdenes(listado);
    } catch (err) {
      console.error("Error cargando OC:", err);
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
    <div className="p-8 space-y-6">
      {/* Encabezado */}
      <div className="flex justify-between items-center bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Órdenes de Compra</h1>
          <p className="text-sm text-slate-400">Gestión directa con Obuma ERP</p>
        </div>
        <button onClick={loadOC} className="p-3 hover:bg-slate-50 rounded-full transition-all">
          <RefreshCcw className={`w-6 h-6 text-blue-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
        <input 
          type="text" 
          placeholder="Buscar por folio o proveedor..." 
          className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm"
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              <th className="px-8 py-5">Folio</th>
              <th className="px-8 py-5">Fecha</th>
              <th className="px-8 py-5">Proveedor</th>
              <th className="px-8 py-5 text-right">Total</th>
              <th className="px-8 py-5 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="p-20 text-center text-slate-300 animate-pulse font-medium">Sincronizando con Obuma...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-medium">No se encontraron órdenes de compra.</td></tr>
            ) : filtered.map((oc) => (
              <tr key={oc.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-5 font-bold text-slate-700">{oc.ocNumber}</td>
                <td className="px-8 py-5 text-slate-500">
                  {oc.fecha ? new Date(oc.fecha).toLocaleDateString('dd-mm-yyyy').replace(/\//g, '-') : '-'}
                </td>
                <td className="px-8 py-5 text-slate-600 font-medium">{oc.proveedorId}</td>
                <td className="px-8 py-5 text-right font-bold text-slate-800">
                  ${Number(oc.total).toLocaleString('es-CL')}
                </td>
                <td className="px-8 py-5 text-center">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold border ${
                    oc.estado === 'EMITIDA' 
                      ? 'bg-emerald-50 text-emerald-500 border-emerald-100' 
                      : 'bg-blue-50 text-blue-500 border-blue-100'
                  }`}>
                    {oc.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}