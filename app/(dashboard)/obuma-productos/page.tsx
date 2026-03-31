"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Search, Loader2, Edit3, Save, X, Copy, ChevronLeft, ChevronRight, ListIcon } from "lucide-react";

export default function ObumaProductosListado() {
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<any[]>([]);
  const [filteredSubcategorias, setFilteredSubcategorias] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  
  // ESTADOS DE BÚSQUEDA Y PAGINACIÓN
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

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
        console.error("Error cargando datos de Obuma");
      }
    }
    loadInitialData();
  }, []);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      // Nota: Aquí traemos la lista base; el filtrado y paginado lo hacemos en el cliente para mayor velocidad
      const res = await fetch(`/api/obuma/productos/list`);
      const result = await res.json();
      setProductos(result.data || []);
    } finally { setLoading(false); }
  };

  // LÓGICA DE FILTRADO Y PAGINACIÓN
  const filteredProducts = useMemo(() => {
    return productos.filter(p => 
      p.producto_nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.producto_codigo_comercial?.toLowerCase().includes(search.toLowerCase())
    );
  }, [productos, search]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  
  const currentItems = useMemo(() => {
    const lastIndex = currentPage * itemsPerPage;
    const firstIndex = lastIndex - itemsPerPage;
    return filteredProducts.slice(firstIndex, lastIndex);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // Resetear a página 1 cuando se busca
  useEffect(() => { setCurrentPage(1); }, [search, itemsPerPage]);

  // Filtrado de subcategorías al editar
  useEffect(() => {
    if (editForm?.categoria_id) {
      const filtradas = allSubcategorias.filter(
        sub => String(sub.rel_producto_categoria_id) === String(editForm.categoria_id)
      );
      setFilteredSubcategorias(filtradas);
    }
  }, [editForm?.categoria_id, allSubcategorias]);

  // Generación automática del nombre (Las 4 piezas)
  useEffect(() => {
    if (editingId && editForm.c1 !== undefined) {
      const limpiar = (t: string) => (t || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const nombreConstruido = [
        limpiar(editForm.c1),
        limpiar(editForm.c2),
        editForm.c3 ? `${limpiar(editForm.c3)} MT` : "", 
        limpiar(editForm.c4)
      ].filter(Boolean).join(" ");
      
      if (nombreConstruido !== editForm.nombre_completo) {
        setEditForm((prev: any) => ({ ...prev, nombre_completo: nombreConstruido }));
      }
    }
  }, [editForm?.c1, editForm?.c2, editForm?.c3, editForm?.c4]);

  const handleEditClick = (prod: any) => {
    if (editingId === prod.producto_id) {
      setEditingId(null);
      setEditForm({});
      return;
    }
    const partes = prod.producto_nombre.split(' ');
    setEditingId(prod.producto_id);
    setEditForm({
      c1: partes[0] || "", 
      c2: partes[1] || "", 
      c3: partes[2]?.replace("MT", "").trim() || "", 
      c4: partes.slice(3).join(" ") || "",
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
      
      {/* HEADER DE CONTROL (Buscador y Paginación) */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar por nombre o SKU..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ListIcon size={16} className="text-slate-400" />
            <select 
              className="bg-slate-50 border-none text-[11px] font-black uppercase text-slate-500 rounded-xl px-3 py-2 outline-none cursor-pointer"
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
            >
              <option value={30}>Ver 30</option>
              <option value={50}>Ver 50</option>
              <option value={100}>Ver 100</option>
              <option value={500}>Ver 500</option>
            </select>
          </div>

          <div className="h-8 w-[1px] bg-slate-100 mx-2" />

          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-[#00338d] hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-[11px] font-black text-slate-600 uppercase tracking-tighter">
              Página {currentPage} de {totalPages || 1}
            </span>
            <button 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-[#00338d] hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

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
                    <div className="text-[9px] font-black text-blue-500 uppercase mt-1">{prod.categoria_nombre || 'General'}</div>
                  </td>
                  <td className="px-4 py-5 text-center font-mono text-[11px] font-bold text-slate-500 italic">
                    {prod.producto_codigo_comercial}
                  </td>
                  <td className="px-4 py-5 text-center">
                    <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black ${Number(prod.stock_actual) > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {Math.round(prod.stock_actual || 0)}
                    </div>
                  </td>
                  <td className="px-4 py-5 text-right font-bold text-slate-400 text-[11px]">
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

                {/* FORMULARIO DE EDICIÓN (Sin cambios, manteniendo todas tus mejoras previas) */}
                {editingId === prod.producto_id && (
                  <tr className="bg-slate-50/50">
                    <td colSpan={7} className="px-6 py-8">
                      <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-200 space-y-6 max-w-5xl mx-auto">
                        <div className="p-4 bg-[#00338d] rounded-2xl text-white shadow-md">
                          <label className="text-[8px] font-black uppercase opacity-60 tracking-widest">Previsualización Nombre Obuma</label>
                          <div className="text-lg font-black uppercase italic tracking-tight">
                            {editForm.nombre_completo || "SIN NOMBRE"}
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          {[
                            { k: 'c1', l: '1. TIPO PRODUCTO' },
                            { k: 'c2', l: '2. CARACTERÍSTICA' },
                            { k: 'c3', l: '3. MEDIDA' },
                            { k: 'c4', l: '4. MARCA / MODELO' }
                          ].map((item) => (
                            <div key={item.k} className="flex flex-col gap-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase">{item.l}</label>
                              <input 
                                className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-[#00338d] transition-colors"
                                value={editForm[item.k] || ""}
                                onChange={(e) => setEditForm({...editForm, [item.k]: e.target.value})}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase italic">Tipo *</label>
                            <select className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer" value={editForm.tipo} onChange={(e) => setEditForm({...editForm, tipo: e.target.value})}>
                              <option value="Producto">Producto</option>
                              <option value="Servicio">Servicio</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-[#00338d] uppercase italic">SKU (Fijo):</label>
                            <div className="relative">
                              <input readOnly className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 italic" value={editForm.sku || ""} />
                              <Copy size={14} className="absolute right-3 top-3 text-slate-300" />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase italic">Categoría *</label>
                            <select className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer" value={editForm.categoria_id} onChange={(e) => setEditForm({...editForm, categoria_id: e.target.value, subcategoria_id: ""})}>
                              <option value="">Selecciona una categoria</option>
                              {categorias.map((cat) => <option key={cat.producto_categoria_id} value={String(cat.producto_categoria_id)}>{cat.producto_categoria_nombre}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 items-end">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase italic">Subcategoria *</label>
                            <select className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none disabled:opacity-50 cursor-pointer" disabled={!editForm.categoria_id} value={editForm.subcategoria_id} onChange={(e) => setEditForm({...editForm, subcategoria_id: e.target.value})}>
                              <option value="">Selecciona una subcategoria</option>
                              {filteredSubcategorias.map((sub) => <option key={sub.producto_subcategoria_id} value={String(sub.producto_subcategoria_id)}>{sub.producto_subcategoria_nombre}</option>)}
                            </select>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase italic">Precio Costo *</label>
                              <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" value={editForm.precio_costo || 0} onChange={(e) => setEditForm({...editForm, precio_costo: e.target.value})} />
                            </div>
                            <label className="flex items-center gap-1 cursor-pointer pt-4">
                              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#00338d]" checked={editForm.costo_incluye_iva} onChange={(e) => setEditForm({...editForm, costo_incluye_iva: e.target.checked})} />
                              <span className="text-[8px] font-black text-slate-500 uppercase">¿IVA?</span>
                            </label>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase italic">Precio Venta *</label>
                              <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none border-b-2 border-b-[#00338d]" value={editForm.precio_venta || 0} onChange={(e) => setEditForm({...editForm, precio_venta: e.target.value})} />
                            </div>
                            <label className="flex items-center gap-1 cursor-pointer pt-4">
                              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#00338d]" checked={editForm.venta_incluye_iva} onChange={(e) => setEditForm({...editForm, venta_incluye_iva: e.target.checked})} />
                              <span className="text-[8px] font-black text-slate-500 uppercase">¿IVA?</span>
                            </label>
                          </div>
                        </div>

                        <div className="flex gap-6 pt-2">
                          {[
                            { key: 'se_puede_vender', label: '¿SE PUEDE VENDER?' },
                            { key: 'se_puede_comprar', label: '¿SE PUEDE COMPRAR?' },
                            { key: 'se_mantiene_stock', label: '¿SE MANTIENE STOCK?' }
                          ].map((item) => (
                            <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                className="w-5 h-5 rounded text-[#00338d] focus:ring-[#00338d] cursor-pointer" 
                                checked={editForm[item.key] || false} 
                                onChange={(e) => setEditForm({...editForm, [item.key]: e.target.checked})} 
                              />
                              <span className="text-[10px] font-black text-slate-700 uppercase group-hover:text-[#00338d] transition-colors">{item.label}</span>
                            </label>
                          ))}
                        </div>

                        <div className="flex justify-end pt-4 border-t border-slate-100">
                          <button 
                            disabled={saving === prod.producto_id}
                            onClick={() => handleSave(prod.producto_id)}
                            className="flex items-center gap-3 bg-[#00338d] text-white px-12 py-4 rounded-2xl text-xs font-black uppercase shadow-xl hover:bg-blue-800 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {saving === prod.producto_id ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Guardar Cambios en Obuma
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {/* MENSAJE DE RESULTADOS VACÍOS */}
        {!loading && currentItems.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="text-slate-300 font-black uppercase text-xl italic tracking-tighter">No se encontraron productos</div>
            <button onClick={() => setSearch("")} className="text-[#00338d] text-[10px] font-black uppercase border-b-2 border-[#00338d]">Limpiar búsqueda</button>
          </div>
        )}
      </div>
    </div>
  );
}