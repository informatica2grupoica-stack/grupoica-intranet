"use client";
import { useState, useEffect } from "react";
import { Search, Plus, Loader2, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import Link from "next/link";

interface Producto {
  producto_id: string;
  producto_nombre: string;
  producto_codigo_comercial: string;
  stock_actual: number;
  producto_precio_clp_neto: number;
}

export default function ObumaProductosListado() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/obuma/productos/list?page=${page}&search=${search}`);
      const data = await res.json();
      setProductos(data.data || []);
    } catch (error) {
      console.error("Error al cargar productos de Obuma");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchProductos(), 500);
    return () => clearTimeout(timer);
  }, [search, page]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-slate-800 uppercase italic">Productos Obuma</h1>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar productos..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none w-64 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Link 
            href="/obuma-productos/nuevo" 
            className="flex items-center gap-2 bg-[#00338d] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-blue-800 transition-all"
          >
            <Plus size={18} />
            Nuevo producto
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <th className="px-6 py-4">Producto</th>
              <th className="px-6 py-4 text-center">SKU</th>
              <th className="px-6 py-4 text-center">Stock</th>
              <th className="px-6 py-4 text-right">Precio Neto</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <Loader2 className="animate-spin mx-auto text-blue-600" size={32} />
                </td>
              </tr>
            ) : productos.map((prod) => (
              <tr key={prod.producto_id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-slate-700 uppercase">{prod.producto_nombre}</td>
                <td className="px-6 py-4 text-center font-mono text-xs text-slate-400">{prod.producto_codigo_comercial}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-sm font-bold ${prod.stock_actual > 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                    {prod.stock_actual || 0}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-600">
                  ${Number(prod.producto_precio_clp_neto).toLocaleString('es-CL')}
                </td>
                <td className="px-6 py-4 text-center">
                  <MoreHorizontal size={18} className="mx-auto text-slate-300" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Paginación */}
        <div className="p-4 bg-slate-50/50 flex justify-end gap-2 border-t border-slate-100">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} className="p-2 bg-white border border-slate-200 rounded-lg disabled:opacity-30"><ChevronLeft size={16} /></button>
          <button onClick={() => setPage(p => p + 1)} className="p-2 bg-white border border-slate-200 rounded-lg"><ChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}