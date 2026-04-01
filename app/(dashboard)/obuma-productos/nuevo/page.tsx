"use client";
import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle2, AlertCircle, RefreshCcw, Copy, PackagePlus } from "lucide-react";

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  const [categorias, setCategorias] = useState<any[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<any[]>([]);
  const [filteredSubcategorias, setFilteredSubcategorias] = useState<any[]>([]);

  // 1. CONSTRUCCIÓN DE NOMBRE (Basado en tus 4 pasos)
  const [piezas, setPiezas] = useState({
    tipo: "",
    caracteristica: "",
    valorMedida: "",
    unidadMedida: "MT",
    marca: ""
  });

  // 2. ESTADO COMPLETO DEL PRODUCTO (Captura de pantalla)
  const [form, setForm] = useState({
    nombre: "",
    tipo: "0", // 0 = Producto estándar en Obuma
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

  // Efecto para construir el nombre automáticamente
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

  // Carga de datos iniciales
  useEffect(() => {
    async function loadData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
        setCategorias(await resCat.json());
        setAllSubcategorias(await resSub.json());
      } catch (err) { console.error("Error cargando parámetros"); }
    }
    loadData();
  }, []);

  // Filtrar subcategorías por categoría seleccionada
  useEffect(() => {
    if (form.categoria_id) {
      const filtradas = allSubcategorias.filter(
        sub => String(sub.rel_producto_categoria_id) === String(form.categoria_id)
      );
      setFilteredSubcategorias(filtradas);
    }
  }, [form.categoria_id, allSubcategorias]);

  // Función para obtener el SKU correlativo
  const sugerirSku = async (subId: string, inicioForce?: number) => {
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
      if (data.sku) setForm(prev => ({ ...prev, sku: data.sku, subcategoria_id: subId }));
    } catch (err) { console.error("Error obteniendo SKU"); }
    finally { setGeneratingSku(false); }
  };

  // ENVÍO FINAL A OBUMA
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku || !form.nombre) return;
    
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

      // VALIDACIÓN CRÍTICA: Si no hay producto_id, saltamos al 204
      if (!res.ok || !dataReal?.producto_id) {
        setStatus({ 
          type: 'error', 
          msg: `SKU ${form.sku} OCUPADO. REINTENTANDO DESDE EL 204...` 
        });
        await sugerirSku(form.subcategoria_id, 204);
        setLoading(false);
        return;
      }

      setStatus({ type: 'success', msg: `PRODUCTO CREADO EXITOSAMENTE (ID: ${dataReal.producto_id})` });
      
      // Reset parcial del form para el siguiente producto
      setPiezas({ tipo: "", caracteristica: "", valorMedida: "", unidadMedida: "MT", marca: "" });
      setForm(prev => ({ ...prev, sku: "", precio_costo: 0, precio_venta: 0 }));
      await sugerirSku(form.subcategoria_id);
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
      setStatus({ type: 'error', msg: "ERROR DE COMUNICACIÓN CON LA API" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-slate-50 min-h-screen">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-10">
        
        {/* Banner de Previsualización */}
        <div className="mb-10 p-8 bg-[#00338d] rounded-[2rem] text-white relative overflow-hidden shadow-lg border-b-8 border-[#00266b]">
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Nombre generado para Obuma</p>
              <h1 className="text-3xl font-black uppercase italic tracking-tighter mt-2">
                {form.nombre || "Esperando datos de construcción..."}
              </h1>
            </div>
            <PackagePlus size={48} className="opacity-20" />
          </div>
        </div>

        {status && (
          <div className={`mb-8 p-6 rounded-2xl flex items-center gap-4 animate-bounce-short ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            {status.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            <span className="font-black uppercase text-sm tracking-wide">{status.msg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-12">
          
          {/* SECCIÓN 1: CONSTRUCCIÓN DEL NOMBRE (Captura 1) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <div className="md:col-span-4 -mt-12 mb-4">
              <span className="bg-white px-4 py-1 rounded-full text-[10px] font-black text-slate-400 border border-slate-200 uppercase">1. Definición del Producto</span>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black uppercase text-slate-500">Tipo</label>
              <input required className="p-4 bg-white border border-slate-200 rounded-2xl font-bold uppercase outline-none focus:border-[#00338d]" placeholder="Pino, Zinc, Cemento..." value={piezas.tipo} onChange={(e) => setPiezas({...piezas, tipo: e.target.value})} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black uppercase text-slate-500">Característica</label>
              <input required className="p-4 bg-white border border-slate-200 rounded-2xl font-bold uppercase outline-none focus:border-[#00338d]" placeholder="Cepillado, Acanalado..." value={piezas.caracteristica} onChange={(e) => setPiezas({...piezas, caracteristica: e.target.value})} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black uppercase text-slate-500">Medida / Valor</label>
              <div className="flex gap-2">
                <input className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none" placeholder="3.66" value={piezas.valorMedida} onChange={(e) => setPiezas({...piezas, valorMedida: e.target.value})} />
                <select className="p-4 bg-white border border-slate-200 rounded-2xl font-black text-xs" value={piezas.unidadMedida} onChange={(e) => setPiezas({...piezas, unidadMedida: e.target.value})}>
                  <option value="MT">MT</option><option value="UN">UN</option><option value="KG">KG</option><option value='"'>"</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black uppercase text-slate-500">Marca / Modelo</label>
              <input className="p-4 bg-white border border-slate-200 rounded-2xl font-bold uppercase outline-none" placeholder="Polpaico, Melón..." value={piezas.marca} onChange={(e) => setPiezas({...piezas, marca: e.target.value})} />
            </div>
          </div>

          {/* SECCIÓN 2: CATEGORIZACIÓN Y SKU (Captura 2) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-black uppercase text-slate-500">Categoría Obuma *</label>
                <select required className="p-5 bg-slate-100 border border-slate-200 rounded-[1.5rem] font-bold text-sm outline-none" value={form.categoria_id} onChange={(e) => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
                  <option value="">Seleccione Categoría</option>
                  {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-black uppercase text-slate-500">Subcategoría Obuma *</label>
                <select required disabled={!form.categoria_id} className="p-5 bg-slate-100 border border-slate-200 rounded-[1.5rem] font-bold text-sm outline-none disabled:opacity-50" value={form.subcategoria_id} onChange={(e) => sugerirSku(e.target.value)}>
                  <option value="">Seleccione Subcategoría</option>
                  {filteredSubcategorias.map(s => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-black uppercase text-[#00338d] flex justify-between items-center">
                  SKU Generado 
                  {generatingSku && <Loader2 size={14} className="animate-spin" />}
                </label>
                <div className="flex gap-2">
                  <input readOnly className="w-full p-5 bg-slate-200 border border-slate-300 rounded-[1.5rem] font-black text-[#00338d] text-center tracking-widest" value={form.sku} />
                  <button type="button" onClick={() => {navigator.clipboard.writeText(form.sku); alert("Copiado")}} className="p-5 bg-white border border-slate-200 rounded-[1.5rem] hover:bg-slate-50"><Copy size={20}/></button>
                </div>
              </div>
            </div>

            {/* SECCIÓN PRECIOS */}
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-black uppercase text-slate-500">Precio Costo Neto</label>
                <div className="flex items-center gap-3">
                  <div className="relative w-full">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    <input type="number" className="w-full p-5 pl-10 bg-slate-100 border border-slate-200 rounded-[1.5rem] font-bold text-lg" value={form.precio_costo} onChange={(e) => setForm({...form, precio_costo: Number(e.target.value)})} />
                  </div>
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase cursor-pointer min-w-[80px]">
                    <input type="checkbox" className="w-5 h-5 accent-[#00338d]" checked={form.incluye_iva_costo} onChange={(e) => setForm({...form, incluye_iva_costo: e.target.checked})} />
                    + IVA
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-black uppercase text-slate-500">Precio Venta Final</label>
                <div className="flex items-center gap-3">
                  <div className="relative w-full">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    <input type="number" className="w-full p-5 pl-10 bg-slate-100 border border-slate-200 rounded-[1.5rem] font-bold text-lg text-emerald-600" value={form.precio_venta} onChange={(e) => setForm({...form, precio_venta: Number(e.target.value)})} />
                  </div>
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase cursor-pointer min-w-[80px]">
                    <input type="checkbox" className="w-5 h-5 accent-[#00338d]" checked={form.incluye_iva_venta} onChange={(e) => setForm({...form, incluye_iva_venta: e.target.checked})} />
                    + IVA
                  </label>
                </div>
              </div>
            </div>

            {/* SECCIÓN ATRIBUTOS (Los 3 checkboxes de tu captura) */}
            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 flex flex-col justify-center gap-6">
              <label className="flex items-center gap-4 text-xs font-black uppercase text-slate-700 cursor-pointer hover:bg-white p-2 rounded-xl transition-all">
                <input type="checkbox" className="w-6 h-6 accent-[#00338d]" checked={form.se_puede_vender} onChange={(e) => setForm({...form, se_puede_vender: e.target.checked})} />
                ¿Se puede vender?
              </label>
              <label className="flex items-center gap-4 text-xs font-black uppercase text-slate-700 cursor-pointer hover:bg-white p-2 rounded-xl transition-all">
                <input type="checkbox" className="w-6 h-6 accent-[#00338d]" checked={form.se_puede_comprar} onChange={(e) => setForm({...form, se_puede_comprar: e.target.checked})} />
                ¿Se puede comprar?
              </label>
              <label className="flex items-center gap-4 text-xs font-black uppercase text-slate-700 cursor-pointer hover:bg-white p-2 rounded-xl transition-all">
                <input type="checkbox" className="w-6 h-6 accent-[#00338d]" checked={form.se_mantiene_stock} onChange={(e) => setForm({...form, se_mantiene_stock: e.target.checked})} />
                ¿Se mantiene stock?
              </label>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || !form.sku} 
            className="w-full bg-[#00338d] hover:bg-[#00266b] text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-4 transition-transform active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Save size={24} />}
            CREAR PRODUCTO EN OBUMA CL
          </button>
        </form>
      </div>
    </div>
  );
}