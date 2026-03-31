"use client";
import { useEffect, useState } from "react";
import { RefreshCcw, ShoppingBag } from "lucide-react";

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/obuma/oc');
      const json = await res.json();
      // Si success es true, cargamos json.data (igual que haces en productos)
      if (json.success) {
        setOrdenes(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-2xl">
            <ShoppingBag className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Órdenes de Compra</h1>
            <p className="text-xs text-slate-400">Sincronizado con Obuma ERP</p>
          </div>
        </div>
        <button 
          onClick={loadData}
          className="p-2 hover:bg-slate-50 rounded-full transition-colors"
        >
          <RefreshCcw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <th className="px-8 py-5">Folio</th>
              <th className="px-8 py-5">Fecha</th>
              <th className="px-8 py-5 text-right">Total</th>
              <th className="px-8 py-5 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={4} className="p-20 text-center animate-pulse text-slate-400">Cargando...</td></tr>
            ) : ordenes.length === 0 ? (
              <tr><td colSpan={4} className="p-20 text-center text-slate-400 font-medium">No se encontraron órdenes de compra.</td></tr>
            ) : (
              ordenes.map((oc: any) => (
                <tr key={oc.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5 font-bold text-slate-700">#{oc.ocNumber || oc.id}</td>
                  <td className="px-8 py-5 text-slate-500">
                    {oc.fecha ? new Date(oc.fecha).toLocaleDateString('es-CL') : '-'}
                  </td>
                  <td className="px-8 py-5 text-right font-bold text-slate-900">
                    ${Number(oc.total || 0).toLocaleString('es-CL')}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100 uppercase">
                      {oc.estado || 'Emitida'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}