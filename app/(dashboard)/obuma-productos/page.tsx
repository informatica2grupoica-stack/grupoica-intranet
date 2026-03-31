"use client";
import { useState, useEffect } from "react";
import { Search, Plus, Loader2, ChevronLeft, ChevronRight, Edit2, Save, X, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ObumaProductosListado() {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // ID del producto guardándose
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      // Importante: Usamos 'filter' para que el nuevo list/route.ts lo reconozca
      const res = await fetch(`/api/obuma/productos/list?page=${page}&filter=${encodeURIComponent(search)}`);
      const result = await res.json();
      
      if (result.success) {
        setProductos(result.data || []);
      } else {
        setProductos([]);
      }
    } catch (error) {
      console.error("Error al cargar productos");
      setStatus({ type: 'error', msg: "Error de conexión con el servidor" });
    } finally {
      setLoading(false);
    }
  };

  // Debounce para no saturar la API mientras escribes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchProductos();
    }, 600);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchProductos();
  }, [page]);

  const handleEditClick = (prod: any) => {
    setEditingId(prod.producto_id);
    setEditForm({
      nombre: prod.producto_nombre,
      // Calculamos el precio total si viene solo el neto
      precio_venta: Math.round(prod.producto_precio_clp_total || prod.producto_precio_clp_neto * 1.19),
      incluye_iva_venta: true,
      se_puede_vender: prod.producto_para_venta === "1",
      se_puede_comprar: prod.producto_para_compra === "1",
      se_mantiene_stock: prod.producto_inventariable === "1"
    });
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(id);
    setStatus(null);
    try {
      const res = await fetch(`/api/obuma/productos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      
      const result = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', msg: "Producto actualizado correctamente" });
        setEditingId(null);
        fetchProductos(); // Refrescar lista para ver cambios
      } else {
        throw new Error(result.error || "Error al actualizar");
      }
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message });
    } finally {
      setSaving(null);
      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* HEADER PROFESIONAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter">
            Inventario Obuma
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Gestión Centralizada de Artículos
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00338d] transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Buscar por Nombre o SKU..."
              className="pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-[1.2rem] text-xs font-bold outline-none w-80 shadow-sm focus:border-[#00338d] focus:ring-4 focus:ring-blue-50 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Link href="/obuma-productos/nuevo" className="bg-[#00338d] hover:bg-[#00266b] text-white p-4 rounded-[1.2rem] shadow-lg transition-all active:scale-95">
            <Plus size={24} />
          </Link>
        </div>
      </div>

      {/* ALERTAS DE ESTADO */}
      {status && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
          {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="text-xs font-black uppercase tracking-tight">{status.msg}</span>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest bg-slate-50/50">
                <th className="px-8 py-5">Descripción del Producto</th>
                <th className="px-6 py-5 text-center">Código / SKU</th>
                <th className="px-6 py-5 text-right">P. Venta (Con IVA)</th>
                <th className="px-8 py-5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="animate-spin text-[#00338d]" size={40} />
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Sincronizando con Obuma...</span>
                    </div>
                  </td>
                </tr>
              ) : productos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-slate-400 font-bold uppercase text-xs">
                    No se encontraron productos para "{search}"
                  </td>
                </tr>
              ) : productos.map((prod) => (
                <tr key={prod.producto_id} className={`transition-all ${editingId === prod.producto_id ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-8 py-5">
                    {editingId === prod.producto_id ? (
                      <input 
                        autoFocus
                        className="w-full p-3 border-2 border-blue-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-[#00338d] bg-white shadow-inner"
                        value={editForm.nombre}
                        onChange={(e) => setEditForm({...editForm, nombre: e.target.value.toUpperCase()})}
                      />
                    ) : (
                      <div>
                        <div className="text-sm font-black text-slate-700 uppercase leading-tight tracking-tight">{prod.producto_nombre}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">ID: {prod.producto_id}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="px-3 py-1 bg-slate-100 rounded-lg font-mono text-[11px] font-bold text-slate-500 border border-slate-200">
                      {prod.producto_codigo_comercial}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    {editingId === prod.producto_id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm font-black text-[#00338d]">$</span>
                        <input 
                          type="number"
                          className="w-32 p-3 border-2 border-blue-200 rounded-xl text-sm font-black outline-none text-right bg-white shadow-inner"
                          value={editForm.precio_venta}
                          onChange={(e) => setEditForm({...editForm, precio_venta: e.target.value})}
                        />
                      </div>
                    ) : (
                      <div className="font-black text-slate-700 text-base">
                        ${Math.round(prod.producto_precio_clp_total || 0).toLocaleString('es-CL')}
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-center gap-3">
                      {editingId === prod.producto_id ? (
                        <>
                          <button 
                            disabled={saving === prod.producto_id}
                            onClick={() => handleSaveEdit(prod.producto_id)} 
                            className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-100 transition-all active:scale-90 disabled:opacity-50"
                          >
                            {saving === prod.producto_id ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                          </button>
                          <button 
                            onClick={() => setEditingId(null)} 
                            className="p-3 bg-white text-slate-400 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => handleEditClick(prod)} 
                          className="p-3 bg-white text-slate-400 border border-slate-100 rounded-xl hover:border-[#00338d] hover:text-[#00338d] hover:shadow-md transition-all active:scale-95"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* PAGINACIÓN ESTILO MODERNO */}
        <div className="p-6 bg-slate-50/80 flex justify-between items-center border-t border-slate-100">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
            Página actual: <span className="text-[#00338d]">{page}</span>
          </div>
          <div className="flex gap-3">
            <button 
              disabled={page === 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              className="flex items-center gap-2 px-5 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-white hover:shadow-md disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <button 
              disabled={productos.length < 10 || loading} // Asumiendo que Obuma manda 10-20 por pág
              onClick={() => setPage(p => p + 1)} 
              className="flex items-center gap-2 px-5 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-white hover:shadow-md disabled:opacity-30 transition-all"
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}