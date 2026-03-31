"use client";
import React, { useState, useEffect } from "react";
import { Search, Loader2, Edit3, Save, X, Box } from "lucide-react";

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
  const [editForm, setEditForm] = useState<any>(null);

  // 1. CARGA DE DATOS MAESTROS (IGUAL QUE EN TU FORMULARIO DE CREACIÓN)
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

  // 2. LÓGICA DE FILTRADO DE SUBCATEGORÍAS (SINCRONIZADA CON TU CREACIÓN)
  useEffect(() => {
    if (editForm?.categoria_id) {
      const filtradas = allSubcategorias.filter(
        sub => String(sub.rel_producto_categoria_id) === String(editForm.categoria_id)
      );
      setFilteredSubcategorias(filtradas);
    } else {
      setFilteredSubcategorias([]);
    }
  }, [editForm?.categoria_id, allSubcategorias]);

  const handleEditClick = (prod: any) => {
    if (editingId === prod.producto_id) {
      setEditingId(null);
      return;
    }

    const p = prod.producto_nombre.split(' ');
    
    // Mapeo de IDs desde la respuesta del listado de Obuma
    const catId = prod.id_categoria || prod.producto_id_categoria || "";
    const subId = prod.id_subcategoria || prod.producto_id_subcategoria || "";

    setEditingId(prod.producto_id);
    setEditForm({
      c1: p[0] || "", 
      c2: p[1] || "", 
      c3: p[2] || "", 
      c4: p[3] || "",
      sku: prod.producto_codigo_comercial,
      tipo: prod.producto_tipo === "2" ? "Servicio" : "Producto",
      categoria_id: String(catId),
      subcategoria_id: String(subId),
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
      {/* ... (Buscador y Header igual) ... */}
      
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              <th className="px-8 py-5">Producto & Categoría</th>
              <th className="px-6 py-5 text-center">SKU</th>
              <th className="px-6 py-5 text-right">Precio</th>
              <th className="px-8 py-5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-800" /></td></tr>
            ) : productos.map((prod) => (
              <React.Fragment key={prod.producto_id}>
                <tr className={`hover:bg-slate-50/50 transition-all ${editingId === prod.producto_id ? 'bg-blue-50/20' : ''}`}>
                  <td className="px-8 py-5">
                    <div className="text-sm font-black text-slate-700 uppercase italic">{prod.producto_nombre}</div>
                    <div className="text-[9px] font-black text-blue-500 uppercase">{prod.categoria_nombre || 'General'}</div>
                  </td>
                  <td className="px-6 py-5 text-center font-mono text-xs">{prod.producto_codigo_comercial}</td>
                  <td className="px-6 py-5 text-right font-black text-[#00338d]">
                    ${Math.round(prod.producto_precio_clp_total || 0).toLocaleString('es-CL')}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <button onClick={() => handleEditClick(prod)} className="p-2 bg-slate-100 rounded-xl text-slate-400 hover:bg-[#00338d] hover:text-white">
                      {editingId === prod.producto_id ? <X size={18} /> : <Edit3 size={18} />}
                    </button>
                  </td>
                </tr>

                {editingId === prod.producto_id && (
                  <tr className="bg-blue-50/30">
                    <td colSpan={4} className="px-12 py-8 border-b border-blue-100">
                      <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-blue-100 space-y-6">
                        
                        <div className="grid grid-cols-4 gap-4">
                          {["TIPO", "CARACT.", "MEDIDA", "MARCA"].map((label, i) => (
                            <div key={i} className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400">{label}</label>
                              <input 
                                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold uppercase"
                                value={editForm[`c${i+1}`]}
                                onChange={(e) => setEditForm({...editForm, [`c${i+1}`]: e.target.value.toUpperCase()})}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400">CATEGORÍA</label>
                            <select 
                              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" 
                              value={editForm.categoria_id} 
                              onChange={(e) => setEditForm({...editForm, categoria_id: e.target.value, subcategoria_id: ""})}
                            >
                              <option value="">Selecciona una categoria</option>
                              {categorias.map((cat) => (
                                <option key={cat.producto_categoria_id} value={String(cat.producto_categoria_id)}>
                                  {cat.producto_categoria_nombre}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400">SUBCATEGORIA</label>
                            <select 
                              disabled={!editForm.categoria_id}
                              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none disabled:opacity-50"
                              value={editForm.subcategoria_id}
                              onChange={(e) => setEditForm({...editForm, subcategoria_id: e.target.value})}
                            >
                              <option value="">Selecciona una subcategoria</option>
                              {filteredSubcategorias.map((sub) => (
                                <option key={sub.producto_subcategoria_id} value={String(sub.producto_subcategoria_id)}>
                                  {sub.producto_subcategoria_nombre}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400">PRECIO VENTA (BRUTO)</label>
                            <input 
                              type="number"
                              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold"
                              value={editForm.precio_venta}
                              onChange={(e) => setEditForm({...editForm, precio_venta: e.target.value})}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-4">
                          <button 
                            disabled={saving === prod.producto_id}
                            onClick={() => handleSave(prod.producto_id)}
                            className="flex items-center gap-3 bg-[#00338d] text-white px-10 py-4 rounded-[1.2rem] text-xs font-black uppercase shadow-xl hover:bg-blue-800 disabled:opacity-50"
                          >
                            {saving === prod.producto_id ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Actualizar en Obuma
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