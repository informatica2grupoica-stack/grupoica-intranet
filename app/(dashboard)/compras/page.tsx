"use client";
import { useEffect, useState } from "react";
import { RefreshCcw, Search } from "lucide-react";

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const loadOC = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/obuma/oc');
      const data = await res.json();
      
      // Si recibimos un array, lo guardamos. Si no, dejamos array vacío.
      setOrdenes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error al cargar:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOC(); }, []);

  const filtered = ordenes.filter(o => 
    (o.ocNumber || "").toString().includes(busqueda) ||
    (o.proveedorId || "").toString().includes(busqueda)
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-[30px] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Órdenes de Compra</h1>
          <p className="text-xs text-slate-400">Sincronización en tiempo real</p>
        </div>
        <button onClick={loadOC} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
          <RefreshCcw className={`w-5 h-5 text-blue-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
        <input 
          type="text" 
          placeholder="Buscar por folio..." 
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/10"
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <th className="px-6 py-4">Folio</th>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Proveedor</th>
              <th className="px-6 py-4 text-right">Total</th>
              <th className="px-6 py-4 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="p-20 text-center text-slate-400 animate-pulse">Consultando Obuma ERP...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-20 text-center text-slate-400">No se encontraron registros.</td></tr>
            ) : filtered.map((oc: any) => (
              <tr key={oc.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-700">{oc.ocNumber}</td>
                <td className="px-6 py-4 text-slate-500">
                  {oc.fecha ? new Date(oc.fecha).toLocaleDateString('es-CL') : '-'}
                </td>
                <td className="px-6 py-4 text-slate-600">{oc.proveedorId}</td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">
                  ${Number(oc.total || 0).toLocaleString('es-CL')}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100 uppercase">
                    {oc.estado || 'EMITIDA'}
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