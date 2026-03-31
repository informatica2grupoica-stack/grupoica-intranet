"use client";
import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOC = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/obuma/oc');
      const json = await res.json();
      
      // IMPORTANTE: Ahora entramos a json.data porque el backend lo normalizó así
      if (json.success && Array.isArray(json.data)) {
        setOrdenes(json.data);
      } else {
        setOrdenes([]);
      }
    } catch (err) {
      console.error("Error cargando OC:", err);
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOC(); }, []);

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-[30px] border border-slate-100 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Órdenes de Compra</h1>
        <button onClick={loadOC} className="p-2 hover:bg-slate-50 rounded-full">
          <RefreshCcw className={`w-5 h-5 text-blue-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              <th className="px-6 py-4">Folio</th>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Proveedor</th>
              <th className="px-6 py-4 text-right">Total</th>
              <th className="px-6 py-4 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="p-20 text-center animate-pulse text-slate-400">Sincronizando...</td></tr>
            ) : ordenes.length === 0 ? (
              <tr><td colSpan={5} className="p-20 text-center text-slate-400">No hay datos disponibles</td></tr>
            ) : ordenes.map((oc: any) => (
              <tr key={oc.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-700">{oc.ocNumber}</td>
                <td className="px-6 py-4 text-slate-500">{oc.fecha?.split('T')[0]}</td>
                <td className="px-6 py-4 text-slate-600">{oc.proveedorId}</td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">
                  ${Number(oc.total || 0).toLocaleString('es-CL')}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100 uppercase">
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