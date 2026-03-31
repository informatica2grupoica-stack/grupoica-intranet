"use client";
import React, { useState, useEffect } from "react";
import { Search, Plus, Loader2, ChevronLeft, ChevronRight, Edit3, Save, X, Box, Tag, DollarSign, Layers } from "lucide-react";
import Link from "next/link";

export default function ObumaProductosListado() {
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [subcategorias, setSubcategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  // 1. Carga inicial de Productos y Categorías
  const fetchInitialData = async () => {
    try {
      const resCat = await fetch('/api/obuma/categorias');
      const dataCat = await resCat.json();
      setCategorias(dataCat.data || []);
      await fetchProductos();
    } catch (error) {
      console.error("Error al cargar datos iniciales", error);
    }
  };

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/obuma/productos/list?page=${page}&filter=${encodeURIComponent(search)}`);
      const result = await res.json();
      setProductos(result.data || []);
    } finally { setLoading(false); }
  };

  // 2. Cargar subcategorías cuando cambia la categoría en el editor
  const loadSubcategorias = async (catId: string) => {
    if (!catId) {
      setSubcategorias([]);
      return;
    }
    try {
      const res = await fetch(`/api/obuma/subcategorias?categoria_id=${catId}`);
      const data = await res.json();
      setSubcategorias(data.data || []);
    } catch (error) {
      console.error("Error subcategorías", error);
    }
  };

  useEffect(() => { fetchInitialData(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); fetchProductos(); }, 600);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { fetchProductos(); }, [page]);

  // 3. Manejo de la Edición
  const handleEditClick = async (prod: any) => {
    if (editingId === prod.producto_id) {
      setEditingId(null);
      return;
    }

    // Dividir el nombre para los 4 campos (Tipo, Característica, Medida, Marca)
    const p = prod.producto_nombre.split(' ');
    
    // Cargamos subcategorías de la categoría actual antes de mostrar el formulario
    if (prod.producto_id_categoria) {
      await loadSubcategorias(prod.producto_id_categoria);
    }

    setEditingId(prod.producto_id);
    setEditForm({
      c1: p[0] || "", 
      c2: p[1] || "", 
      c3: p[2] || "", 
      c4: p[3] || "",
      sku: prod.producto_codigo_comercial,
      tipo: prod.producto_tipo === "2" ? "Servicio" : "Producto",
      categoria_id: prod.producto_id_categoria, // Alineado con el Backend
      subcategoria_id: prod.producto_id_subcategoria, // Alineado con el Backend
      precio_venta: Math.round(prod.producto_precio_clp_total || 0),
      precio_costo: Math.round(prod.producto_precio_costo || 0),
      venta_incluye_iva: true,
      costo_incluye_iva: false,
      se_puede_vender: prod.producto_para_venta === "1",
      se_puede_comprar: prod.producto_para_compra === "1",
      se_mantiene_stock: prod.producto_inventariable === "1",
    });
  };

  const handleSave = async (id: string) => {
    setSaving(id);
    const nombre_completo = `${editForm.c1} ${editForm.c2} ${editForm.c3} ${editForm.c4}`.trim();
    try {
      const res = await fetch(`/api/obuma/productos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, nombre_completo }),
      });
      if (res.ok) { 
        setEditingId(null); 
        fetchProductos(); 
      }
    } finally { setSaving(null); }
  };

  return (
    <div className="space-y-6">
      {/* HEADER BUSCADOR */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic leading-none">Inventario Central</h1>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Control de existencias Obuma</span>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-blue-100"
              placeholder="BUSCAR POR NOMBRE O SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Link href="/obuma-productos/nuevo" className="bg-[#00338d] text-white p-4 rounded-2xl hover:bg-blue-800 transition-all shadow-lg shadow-blue-100">
            <Plus size={20} />
          </Link>
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              <th className="px-8 py-5">Producto & Categoría</th>
              <th className="px-6 py-5 text-center">SKU</th>
              <th className="px-6 py-5 text-center">Stock</th>
              <th className="px-6 py-5 text-right">Precio Total</th>
              <th className="px-8 py-5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-800" /></td></tr>
            ) : productos.map((prod) => (
              <React.Fragment key={prod.producto_id}>
                <tr className={`group transition-all ${editingId === prod.producto_id ? 'bg-blue-50/20' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-8 py-5">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:text-[#00338d] transition-colors"><Box size={20} /></div>
                      <div>
                        <div className="text-sm font-black text-slate-700 uppercase italic tracking-tight">{prod.producto_nombre}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-black bg-blue-100 text-[#00338d] px-2 py-0.5 rounded uppercase">{prod.categoria_nombre || 'Sin Cat.'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="font-mono text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{prod.producto_codigo_comercial}</span>
                  </td>
                  <td className="px-6 py-5 text-center font-black">
                    <span className={Number(prod.stock_actual) > 0 ? 'text-emerald-500' : 'text-rose-400'}>{prod.stock_actual || 0}</span>
                  </td>
                  <td className="px-6 py-5 text-right font-black text-[#00338d]">
                    ${Math.round(prod.producto_precio_clp_total || 0).toLocaleString('es-CL')}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <button 
                      onClick={() => handleEditClick(prod)} 
                      className={`p-2 rounded-xl transition-all ${editingId === prod.producto_id ? 'bg-rose-100 text-rose-500' : 'bg-slate-100 text-slate-400 hover:bg-[#00338d] hover:text-white'}`}
                    >
                      {editingId === prod.producto_id ? <X size={18} /> : <Edit3 size={18} />}
                    </button>
                  </td>
                </tr>

                {/* FORMULARIO EDITAR */}
                {editingId === prod.producto_id && (
                  <tr className="bg-blue-50/30">
                    <td colSpan={5} className="px-12 py-8 border-b border-blue-100">
                      <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-blue-100 space-y-8 animate-in zoom-in-95 duration-200">
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          {["TIPO PRODUCTO", "CARACTERÍSTICA", "MEDIDA", "MARCA / MODELO"].map((label, i) => (
                            <div key={i} className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{i+1}. {label}</label>
                              <input 
                                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 ring-blue-50"
                                value={editForm[`c${i+1}`]}
                                onChange={(e) => setEditForm({...editForm, [`c${i+1}`]: e.target.value.toUpperCase()})}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo *</label>
                            <select className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none" value={editForm.tipo} onChange={(e)=>setEditForm({...editForm, tipo: e.target.value})}>
                              <option>Producto</option>
                              <option>Servicio</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU (Fijo)</label>
                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-mono text-slate-400 font-bold">{editForm.sku}</div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría *</label>
                            <select 
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none" 
                              value={editForm.categoria_id} 
                              onChange={(e) => {
                                setEditForm({...editForm, categoria_id: e.target.value, subcategoria_id: ""});
                                loadSubcategorias(e.target.value);
                              }}
                            >
                              <option value="">Selecciona categoría</option>
                              {categorias.map(c => <option key={c.categoria_id} value={c.categoria_id}>{c.categoria_nombre}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subcategoría *</label>
                              <select 
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                                value={editForm.subcategoria_id}
                                onChange={(e) => setEditForm({...editForm, subcategoria_id: e.target.value})}
                              >
                                <option value="">Selecciona subcategoría</option>
                                {subcategorias.map(s => <option key={s.subcategoria_id} value={s.subcategoria_id}>{s.subcategoria_nombre}</option>)}
                              </select>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio Venta *</label>
                              <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                                <span className="pl-2 font-bold text-slate-300">$</span>
                                <input type="number" className="flex-1 p-2 bg-transparent outline-none font-black text-lg text-slate-700" value={editForm.precio_venta} onChange={(e)=>setEditForm({...editForm, precio_venta: e.target.value})} />
                                <div className="flex items-center gap-2 border-l pl-4 pr-2 border-slate-200">
                                  <input type="checkbox" checked={editForm.venta_incluye_iva} onChange={(e)=>setEditForm({...editForm, venta_incluye_iva: e.target.checked})} className="w-4 h-4 accent-[#00338d]" />
                                  <label className="text-[9px] font-black text-slate-400 uppercase">¿IVA?</label>
                                </div>
                              </div>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo Bruto</label>
                              <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                                <span className="pl-2 font-bold text-slate-300">$</span>
                                <input type="number" className="flex-1 p-2 bg-transparent outline-none font-black text-lg text-slate-700" value={editForm.precio_costo} onChange={(e)=>setEditForm({...editForm, precio_costo: e.target.value})} />
                                <div className="flex items-center gap-2 border-l pl-4 pr-2 border-slate-200">
                                  <input type="checkbox" checked={editForm.costo_incluye_iva} onChange={(e)=>setEditForm({...editForm, costo_incluye_iva: e.target.checked})} className="w-4 h-4 accent-slate-400" />
                                  <label className="text-[9px] font-black text-slate-400 uppercase">¿IVA?</label>
                                </div>
                              </div>
                           </div>
                        </div>

                        <div className="flex flex-wrap gap-8 pt-4 border-t border-slate-50">
                          {[{ k: 'se_puede_vender', l: '¿Se puede vender?' }, { k: 'se_puede_comprar', l: '¿Se puede comprar?' }, { k: 'se_mantiene_stock', l: '¿Se mantiene stock?' }].map(c => (
                            <label key={c.k} className="flex items-center gap-3 cursor-pointer group">
                              <input type="checkbox" className="w-5 h-5 rounded-md accent-[#00338d]" checked={editForm[c.k]} onChange={(e)=>setEditForm({...editForm, [c.k]: e.target.checked})} />
                              <span className="text-[11px] font-black text-slate-600 uppercase group-hover:text-[#00338d] transition-colors">{c.l}</span>
                            </label>
                          ))}
                        </div>

                        <div className="flex justify-end pt-4">
                          <button 
                            disabled={saving === prod.producto_id}
                            onClick={() => handleSave(prod.producto_id)}
                            className="flex items-center gap-3 bg-[#00338d] text-white px-10 py-4 rounded-[1.2rem] text-xs font-black uppercase shadow-xl hover:bg-blue-800 transition-all disabled:opacity-50"
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
      </div>
    </div>
  );
}