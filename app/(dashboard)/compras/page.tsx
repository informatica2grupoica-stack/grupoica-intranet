"use client";
import { useEffect, useState } from "react";
import { Search, Download, RefreshCcw } from "lucide-react";

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const loadOC = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/obuma/oc');
      const data = await res.json();
      // Si la data viene en un array dentro de un objeto, lo extraemos
      const listado = Array.isArray(data) ? data : (data.data || []);
      setOrdenes(listado);
    } catch (err) {
      console.error("Error cargando órdenes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOC(); }, []);

  // Formato de fecha para que se vea DD-MM-YYYY como en tu imagen
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-');
  };

  const filtered = ordenes.filter(o => 
    (o.ocNumber || "").toString().includes(filter) ||
    (o.proveedorId || "").toString().includes(filter)
  );

  return (
    <div className="p-8 space-y-6 bg-[#f8fafc] min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Ordenes de Compras</h1>
        <div className="flex gap-2">
          <button onClick={loadOC} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCcw className={`w-5 h-5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por OC..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400">
              <th className="px-6 py-4">Folio</th>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Proveedor</th>
              <th className="px-6 py-4 text-right">Total</th>
              <th className="px-6 py-4 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="p-10 text-center text-slate-400">Cargando datos...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center text-slate-400">No hay órdenes para mostrar</td></tr>
            ) : filtered.map((oc) => (
              <tr key={oc.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 font-bold text-slate-700">{oc.ocNumber}</td>
                <td className="px-6 py-4 text-slate-500">{formatDate(oc.fecha)}</td>
                <td className="px-6 py-4 text-slate-600">{oc.proveedorId}</td>
                <td className="px-6 py-4 text-right font-bold text-slate-700">
                  ${Number(oc.total).toLocaleString('es-CL')}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                    oc.estado === 'EMITIDA' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
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