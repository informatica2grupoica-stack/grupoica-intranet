"use client";
import { useEffect, useState } from "react";
import { RefreshCcw, ShoppingBag, FileText, Calendar, DollarSign } from "lucide-react";

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/obuma/oc');
      const json = await res.json();
      // Según tu respuesta F12, los datos vienen en json.data
      if (json.success && Array.isArray(json.data)) {
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
    <div className="space-y-6">
      {/* Header Estilo Grupo ICA */}
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-2xl">
            <ShoppingBag className="w-6 h-6 text-[#00338d]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Órdenes de Compra</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Obuma ERP Sync</p>
          </div>
        </div>
        <button 
          onClick={loadData}
          className="p-2 hover:bg-slate-50 rounded-full transition-all active:scale-95"
        >
          <RefreshCcw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabla con los nombres exactos de tu JSON */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5">Folio</th>
                <th className="px-8 py-5">Fecha Ingreso</th>
                <th className="px-8 py-5">Referencia / Concepto</th>
                <th className="px-8 py-5 text-right">Total</th>
                <th className="px-8 py-5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="p-24 text-center animate-pulse text-slate-400 font-medium">Obteniendo registros de Obuma...</td></tr>
              ) : ordenes.length === 0 ? (
                <tr><td colSpan={5} className="p-24 text-center text-slate-400 font-medium">No se encontraron órdenes de compra disponibles.</td></tr>
              ) : (
                ordenes.map((oc: any) => (
                  <tr key={oc.compra_oc_id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700 text-base">#{oc.compra_oc_folio}</span>
                        <span className="text-[10px] text-slate-400">ID: {oc.compra_oc_id}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        <span className="text-sm">{oc.compra_oc_fecha_ingreso?.split(' ')[0]}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col max-w-[250px]">
                        <span className="text-sm font-medium text-slate-700 truncate">
                          {oc.compra_oc_referencia || 'Sin referencia'}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase italic">
                          {oc.compra_oc_concepto}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="font-black text-slate-900 text-base">
                        ${Number(oc.compra_oc_total).toLocaleString('es-CL')}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold border uppercase ${
                        oc.compra_oc_estado === 'FACTURADA' 
                          ? 'bg-blue-50 text-blue-600 border-blue-100' 
                          : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
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
    </div>
  );
}