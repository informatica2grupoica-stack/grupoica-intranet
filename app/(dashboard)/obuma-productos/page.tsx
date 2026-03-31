"use client";
import { useState, useEffect } from "react";
import { Search, Plus, Loader2, ChevronLeft, ChevronRight, Edit2, Save, X } from "lucide-react";
import Link from "next/link";

export default function ObumaProductosListado() {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      // Ajustamos la URL para que el buscador funcione (usando 'filter' que es común en Obuma)
      const res = await fetch(`/api/obuma/productos/list?page=${page}&filter=${encodeURIComponent(search)}`);
      const data = await res.json();
      setProductos(data.data || []);
    } catch (error) {
      console.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1); // Reiniciar a pág 1 al buscar
      fetchProductos();
    }, 600);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { fetchProductos(); }, [page]);

  const handleEditClick = (prod: any) => {
    setEditingId(prod.producto_id);
    setEditForm({
      nombre: prod.producto_nombre,
      precio_venta: prod.producto_precio_clp_total || prod.producto_precio_clp_neto * 1.19,
      incluye_iva_venta: true,
      se_puede_vender: true,
      sku: prod.producto_codigo_comercial // Solo lectura
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/obuma/productos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingId(null);
        fetchProductos();
      }
    } catch (error) {
      alert("Error al guardar");
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER Y BUSCADOR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Inventario Central</h1>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar por nombre o SKU..."
              className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none w-72 shadow-sm focus:border-[#00338d]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Link href="/obuma-productos/nuevo" className="bg-[#00338d] text-white p-3 rounded-2xl shadow-lg hover:bg-blue-800 transition-all">
            <Plus size={20} />
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest bg-slate-50/50">
              <th className="px-6 py-4">Información del Producto</th>
              <th className="px-6 py-4 text-center">SKU (Fijo)</th>
              <th className="px-6 py-4 text-right">Precio Venta</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-[#00338d]" size={32} /></td></tr>
            ) : productos.map((prod) => (
              <tr key={prod.producto_id} className={`transition-colors ${editingId === prod.producto_id ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'}`}>
                <td className="px-6 py-4">
                  {editingId === prod.producto_id ? (
                    <input 
                      className="w-full p-2 border border-blue-300 rounded-lg text-sm font-bold uppercase outline-none focus:ring-2 ring-blue-100"
                      value={editForm.nombre}
                      onChange={(e) => setEditForm({...editForm, nombre: e.target.value})}
                    />
                  ) : (
                    <div className="text-sm font-bold text-slate-700 uppercase tracking-tight">{prod.producto_nombre}</div>
                  )}
                </td>
                <td className="px-6 py-4 text-center font-mono text-xs text-slate-400">
                  {prod.producto_codigo_comercial}
                </td>
                <td className="px-6 py-4 text-right">
                  {editingId === prod.producto_id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs font-bold text-slate-400">$</span>
                      <input 
                        type="number"
                        className="w-24 p-2 border border-blue-300 rounded-lg text-sm font-bold outline-none text-right"
                        value={editForm.precio_venta}
                        onChange={(e) => setEditForm({...editForm, precio_venta: e.target.value})}
                      />
                    </div>
                  ) : (
                    <div className="font-bold text-slate-600">${Math.round(prod.producto_precio_clp_total || 0).toLocaleString('es-CL')}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center gap-2">
                    {editingId === prod.producto_id ? (
                      <>
                        <button onClick={() => handleSaveEdit(prod.producto_id)} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-md transition-all">
                          <Save size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all">
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => handleEditClick(prod)} className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-[#00338d] hover:text-white transition-all">
                        <Edit2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* PAGINACIÓN */}
        <div className="p-4 bg-slate-50/50 flex justify-between items-center border-t border-slate-100">
          <span className="text-[10px] font-black uppercase text-slate-400">Página {page}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 shadow-sm"><ChevronLeft size={18} /></button>
            <button onClick={() => setPage(p => p + 1)} className="p-2 bg-white border border-slate-200 rounded-xl shadow-sm"><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}