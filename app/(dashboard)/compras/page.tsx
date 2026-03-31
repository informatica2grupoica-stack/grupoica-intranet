"use client";
import { useEffect, useState } from "react";
import { RefreshCcw, ShoppingBag, Calendar } from "lucide-react";

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/obuma/oc');
      const json = await res.json();
      
      // Validamos la estructura que me pasaste
      if (json && json.data && Array.isArray(json.data)) {
        setOrdenes(json.data);
      }
    } catch (err) {
      console.error("Error cargando compras:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-2xl text-[#00338d]">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Órdenes de Compra</h1>
        </div>
        <button onClick={loadData} className="p-2 hover:bg-slate-50 rounded-full">
          <RefreshCcw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-8 py-5">Folio</th>
              <th className="px-8 py-5">Fecha</th>
              <th className="px-8 py-5">Referencia</th>
              <th className="px-8 py-5 text-right">Total</th>
              <th className="px-8 py-5 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="p-20 text-center animate-pulse">Cargando datos...</td></tr>
            ) : ordenes.length === 0 ? (
              <tr><td colSpan={5} className="p-20 text-center text-slate-400">No hay órdenes registradas.</td></tr>
            ) : (
              ordenes.map((oc: any) => (
                <tr key={oc.compra_oc_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5 font-bold text-slate-700">#{oc.compra_oc_folio}</td>
                  <td className="px-8 py-5 text-sm text-slate-500">{oc.compra_oc_fecha_ingreso?.split(' ')[0]}</td>
                  <td className="px-8 py-5 text-sm text-slate-600 italic">{oc.compra_oc_referencia || 'Sin ref.'}</td>
                  <td className="px-8 py-5 text-right font-black text-slate-900">
                    ${Number(oc.compra_oc_total).toLocaleString('es-CL')}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                      {oc.compra_oc_estado}
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