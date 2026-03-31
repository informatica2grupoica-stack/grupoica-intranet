"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Edit3, Save, X, ChevronLeft, ChevronRight, List as ListIcon, Plus } from "lucide-react";
import Link from "next/link";

// --- FORMULARIO SIMPLIFICADO CON UN SOLO INPUT DE NOMBRE ---
const RenderForm = ({ 
  id, 
  editForm, 
  setEditForm, 
  categorias, 
  filteredSubcategorias, 
  saving, 
  handleSave, 
  setEditingId 
}: any) => (
  <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-200 space-y-6 max-w-5xl mx-auto my-4">
    
    {/* CABECERA DE EDICIÓN CON EL INPUT ÚNICO */}
    <div className="p-6 bg-[#00338d] rounded-2xl text-white shadow-md space-y-2">
      <label className="text-[10px] font-black uppercase opacity-70 tracking-widest italic">Nombre Completo del Producto (Obuma)</label>
      <input 
        className="w-full bg-white/10 border-2 border-white/20 p-4 rounded-xl text-xl font-black uppercase italic outline-none focus:bg-white focus:text-[#00338d] focus:border-white transition-all placeholder:text-white/30"
        placeholder="INGRESE NOMBRE, MEDIDA Y MARCA AQUÍ..."
        value={editForm.nombre_completo || ""}
        onChange={(e) => setEditForm({...editForm, nombre_completo: e.target.value.toUpperCase()})}
      />
    </div>

    <div className="grid grid-cols-3 gap-6">
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-black text-slate-400 uppercase italic">Tipo *</label>
        <select className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" value={editForm.tipo} onChange={(e) => setEditForm({...editForm, tipo: e.target.value})}>
          <option value="Producto">Producto</option>
          <option value="Servicio">Servicio</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-black text-[#00338d] uppercase italic">SKU / Código Comercial</label>
        <input readOnly className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold italic text-slate-500 outline-none" value={editForm.sku || ""} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-black text-slate-400 uppercase italic">Categoría *</label>
        <select className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer" value={editForm.categoria_id} onChange={(e) => setEditForm({...editForm, categoria_id: e.target.value, subcategoria_id: ""})}>
          <option value="">Seleccionar...</option>
          {categorias.map((cat: any) => <option key={cat.producto_categoria_id} value={String(cat.producto_categoria_id)}>{cat.producto_categoria_nombre}</option>)}
        </select>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-6 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-black text-slate-400 uppercase italic">Subcategoria *</label>
        <select className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none disabled:opacity-50" disabled={!editForm.categoria_id} value={editForm.subcategoria_id} onChange={(e) => setEditForm({...editForm, subcategoria_id: e.target.value})}>
          <option value="">Seleccionar...</option>
          {filteredSubcategorias.map((sub: any) => <option key={sub.producto_subcategoria_id} value={String(sub.producto_subcategoria_id)}>{sub.producto_subcategoria_nombre}</option>)}
        </select>
      </div>
      <div className="flex-1">
        <label className="text-[9px] font-black text-slate-400 uppercase italic">Precio Costo</label>
        <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" value={editForm.precio_costo || 0} onChange={(e) => setEditForm({...editForm, precio_costo: e.target.value})} />
      </div>
      <div className="flex-1">
        <label className="text-[9px] font-black text-slate-400 uppercase italic">Precio Venta Total</label>
        <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none border-b-2 border-b-[#00338d]" value={editForm.precio_venta || 0} onChange={(e) => setEditForm({...editForm, precio_venta: e.target.value})} />
      </div>
    </div>

    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
      <button onClick={() => setEditingId(null)} className="px-6 py-4 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:bg-slate-100 transition-all">Cancelar</button>
      <button 
        disabled={saving === id}
        onClick={() => handleSave(id)}
        className="flex items-center gap-3 bg-[#00338d] text-white px-12 py-4 rounded-2xl text-xs font-black uppercase shadow-xl hover:bg-blue-800 transition-all active:scale-95 disabled:opacity-50"
      >
        {saving === id ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
        Guardar Cambios
      </button>
    </div>
  </div>
);

export default function ObumaProductosListado() {
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<any[]>([]);
  const [filteredSubcategorias, setFilteredSubcategorias] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [editingId, setEditingId] = useState<string | null>(null); 
  const [editForm, setEditForm] = useState<any>({});

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/obuma/productos/list');
      const result = await res.json();
      setProductos(result.data || []);
    } catch (err) {
      console.error("Error cargando productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
        const cats = await resCat.json();
        const subs = await resSub.json();
        setCategorias(Array.isArray(cats) ? cats : []);
        setAllSubcategorias(Array.isArray(subs) ? subs : []);
        await fetchProductos();
      } catch (err) {
        console.error("Error en carga inicial");
      }
    }
    loadInitialData();
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase();
    return productos.filter(p => 
      (p.producto_nombre?.toLowerCase() || "").includes(term) ||
      (p.producto_codigo_comercial?.toLowerCase() || "").includes(term)
    );
  }, [productos, search]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentItems = useMemo(() => {
    const lastIndex = currentPage * itemsPerPage;
    const firstIndex = lastIndex - itemsPerPage;
    return filteredProducts.slice(firstIndex, lastIndex);
  }, [filteredProducts, currentPage, itemsPerPage]);

  useEffect(() => {
    if (editForm?.categoria_id) {
      const filtradas = allSubcategorias.filter(
        sub => String(sub.rel_producto_categoria_id) === String(editForm.categoria_id)
      );
      setFilteredSubcategorias(filtradas);
    }
  }, [editForm?.categoria_id, allSubcategorias]);

  const handleEditClick = (prod: any) => {
    if (editingId === prod.producto_id) {
      setEditingId(null);
      setEditForm({});
      return;
    }
    setEditingId(prod.producto_id);
    setEditForm({
      nombre_completo: prod.producto_nombre,
      sku: prod.producto_codigo_comercial,
      tipo: prod.producto_tipo === "2" ? "Servicio" : "Producto",
      categoria_id: String(prod.id_categoria || ""),
      subcategoria_id: String(prod.id_subcategoria || ""),
      precio_venta: Math.round(prod.producto_precio_clp_total || 0),
      precio_costo: Math.round(prod.producto_precio_costo || 0),
      venta_incluye_iva: true,
      costo_incluye_iva: true,
      se_puede_vender: prod.producto_para_venta === "1",
      se_puede_comprar: prod.producto_para_compra === "1",
      se_mantiene_stock: prod.producto_inventariable === "1",
    });
  };

  const handleSave = async (id: string) => {
    setSaving(id);
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
    } finally { setSaving(null); }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 bg-[#f8fafc] min-h-screen">
      
      {/* HEADER DE CONTROL */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar por nombre o SKU..."
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Link href="/obuma-productos/nuevo" className="bg-[#00338d] hover:bg-[#00266b] text-white p-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center">
            <Plus size={24} />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ListIcon size={16} className="text-slate-400" />
            <select className="bg-slate-50 border-none text-[11px] font-black uppercase text-slate-500 rounded-xl px-3 py-2 outline-none cursor-pointer" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
              <option value={30}>30 Filas</option>
              <option value={50}>50 Filas</option>
              <option value={100}>100 Filas</option>
            </select>
          </div>
          <div className="h-8 w-[1px] bg-slate-100" />
          <div className="flex items-center gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-[#00338d] hover:text-white disabled:opacity-30 transition-all"><ChevronLeft size={20} /></button>
            <div className="px-4 py-2 bg-slate-50 rounded-xl"><span className="text-[11px] font-black text-slate-600 uppercase">Pág. {currentPage} / {totalPages || 1}</span></div>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-[#00338d] hover:text-white disabled:opacity-30 transition-all"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>

      {/* TABLA DE PRODUCTOS */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              <th className="px-8 py-5">Producto & Categoría</th>
              <th className="px-4 py-5 text-center">SKU</th>
              <th className="px-4 py-5 text-center">Stock</th>
              <th className="px-4 py-5 text-right">Precio Neto</th>
              <th className="px-4 py-5 text-right">Total (IVA)</th>
              <th className="px-4 py-5 text-center">Web</th>
              <th className="px-8 py-5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={7} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-[#00338d]" /></td></tr>
            ) : currentItems.map((prod) => (
              <React.Fragment key={prod.producto_id}>
                <tr className={`hover:bg-slate-50/50 transition-all ${editingId === prod.producto_id ? 'bg-blue-50/20' : ''}`}>
                  <td className="px-8 py-5">
                    <div className="text-sm font-black text-slate-700 uppercase italic leading-tight">{prod.producto_nombre}</div>
                    <div className="text-[9px] font-black text-blue-500 uppercase mt-1">{prod.categoria_nombre || 'Sin Categoría'}</div>
                  </td>
                  <td className="px-4 py-5 text-center font-mono text-[11px] font-bold text-slate-500 italic">{prod.producto_codigo_comercial}</td>
                  <td className="px-4 py-5 text-center">
                    <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black ${Number(prod.stock_actual) > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {Math.round(prod.stock_actual || 0)}
                    </div>
                  </td>
                  <td className="px-4 py-5 text-right font-bold text-slate-400 text-[11px] italic">
                    ${Math.round(Number(prod.producto_precio_clp_total || 0) / 1.19).toLocaleString('es-CL')}
                  </td>
                  <td className="px-4 py-5 text-right font-black text-[#00338d] text-sm italic">
                    ${Number(prod.producto_precio_clp_total || 0).toLocaleString('es-CL')}
                  </td>
                  <td className="px-4 py-5 text-center">
                    <div className="flex justify-center">
                      <div className={`w-2.5 h-2.5 rounded-full ${prod.producto_para_venta === "1" ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]' : 'bg-slate-200'}`} />
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <button onClick={() => handleEditClick(prod)} className="p-2.5 bg-slate-100 rounded-xl text-slate-400 hover:bg-[#00338d] hover:text-white transition-all active:scale-90 shadow-sm">
                      {editingId === prod.producto_id ? <X size={18} /> : <Edit3 size={18} />}
                    </button>
                  </td>
                </tr>
                {editingId === prod.producto_id && (
                  <tr className="bg-slate-50/50">
                    <td colSpan={7} className="px-2 py-4">
                      <RenderForm 
                        id={prod.producto_id} 
                        editForm={editForm}
                        setEditForm={setEditForm}
                        categorias={categorias}
                        filteredSubcategorias={filteredSubcategorias}
                        saving={saving}
                        handleSave={handleSave}
                        setEditingId={setEditingId}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}