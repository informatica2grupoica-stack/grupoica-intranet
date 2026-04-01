"use client";
import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle2, AlertCircle, Copy, PackagePlus, RefreshCcw } from "lucide-react";

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  const [categorias, setCategorias] = useState<any[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<any[]>([]);
  const [filteredSubcategorias, setFilteredSubcategorias] = useState<any[]>([]);

  // 1. CONSTRUCCIÓN DE NOMBRE (4 PASOS)
  const [piezas, setPiezas] = useState({
    tipo: "",
    caracteristica: "",
    valorMedida: "",
    unidadMedida: "MT",
    marca: ""
  });

  const [form, setForm] = useState({
    nombre: "",
    tipo: "0", 
    sku: "", 
    categoria_id: "",
    subcategoria_id: "",
    precio_costo: 0,
    incluye_iva_costo: false,
    precio_venta: 0,
    incluye_iva_venta: false,
    se_puede_vender: true,
    se_puede_comprar: true,
    se_mantiene_stock: true,
  });

  // Efecto: Construcción de Nombre Automático
  useEffect(() => {
    const limpiar = (t: string) => 
      t.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    const nombreConstruido = [
      limpiar(piezas.tipo),
      limpiar(piezas.caracteristica),
      piezas.valorMedida ? `${limpiar(piezas.valorMedida)} ${piezas.unidadMedida}` : "",
      limpiar(piezas.marca)
    ].filter(Boolean).join(" ");

    setForm(prev => ({ ...prev, nombre: nombreConstruido }));
  }, [piezas]);

  // Carga inicial de datos de Obuma
  useEffect(() => {
    async function loadObumaData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
        setCategorias(await resCat.json());
        setAllSubcategorias(await resSub.json());
      } catch (err) {
        console.error("Error cargando parámetros");
      } finally {
        setLoadingData(false);
      }
    }
    loadObumaData();
  }, []);

  // FILTRO DE SUBCATEGORÍAS (Corregido para IDs numéricos/string)
  useEffect(() => {
    if (form.categoria_id) {
      const filtradas = allSubcategorias.filter(
        sub => String(sub.rel_producto_categoria_id) === String(form.categoria_id)
      );
      setFilteredSubcategorias(filtradas);
    } else {
      setFilteredSubcategorias([]);
    }
  }, [form.categoria_id, allSubcategorias]);

  // LÓGICA DE SKU (Mejorada con soporte para salto al 204)
  const sugerirSkuCorrelativo = async (subId: string, inicioForce?: number) => {
    if (!subId || !form.categoria_id) return;
    setGeneratingSku(true);
    try {
      const cat = categorias.find(c => String(c.producto_categoria_id) === String(form.categoria_id));
      const nombreCat = cat?.producto_categoria_nombre?.toUpperCase() || "";
      let prefijo = nombreCat.includes("MERCADO PUBLICO") ? "60" : nombreCat.includes("MAYORISTA") ? "50" : "99";

      const prefijoSub = `${prefijo}${subId}`;
      const url = `/api/obuma/siguiente-sku?prefijoSub=${prefijoSub}${inicioForce ? `&inicio=${inicioForce}` : ''}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.sku) {
        setForm(prev => ({ ...prev, sku: String(data.sku), subcategoria_id: subId }));
      }
    } catch (err) {
      console.error("Error SKU:", err);
    } finally {
      setGeneratingSku(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/obuma/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const result = await res.json();
      const dataReal = Array.isArray(result) ? result[0] : result;

      // VALIDACIÓN DE ÉXITO REAL (Si no hay producto_id, el SKU chocó)
      if (!res.ok || !dataReal?.producto_id) {
        setStatus({ type: 'error', msg: `SKU ${form.sku} EN USO. SALTANDO AL SIGUIENTE...` });
        await sugerirSkuCorrelativo(form.subcategoria_id, 204);
        setLoading(false);
        return;
      }

      setStatus({ type: 'success', msg: `PRODUCTO CREADO: ID ${dataReal.producto_id}` });
      
      // Limpieza post-creación
      setPiezas({ tipo: "", caracteristica: "", valorMedida: "", unidadMedida: "MT", marca: "" });
      setForm(prev => ({ ...prev, sku: "", precio_costo: 0, precio_venta: 0 }));
      await sugerirSkuCorrelativo(form.subcategoria_id);
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
      setStatus({ type: 'error', msg: "ERROR DE CONEXIÓN CON OBUMA" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 font-sans antialiased text-slate-900">
      <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden">
        
        {/* HEADER */}
        <div className="p-8 bg-[#00338d] text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter">Sincronización Obuma</h1>
            <p className="text-[10px] text-blue-200 font-bold uppercase tracking-[0.2em] mt-1">
              {form.nombre || "Escribe el nombre del producto..."}
            </p>
          </div>
          <PackagePlus size={40} className="opacity-40" />
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-10">
          
          {/* 1. CONSTRUCCIÓN */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 relative">
            <span className="absolute -top-3 left-6 bg-white px-3 py-1 rounded-full text-[9px] font-black text-slate-400 border border-slate-100 uppercase">1. Construcción de Nombre</span>
            <input required placeholder="TIPO" className="p-3 bg-white border rounded-xl font-bold text-xs uppercase" value={piezas.tipo} onChange={e => setPiezas({...piezas, tipo: e.target.value})} />
            <input required placeholder="CARACTERÍSTICA" className="p-3 bg-white border rounded-xl font-bold text-xs uppercase" value={piezas.caracteristica} onChange={e => setPiezas({...piezas, caracteristica: e.target.value})} />
            <div className="flex gap-1">
              <input placeholder="MEDIDA" className="w-full p-3 bg-white border rounded-xl font-bold text-xs" value={piezas.valorMedida} onChange={e => setPiezas({...piezas, valorMedida: e.target.value})} />
              <select className="bg-white border rounded-xl text-[10px] font-black px-2" value={piezas.unidadMedida} onChange={e => setPiezas({...piezas, unidadMedida: e.target.value})}>
                <option value="MT">MT</option><option value="UN">UN</option><option value="KG">KG</option><option value='"'>"</option>
              </select>
            </div>
            <input placeholder="MARCA" className="p-3 bg-white border rounded-xl font-bold text-xs uppercase" value={piezas.marca} onChange={e => setPiezas({...piezas, marca: e.target.value})} />
          </div>

          {/* 2. CATEGORÍAS Y SKU */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase">2. Clasificación</label>
              <select required className="w-full p-4 bg-slate-50 border rounded-xl font-bold text-xs outline-none" value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
                <option value="">{loadingData ? "CARGANDO..." : "CATEGORÍA..."}</option>
                {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
              </select>
              <select required disabled={!form.categoria_id} className="w-full p-4 bg-slate-50 border rounded-xl font-bold text-xs disabled:opacity-30 outline-none" value={form.subcategoria_id} onChange={e => sugerirSkuCorrelativo(e.target.value)}>
                <option value="">SUBCATEGORÍA...</option>
                {filteredSubcategorias.map(s => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
              </select>
            </div>

            <div className="bg-blue-50 rounded-2xl p-6 border-2 border-dashed border-blue-100 flex flex-col items-center justify-center space-y-2">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">SKU Correlativo</span>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-black text-[#00338d] tracking-tighter leading-none">{form.sku || "---"}</span>
                {generatingSku ? <Loader2 className="animate-spin text-blue-500" size={20}/> : <button type="button" onClick={() => sugerirSkuCorrelativo(form.subcategoria_id)} className="text-blue-300 hover:text-blue-500"><RefreshCcw size={16}/></button>}
              </div>
            </div>
          </div>

          {/* 3. PRECIOS Y ATRIBUTOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-4 border-t border-slate-100">
            <div className="space-y-5">
              <label className="text-[10px] font-black text-slate-400 uppercase">3. Valores</label>
              <div className="flex items-center gap-4">
                <div className="relative flex-1"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-300">$</span><input type="number" placeholder="COSTO NETO" className="w-full p-4 pl-10 bg-slate-50 border rounded-xl font-bold text-sm" value={form.precio_costo} onChange={e => setForm({...form, precio_costo: Number(e.target.value)})} /></div>
                <label className="flex items-center gap-2 text-[10px] font-black uppercase cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-[#00338d]" checked={form.incluye_iva_costo} onChange={e => setForm({...form, incluye_iva_costo: e.target.checked})} />+ IVA</label>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative flex-1"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-300">$</span><input type="number" placeholder="VENTA FINAL" className="w-full p-4 pl-10 bg-slate-50 border rounded-xl font-bold text-sm text-emerald-600" value={form.precio_venta} onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} /></div>
                <label className="flex items-center gap-2 text-[10px] font-black uppercase cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-[#00338d]" checked={form.incluye_iva_venta} onChange={e => setForm({...form, incluye_iva_venta: e.target.checked})} />+ IVA</label>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 grid grid-cols-1 gap-3">
              {[
                { label: "¿Se puede vender?", key: "se_puede_vender" },
                { label: "¿Se puede comprar?", key: "se_puede_comprar" },
                { label: "¿Mantiene Stock?", key: "se_mantiene_stock" }
              ].map(item => (
                <label key={item.key} className="flex justify-between items-center text-[11px] font-black uppercase text-slate-600">
                  {item.label}
                  <input type="checkbox" className="w-5 h-5 accent-[#00338d]" checked={(form as any)[item.key]} onChange={e => setForm({...form, [item.key]: e.target.checked})} />
                </label>
              ))}
            </div>
          </div>

          {/* STATUS Y ENVÍO */}
          {status && (
            <div className={`p-5 rounded-2xl flex items-center gap-4 border ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
              {status.type === 'success' ? <CheckCircle2 size={24}/> : <AlertCircle size={24}/>}
              <span className="font-black uppercase text-xs">{status.msg}</span>
            </div>
          )}

          <button disabled={loading || !form.sku} className="w-full bg-[#00338d] hover:bg-[#00266b] text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-30">
            {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            CREAR PRODUCTO EN OBUMA
          </button>
        </form>
      </div>
    </div>
  );
}