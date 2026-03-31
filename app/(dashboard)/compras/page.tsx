"use client";
import { useEffect, useState } from "react";
import { RefreshCcw, ShoppingBag, Search } from "lucide-react";

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/obuma/oc');
      if (!res.ok) throw new Error("Fallo en la carga del API interna");
      
      const json = await res.json();
      
      // Validamos la estructura del JSON que nos entrega Obuma
      if (json && json.data && Array.isArray(json.data)) {
        setOrdenes(json.data);
      } else {
        setOrdenes([]);
      }
    } catch (err: any) {
      console.error("Error cargando compras:", err);
      setError("No se pudieron cargar las órdenes. Revisa la consola.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-2xl text-[#00338d]">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Órdenes de Compra</h1>
            <p className="text-xs text-slate-400">Gestión de adquisiciones Obuma</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={loadData} 
            disabled={loading}
            className="p-2 hover:bg-slate-50 rounded-full transition-colors disabled:opacity-50"
          >
            <RefreshCcw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden text-slate-800">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-8 py-5">Folio</th>
              <th className="px-8 py-5">Fecha</th>
              <th className="px-8 py-5">Referencia / Observación</th>
              <th className="px-8 py-5 text-right">Total</th>
              <th className="px-8 py-5 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-20 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="text-sm font-medium text-slate-400">Sincronizando con Obuma...</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="p-20 text-center text-red-500 text-sm font-medium">
                  {error}
                </td>
              </tr>
            ) : ordenes.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-20 text-center text-slate-400 text-sm">
                  No se encontraron órdenes de compra registradas.
                </td>
              </tr>
            ) : (
              ordenes.map((oc: any) => (
                <tr key={oc.compra_oc_id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5 font-bold text-[#00338d]">
                    #{oc.compra_oc_folio}
                  </td>
                  <td className="px-8 py-5 text-sm">
                    <div className="flex flex-col">
                      <span className="text-slate-700 font-medium">{oc.compra_oc_fecha_ingreso?.split(' ')[0]}</span>
                      <span className="text-[10px] text-slate-400">{oc.compra_oc_fecha_ingreso?.split(' ')[1]}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col max-w-xs">
                      <span className="text-sm font-semibold truncate text-slate-700">
                        {oc.compra_oc_referencia || 'Sin Referencia'}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate italic">
                        {oc.compra_oc_observacion || 'Sin observaciones'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className="font-black text-slate-900">
                      ${Number(oc.compra_oc_total).toLocaleString('es-CL')}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                      oc.compra_oc_estado === 'FACTURADA' 
                        ? 'bg-green-50 text-green-600 border-green-100' 
                        : 'bg-amber-50 text-amber-600 border-amber-100'
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
  );
}