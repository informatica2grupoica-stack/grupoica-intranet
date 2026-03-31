"use client";
import { useEffect, useState } from "react";
import { RefreshCcw, Search, FileText } from "lucide-react";

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOC = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/obuma/oc');
      const json = await res.json();
      
      // Accedemos a json.data porque lo normalizamos en el backend
      if (json.success && Array.isArray(json.data)) {
        setOrdenes(json.data);
      } else {
        setOrdenes([]);
      }
    } catch (err) {
      console.error("Error cargando OCs:", err);
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOC(); }, []);

  return (
    <div className="p-8 space-y-6">
      {/* Header Estilo Central Mayorista */}
      <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Órdenes de Compra</h1>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Módulo de Abastecimiento</p>
        </div>
        <button 
          onClick={loadOC} 
          className="p-3 hover:bg-slate-50 rounded-full transition-colors group"
          title="Refrescar datos"
        >
          <RefreshCcw className={`w-5 h-5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabla de Datos */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <th className="px-8 py-5">Folio / OC</th>
              <th className="px-8 py-5">Fecha Emisión</th>
              <th className="px-8 py-5">Proveedor (ID)</th>
              <th className="px-8 py-5 text-right">Monto Total</th>
              <th className="px-8 py-5 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="p-24 text-center animate-pulse text-slate-400 font-medium">Sincronizando con Obuma ERP...</td></tr>
            ) : ordenes.length === 0 ? (
              <tr><td colSpan={5} className="p-24 text-center text-slate-400">No se encontraron órdenes de compra</td></tr>
            ) : ordenes.map((oc: any) => (
              <tr key={oc.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-8 py-5">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-700 text-base">#{oc.ocNumber || oc.folio_dcto || oc.id}</span>
                  </div>
                </td>
                <td className="px-8 py-5 text-slate-500 font-medium">
                  {oc.fecha ? new Date(oc.fecha).toLocaleDateString('es-CL') : '-'}
                </td>
                <td className="px-8 py-5 text-slate-600">
                   ID: {oc.proveedorId || oc.proveedor}
                </td>
                <td className="px-8 py-5 text-right font-bold text-slate-900 text-base">
                  ${Number(oc.total).toLocaleString('es-CL')}
                </td>
                <td className="px-8 py-5 text-center">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold border uppercase ${
                    oc.estado === 'EMITIDA' || oc.estado === '1'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                      : 'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {oc.estado || 'PENDIENTE'}
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