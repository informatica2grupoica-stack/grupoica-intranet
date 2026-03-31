"use client";
import React, { useState, useEffect } from "react";
import { Search, Plus, Loader2, Edit3, Save, X, Box } from "lucide-react";
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

  // 1. CARGA INICIAL (Ajustado para recibir array directo de tus APIs)
  const fetchInitialData = async () => {
    try {
      const resCat = await fetch('/api/obuma/categorias');
      const dataCat = await resCat.json();
      // Como tu API devuelve el array directo [], lo seteamos así:
      setCategorias(Array.isArray(dataCat) ? dataCat : []);
      await fetchProductos();
    } catch (error) {
      console.error("Error al cargar categorías", error);
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

  // 2. CARGA DE SUBCATEGORÍAS (Ajustado para recibir array directo)
  const loadSubcategorias = async (catId: string) => {
    if (!catId) {
      setSubcategorias([]);
      return;
    }
    try {
      // Usamos tu API funcional que devuelve todas las subcategorías
      const res = await fetch(`/api/obuma/subcategorias`);
      const data = await res.json();
      setSubcategorias(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error subcategorías", error);
    }
  };

  useEffect(() => { fetchInitialData(); }, []);

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => { if(search !== "") { setPage(1); fetchProductos(); } }, 600);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { fetchProductos(); }, [page]);

  // 3. MANEJO DE EDICIÓN
  const handleEditClick = async (prod: any) => {
    if (editingId === prod.producto_id) {
      setEditingId(null);
      return;
    }

    // Dividimos el nombre (Tipo Característica Medida Marca)
    const p = prod.producto_nombre.split(' ');
    
    // Cargamos subcategorías inmediatamente al abrir el editor
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
      categoria_id: prod.producto_id_categoria,
      subcategoria_id: prod.producto_id_subcategoria,
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
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic leading-none">Inventario Central</h1>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Editor de Productos Obuma</span>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
              placeholder="BUSCAR PRODUCTO..."
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

                {/* FORMULARIO INTEGRADO */}
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
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none" 
                              value={editForm.categoria_id} 
                              onChange={(e) => {
                                setEditForm({...editForm, categoria_id: e.target.value, subcategoria_id: ""});
                                loadSubcategorias(e.target.value);
                              }}
                            >
                              <option value="">Selecciona...</option>
                              {categorias.map((c: any) => (
                                <option key={c.categoria_id} value={c.categoria_id}>{c.categoria_nombre}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400">SUBCATEGORÍA</label>
                            <select 
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                              value={editForm.subcategoria_id}
                              onChange={(e) => setEditForm({...editForm, subcategoria_id: e.target.value})}
                            >
                              <option value="">Selecciona...</option>
                              {subcategorias
                                .filter((s: any) => s.id_categoria === editForm.categoria_id)
                                .map((s: any) => (
                                  <option key={s.subcategoria_id} value={s.subcategoria_id}>{s.subcategoria_nombre}</option>
                                ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400">PRECIO VENTA</label>
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