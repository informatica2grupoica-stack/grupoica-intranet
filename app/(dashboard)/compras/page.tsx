// app/(dashboard)/compras/page.tsx
"use client";
import { useEffect, useState } from "react";
import { 
  RefreshCcw, ShoppingBag, Search, ChevronLeft, ChevronRight, 
  Eye, Package, X, Loader2, Building2, Calendar, DollarSign,
  AlertCircle  // 👈 ESTO ES LO QUE FALTABA
} from "lucide-react";

interface ProductoOC {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  sku: string;
  unidad: string;
}

interface DetalleOC {
  id: string;
  folio: string;
  fecha: string;
  fecha_emision: string;
  estado: string;
  total: number;
  proveedor: {
    id: string;
    rut: string;
    razon_social: string;
    direccion: string;
  };
  productos: ProductoOC[];
  observacion: string;
}

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Estados para el modal de detalle
  const [detalleModal, setDetalleModal] = useState<{
    visible: boolean;
    loading: boolean;
    data: DetalleOC | null;
  }>({ visible: false, loading: false, data: null });

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

  // Función para ver el detalle de una OC
  const verDetalle = async (ocId: string) => {
    setDetalleModal({ visible: true, loading: true, data: null });
    
    try {
      const res = await fetch(`/api/obuma/oc/${ocId}`);
      const data = await res.json();
      
      if (res.ok) {
        setDetalleModal({ visible: true, loading: false, data });
      } else {
        console.error("Error:", data.error);
        setDetalleModal({ visible: true, loading: false, data: null });
      }
    } catch (error) {
      console.error("Error al obtener detalle:", error);
      setDetalleModal({ visible: true, loading: false, data: null });
    }
  };

  useEffect(() => { loadData(); }, []);

  const formatearFecha = (fechaRaw: string | null) => {
    if (!fechaRaw) return '-';
    const fechaParte = fechaRaw.split(' ')[0];
    const [year, month, day] = fechaParte.split('-');
    return `${day}-${month}-${year}`;
  };

  const formatearPrecio = (precio: number) => {
    return `$${precio.toLocaleString('es-CL')}`;
  };

  const filteredOrdenes = ordenes.filter((oc) => {
    const term = searchTerm.toLowerCase();
    return (
      oc.compra_oc_folio?.toString().includes(term) ||
      oc.compra_oc_estado?.toLowerCase().includes(term) ||
      (oc.compra_oc_referencia && oc.compra_oc_referencia.toLowerCase().includes(term))
    );
  });

  const totalPages = Math.ceil(filteredOrdenes.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredOrdenes.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="space-y-6 p-6">
      {/* Header con Buscador */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#ECFDF5] rounded-2xl text-[#059669]">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Órdenes de Compra</h1>
            <p className="text-[10px] text-slate-400">Visualiza y exporta detalles de productos comprados</p>
          </div>
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
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/20 transition-all"
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
                <th className="px-8 py-5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="p-20 text-center animate-pulse text-slate-400">Sincronizando...</td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center text-slate-400 text-sm">No se encontraron resultados.</td></tr>
              ) : (
                currentItems.map((oc: any) => (
                  <tr key={oc.compra_oc_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5 font-bold text-[#059669]">#{oc.compra_oc_folio}</td>
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
                        {oc.compra_oc_estado || 'PENDIENTE'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <button
                        onClick={() => verDetalle(oc.compra_oc_id)}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-[#D1FAE5] text-slate-500 hover:text-[#059669] transition-all"
                        title="Ver productos"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
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

      {/* MODAL DE DETALLE DE OC */}
      {detalleModal.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Header del modal */}
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Detalle de Orden de Compra</h2>
                {detalleModal.data && (
                  <p className="text-[10px] text-slate-400 font-mono mt-1">
                    Folio #{detalleModal.data.folio} • {detalleModal.data.estado}
                  </p>
                )}
              </div>
              <button 
                onClick={() => setDetalleModal({ visible: false, loading: false, data: null })} 
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="flex-1 overflow-y-auto p-6">
              {detalleModal.loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-[#059669]" size={40} />
                </div>
              ) : detalleModal.data ? (
                <div className="space-y-6">
                  {/* Información del proveedor */}
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Building2 size={18} className="text-[#059669]" />
                      <h3 className="font-bold text-slate-800">Proveedor</h3>
                    </div>
                    <p className="font-medium text-slate-800">{detalleModal.data.proveedor.razon_social}</p>
                    <p className="text-xs text-slate-500 font-mono mt-1">{detalleModal.data.proveedor.rut}</p>
                    {detalleModal.data.proveedor.direccion && (
                      <p className="text-xs text-slate-400 mt-2">{detalleModal.data.proveedor.direccion}</p>
                    )}
                  </div>

                  {/* Fechas */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Fecha Emisión</span>
                      </div>
                      <p className="text-sm font-medium">{formatearFecha(detalleModal.data.fecha_emision)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={14} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                      </div>
                      <p className="text-lg font-black text-emerald-600">{formatearPrecio(detalleModal.data.total)}</p>
                    </div>
                  </div>

                  {/* Tabla de productos */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Package size={16} className="text-[#059669]" />
                      <h3 className="font-bold text-slate-800">Productos Comprados</h3>
                      <span className="text-xs text-slate-400">({detalleModal.data.productos.length} items)</span>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Producto</th>
                            <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase">Cantidad</th>
                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase">Precio Unit.</th>
                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detalleModal.data.productos.map((prod, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-700">{prod.nombre}</p>
                                {prod.sku && <p className="text-[9px] text-slate-400">SKU: {prod.sku}</p>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {prod.cantidad} {prod.unidad}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {formatearPrecio(prod.precio_unitario)}
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {formatearPrecio(prod.subtotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-600">Total:</td>
                            <td className="px-4 py-3 text-right font-black text-emerald-600">
                              {formatearPrecio(detalleModal.data.total)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {detalleModal.data.observacion && (
                    <div className="bg-amber-50 rounded-xl p-4">
                      <p className="text-xs text-amber-700">
                        <strong>Observación:</strong> {detalleModal.data.observacion}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20">
                  <AlertCircle size={40} className="mx-auto text-red-300 mb-4" />
                  <p className="text-slate-500">No se pudo cargar el detalle de esta orden</p>
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setDetalleModal({ visible: false, loading: false, data: null })} 
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}