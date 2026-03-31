"use client";
import { useEffect, useState } from "react";
import { RefreshCcw, ShoppingBag, Search, ChevronLeft, ChevronRight } from "lucide-react";

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Estados para Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/obuma/oc');
      const json = await res.json();
      if (json && json.data && Array.isArray(json.data)) {
        setOrdenes(json.data);
      }
    } catch (err: any) {
      console.error("Error cargando datos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const formatearFecha = (fechaRaw: string | null) => {
    if (!fechaRaw) return '-';
    const fechaParte = fechaRaw.split(' ')[0];
    const [year, month, day] = fechaParte.split('-');
    return `${day}-${month}-${year}`;
  };

  // --- LÓGICA DE FILTRADO ---
  const filteredOrdenes = ordenes.filter((oc) => {
    const term = searchTerm.toLowerCase();
    return (
      oc.compra_oc_folio?.toString().includes(term) ||
      oc.compra_oc_estado?.toLowerCase().includes(term) ||
      (oc.compra_oc_referencia && oc.compra_oc_referencia.toLowerCase().includes(term))
    );
  });

  // --- LÓGICA DE PAGINACIÓN ---
  const totalPages = Math.ceil(filteredOrdenes.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredOrdenes.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="space-y-6 p-6">
      {/* Header con Buscador */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-2xl text-[#00338d]">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Órdenes de Compra</h1>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar folio o estado..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Resetear a pag 1 al buscar
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <button 
            onClick={loadData} 
            disabled={loading} 
            className="p-2 hover:bg-slate-50 rounded-full transition-colors"
          >
            <RefreshCcw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden text-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-8 py-5">Folio</th>
                <th className="px-8 py-5">Fecha</th>
                <th className="px-8 py-5 text-right">Total</th>
                <th className="px-8 py-5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="p-20 text-center animate-pulse text-slate-400">Sincronizando...</td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan={4} className="p-20 text-center text-slate-400 text-sm">No se encontraron resultados.</td></tr>
              ) : (
                currentItems.map((oc: any) => (
                  <tr key={oc.compra_oc_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5 font-bold text-[#00338d]">#{oc.compra_oc_folio}</td>
                    <td className="px-8 py-5 text-sm text-slate-600">
                      {formatearFecha(oc.compra_oc_fecha_ingreso)}
                    </td>
                    <td className="px-8 py-5 text-right font-black">
                      ${Number(oc.compra_oc_total).toLocaleString('es-CL')}
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

        {/* Footer / Paginación */}
        {!loading && filteredOrdenes.length > 0 && (
          <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Mostrando {indexOfFirstItem + 1} a {Math.min(indexOfLastItem, filteredOrdenes.length)} de {filteredOrdenes.length} órdenes
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <div className="flex items-center px-4 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                Página {currentPage} de {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}