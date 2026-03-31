"use client";
import React, { useState, useEffect } from "react";
import { Search, Loader2, Edit3, Save, X, Copy, Globe, Box, DollarSign } from "lucide-react";

export default function ObumaProductosListado() {
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<any[]>([]);
  const [filteredSubcategorias, setFilteredSubcategorias] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
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
      const res = await fetch(`/api/obuma/productos/list?page=${page}&filter=${encodeURIComponent(search)}`);
      const result = await res.json();
      setProductos(result.data || []);
    } finally { setLoading(false); }
  };

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
    <div className="space-y-6 max-w-7xl mx-auto p-4">
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
            ) : productos.map((prod) => (
              <React.Fragment key={prod.producto_id}>
                <tr className={`hover:bg-slate-50/50 transition-all ${editingId === prod.producto_id ? 'bg-blue-50/20' : ''}`}>
                  {/* Producto */}
                  <td className="px-8 py-5">
                    <div className="text-sm font-black text-slate-700 uppercase italic leading-tight">{prod.producto_nombre}</div>
                    <div className="text-[9px] font-black text-blue-500 uppercase mt-1">{prod.categoria_nombre || 'General'}</div>
                  </td>
                  
                  {/* SKU */}
                  <td className="px-4 py-5 text-center font-mono text-[11px] font-bold text-slate-500 italic">
                    {prod.producto_codigo_comercial}
                  </td>

                  {/* Stock */}
                  <td className="px-4 py-5 text-center">
                    <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black ${Number(prod.stock_actual) > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {Math.round(prod.stock_actual || 0)}
                    </div>
                  </td>

                  {/* Precio Neto */}
                  <td className="px-4 py-5 text-right font-bold text-slate-400 text-[11px]">
                    ${Math.round(Number(prod.producto_precio_clp_total || 0) / 1.19).toLocaleString('es-CL')}
                  </td>

                  {/* Total (IVA inc.) */}
                  <td className="px-4 py-5 text-right font-black text-[#00338d] text-sm italic">
                    ${Number(prod.producto_precio_clp_total || 0).toLocaleString('es-CL')}
                  </td>

                  {/* Mostrar en Web */}
                  <td className="px-4 py-5 text-center">
                    <div className="flex justify-center">
                      <div className={`w-2.5 h-2.5 rounded-full ${prod.producto_para_venta === "1" ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]' : 'bg-slate-200'}`} title={prod.producto_para_venta === "1" ? "Visible en Web" : "Oculto"} />
                    </div>
                  </td>

                  {/* Acciones */}
                  <td className="px-8 py-5 text-center">
                    <button onClick={() => handleEditClick(prod)} className="p-2.5 bg-slate-100 rounded-xl text-slate-400 hover:bg-[#00338d] hover:text-white transition-all active:scale-90 shadow-sm">
                      {editingId === prod.producto_id ? <X size={18} /> : <Edit3 size={18} />}
                    </button>
                  </td>
                </tr>

                {/* FORMULARIO DE EDICIÓN EXPANDIDO */}
                {editingId === prod.producto_id && (
                  <tr className="bg-slate-50/50">
                    <td colSpan={7} className="px-6 py-8">
                      <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-200 space-y-6 max-w-5xl mx-auto">
                        
                        {/* VISOR DE NOMBRE AUTOMÁTICO */}
                        <div className="p-4 bg-[#00338d] rounded-2xl text-white shadow-md">
                          <label className="text-[8px] font-black uppercase opacity-60 tracking-widest">Previsualización Nombre Obuma</label>
                          <div className="text-lg font-black uppercase italic tracking-tight">
                            {editForm.nombre_completo || "SIN NOMBRE"}
                          </div>
                        </div>

                        {/* LAS 4 PIEZAS */}
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

                        {/* CONFIGURACIÓN BÁSICA */}
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

                        {/* TOGGLES DE ESTADO */}
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

                        {/* BOTÓN GUARDAR */}
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
      </div>
    </div>
  );
}