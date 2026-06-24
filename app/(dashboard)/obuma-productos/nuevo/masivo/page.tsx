"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Loader2, AlertCircle, Check, ArrowLeft, UploadCloud, FileSpreadsheet,
  Download, Lock, X, AlertTriangle, Rocket,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Categoria {
  producto_categoria_id: string;
  producto_categoria_nombre: string;
}
interface Subcategoria {
  producto_subcategoria_id: string;
  producto_subcategoria_nombre: string;
  rel_producto_categoria_id: string;
}

// Fila ya procesada lista para previsualizar / enviar
interface FilaProcesada {
  idx: number;
  c1: string; c2: string; c3: string; c4: string;
  tipo: string;
  categoria_id: string;
  categoria_nombre: string;
  subcategoria_id: string;
  subcategoria_nombre: string;
  precio_costo: number;
  precio_venta: number;
  venta_incluye_iva: boolean;
  costo_incluye_iva: boolean;
  se_puede_vender: boolean;
  se_puede_comprar: boolean;
  se_mantiene_stock: boolean;
  producto_vender_en_web: boolean;
  nombre: string;
  problema: string | null;        // error de validación (no se envía)
  duplicado: boolean;             // se omitirá automáticamente
}

interface ResultadoFila {
  fila: number;
  nombre: string;
  sku: string | null;
  estado: 'creado' | 'omitido_duplicado' | 'error';
  detalle?: string;
}

const limpiar = (t: string) =>
  String(t ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const construirNombre = (c1: string, c2: string, c3: string, c4: string) =>
  [limpiar(c1), limpiar(c2), c3 ? `${limpiar(c3)} MT` : "", limpiar(c4)].filter(Boolean).join(" ");

// Normaliza encabezados del Excel para hacerlos flexibles
const normHeader = (h: string) =>
  limpiar(h).replace(/[^A-Z0-9]/g, "");

const toBool = (v: any, def: boolean) => {
  if (v === undefined || v === null || v === "") return def;
  const s = String(v).toUpperCase().trim();
  return ["1", "SI", "SÍ", "TRUE", "VERDADERO", "X", "Y", "YES"].includes(s);
};

export default function CargaMasivaProductos() {
  const [loadingPermisos, setLoadingPermisos] = useState(true);
  const [perfilLogueado, setPerfilLogueado] = useState<any>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<Subcategoria[]>([]);
  const [productosExistentes, setProductosExistentes] = useState<any[]>([]);

  const [fileName, setFileName] = useState<string>("");
  const [filas, setFilas] = useState<FilaProcesada[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ resumen: any; resultados: ResultadoFila[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      setLoadingPermisos(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: miPerfil } = await supabase
            .from('perfiles').select('*').eq('user_id', session.user.id).single();
          setPerfilLogueado(miPerfil);
        }
        const [resCat, resSub, resProd] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias'),
          fetch('/api/obuma/productos/list?limit=1000'),
        ]);
        const dataCat = await resCat.json();
        const dataSub = await resSub.json();
        const dataProd = await resProd.json();
        setCategorias(Array.isArray(dataCat) ? dataCat : []);
        setAllSubcategorias(Array.isArray(dataSub) ? dataSub : []);
        setProductosExistentes(dataProd.data || []);
      } catch {
        setError("Error de conexión con Obuma");
      } finally {
        setLoadingPermisos(false);
      }
    }
    loadData();
  }, []);

  const puedeCrear =
    perfilLogueado?.rol === 'admin' ||
    perfilLogueado?.rol === 'superuser' ||
    perfilLogueado?.permisos?.can_create_products === true;

  // Set de nombres existentes para marcar duplicados en la previsualización
  const nombresExistentes = useMemo(
    () => productosExistentes.map((p) => limpiar(p.nombre)).filter(Boolean),
    [productosExistentes]
  );

  const descargarPlantilla = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["C1 (Tipo)", "C2 (Atributo)", "C3 (Medida)", "C4 (Marca)", "Categoria", "Subcategoria",
       "Precio Costo", "Precio Venta", "Tipo", "Venta Incluye IVA", "Costo Incluye IVA",
       "Vender", "Comprar", "Stock", "Web"],
      ["CABLE", "THHN 12 AWG", "100", "GENERICO", "MATERIALES ELECTRICOS", "CABLES",
       "1200", "1800", "Producto", "NO", "NO", "SI", "SI", "SI", "SI"],
    ]);
    ws['!cols'] = Array(15).fill({ wch: 18 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, "plantilla_carga_masiva_obuma.xlsx");
  };

  const procesarArchivo = (file: File) => {
    setError(null);
    setResultado(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false }) as any[][];
        if (rows.length < 2) {
          setError("El archivo no tiene filas de datos.");
          return;
        }

        // Mapear encabezados → índice de columna
        const headers = (rows[0] || []).map((h) => normHeader(String(h)));
        const col = (...candidatos: string[]) =>
          headers.findIndex((h) => candidatos.some((c) => h.startsWith(normHeader(c))));

        const idx = {
          c1: col("C1", "TIPO"), c2: col("C2", "ATRIBUTO"), c3: col("C3", "MEDIDA"), c4: col("C4", "MARCA"),
          categoria: col("CATEGORIA"), subcategoria: col("SUBCATEGORIA"),
          costo: col("PRECIOCOSTO", "COSTO"), venta: col("PRECIOVENTA", "VENTA"),
          tipo: col("TIPOITEM", "TIPO"),
          ventaIva: col("VENTAINCLUYEIVA"), costoIva: col("COSTOINCLUYEIVA"),
          vender: col("VENDER"), comprar: col("COMPRAR"), stock: col("STOCK"), web: col("WEB"),
        };

        if (idx.categoria < 0 || idx.subcategoria < 0) {
          setError("Faltan columnas obligatorias 'Categoria' y/o 'Subcategoria'. Descarga la plantilla.");
          return;
        }

        const get = (row: any[], i: number) => (i >= 0 ? row[i] : undefined);
        const nombresEnLote = new Set<string>();

        const procesadas: FilaProcesada[] = rows.slice(1).map((row, i) => {
          const catNombre = limpiar(String(get(row, idx.categoria) ?? ""));
          const subNombre = limpiar(String(get(row, idx.subcategoria) ?? ""));

          const cat = categorias.find((c) => limpiar(c.producto_categoria_nombre) === catNombre);
          const sub = allSubcategorias.find(
            (s) =>
              limpiar(s.producto_subcategoria_nombre) === subNombre &&
              (!cat || String(s.rel_producto_categoria_id) === String(cat.producto_categoria_id))
          );

          const c1 = String(get(row, idx.c1) ?? "");
          const c2 = String(get(row, idx.c2) ?? "");
          const c3 = String(get(row, idx.c3) ?? "");
          const c4 = String(get(row, idx.c4) ?? "");
          const nombre = construirNombre(c1, c2, c3, c4);

          let problema: string | null = null;
          if (!nombre) problema = "Nombre vacío (C1..C4 sin datos).";
          else if (!cat) problema = `Categoría "${catNombre}" no existe en Obuma.`;
          else if (!sub) problema = `Subcategoría "${subNombre}" no existe para esa categoría.`;

          const nombreNorm = limpiar(nombre);
          const duplicado =
            !problema &&
            (nombresEnLote.has(nombreNorm) || nombresExistentes.some((n) => n.includes(nombreNorm)));
          if (!problema && !duplicado) nombresEnLote.add(nombreNorm);

          return {
            idx: i + 2, // número de fila en Excel (1 = encabezado)
            c1, c2, c3, c4,
            tipo: String(get(row, idx.tipo) ?? "Producto").toLowerCase().includes("serv") ? "Servicio" : "Producto",
            categoria_id: cat ? String(cat.producto_categoria_id) : "",
            categoria_nombre: cat ? cat.producto_categoria_nombre : catNombre,
            subcategoria_id: sub ? String(sub.producto_subcategoria_id) : "",
            subcategoria_nombre: sub ? sub.producto_subcategoria_nombre : subNombre,
            precio_costo: Number(get(row, idx.costo)) || 0,
            precio_venta: Number(get(row, idx.venta)) || 0,
            venta_incluye_iva: toBool(get(row, idx.ventaIva), false),
            costo_incluye_iva: toBool(get(row, idx.costoIva), false),
            se_puede_vender: toBool(get(row, idx.vender), true),
            se_puede_comprar: toBool(get(row, idx.comprar), true),
            se_mantiene_stock: toBool(get(row, idx.stock), true),
            producto_vender_en_web: toBool(get(row, idx.web), true),
            nombre: nombreNorm,
            problema,
            duplicado: !!duplicado,
          };
        });

        setFilas(procesadas);
      } catch (err: any) {
        setError(`Error leyendo Excel: ${err.message}`);
      }
    };
    reader.onerror = () => setError("Error al leer el archivo.");
    reader.readAsArrayBuffer(file);
  };

  const stats = useMemo(() => {
    const validas = filas.filter((f) => !f.problema && !f.duplicado);
    return {
      total: filas.length,
      aCrear: validas.length,
      duplicados: filas.filter((f) => f.duplicado).length,
      errores: filas.filter((f) => f.problema).length,
    };
  }, [filas]);

  const limpiarTodo = () => {
    setFilas([]);
    setFileName("");
    setResultado(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const enviarLote = async () => {
    if (!puedeCrear) return;
    const productos = filas
      .filter((f) => !f.problema) // los duplicados se mandan; el backend los omite y reporta
      .map((f) => ({
        c1: f.c1, c2: f.c2, c3: f.c3, c4: f.c4,
        tipo: f.tipo,
        categoria_id: f.categoria_id,
        categoria_nombre: f.categoria_nombre,
        subcategoria_id: f.subcategoria_id,
        precio_costo: f.precio_costo,
        precio_venta: f.precio_venta,
        venta_incluye_iva: f.venta_incluye_iva,
        costo_incluye_iva: f.costo_incluye_iva,
        se_puede_vender: f.se_puede_vender,
        se_puede_comprar: f.se_puede_comprar,
        se_mantiene_stock: f.se_mantiene_stock,
        producto_vender_en_web: f.producto_vender_en_web,
      }));

    if (productos.length === 0) {
      setError("No hay filas válidas para enviar.");
      return;
    }

    setEnviando(true);
    setError(null);
    setResultado(null);
    try {
      const res = await fetch('/api/obuma/productos/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productos }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error en la carga masiva.");
      } else {
        setResultado({ resumen: data.resumen, resultados: data.resultados });
      }
    } catch (err: any) {
      setError("Error crítico de servidor: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] p-6 lg:p-12 text-slate-700 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {!loadingPermisos && !puedeCrear && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-700 shadow-sm">
            <Lock size={16} />
            <p className="text-[10px] font-black uppercase tracking-widest">Modo Lectura: Tu cuenta no tiene permisos para crear SKUs en Obuma.</p>
          </div>
        )}

        <div className="flex items-center justify-between px-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter italic uppercase">Carga Masiva</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Crear múltiples SKUs en Obuma desde Excel</p>
          </div>
          <div className="flex gap-3">
            <Link href="/obuma-productos/nuevo" className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-[#2563EB] transition-all shadow-sm flex items-center gap-2">
              <ArrowLeft size={16} /> Crear uno a uno
            </Link>
          </div>
        </div>

        {/* PASO 1: Subir archivo */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-200 space-y-6">
          <div className="flex flex-col md:flex-row items-stretch gap-4">
            <button
              onClick={descargarPlantilla}
              className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-all"
            >
              <Download size={16} /> Descargar plantilla
            </button>

            <label className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase border-2 border-dashed transition-all cursor-pointer
              ${puedeCrear ? 'border-[#2563EB]/30 text-[#2563EB] bg-[#EFF6FF]/40 hover:bg-[#EFF6FF]' : 'border-slate-200 text-slate-300 pointer-events-none'}`}>
              <UploadCloud size={18} />
              {fileName ? fileName : "Seleccionar archivo Excel / CSV"}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={!puedeCrear}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); }}
              />
            </label>

            {filas.length > 0 && (
              <button onClick={limpiarTodo} className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:bg-slate-100 transition-all">
                <X size={16} /> Limpiar
              </button>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl text-sm font-black uppercase italic bg-rose-50 text-rose-600 border border-rose-100">
              <AlertCircle size={20} /> {error}
            </div>
          )}
        </div>

        {/* PASO 2: Previsualización */}
        {filas.length > 0 && !resultado && (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-200 space-y-6">
            <div className="flex flex-wrap gap-3">
              <Badge color="blue" label="Total" value={stats.total} />
              <Badge color="emerald" label="A crear" value={stats.aCrear} />
              <Badge color="amber" label="Duplicados (se omiten)" value={stats.duplicados} />
              <Badge color="rose" label="Con error" value={stats.errores} />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-[9px] font-black uppercase text-slate-400">
                    <th className="p-3">#</th>
                    <th className="p-3">Nombre final</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Subcategoría</th>
                    <th className="p-3 text-right">Costo</th>
                    <th className="p-3 text-right">Venta</th>
                    <th className="p-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.idx} className={`border-t border-slate-100 ${f.problema ? 'bg-rose-50/50' : f.duplicado ? 'bg-amber-50/50' : ''}`}>
                      <td className="p-3 text-slate-400 font-bold">{f.idx}</td>
                      <td className="p-3 font-black uppercase italic text-slate-700">{f.nombre || <span className="text-rose-400">—</span>}</td>
                      <td className="p-3 text-slate-500">{f.categoria_nombre}</td>
                      <td className="p-3 text-slate-500">{f.subcategoria_nombre}</td>
                      <td className="p-3 text-right font-bold">${f.precio_costo.toLocaleString('es-CL')}</td>
                      <td className="p-3 text-right font-black text-[#2563EB]">${f.precio_venta.toLocaleString('es-CL')}</td>
                      <td className="p-3">
                        {f.problema ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-rose-600" title={f.problema}>
                            <AlertCircle size={12} /> Error
                          </span>
                        ) : f.duplicado ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-amber-600" title="Ya existe, se omitirá">
                            <AlertTriangle size={12} /> Duplicado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600">
                            <Check size={12} /> Listo
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Las filas con error no se envían. Los duplicados se omiten automáticamente en Obuma.
              </p>
              <button
                onClick={enviarLote}
                disabled={enviando || !puedeCrear || stats.aCrear === 0}
                className={`flex items-center justify-center gap-3 px-12 py-5 rounded-3xl text-xs font-black uppercase transition-all shadow-xl
                  ${puedeCrear && stats.aCrear > 0
                    ? 'bg-[#2563EB] text-white hover:bg-blue-800 shadow-[0_10px_30px_rgba(0,51,141,0.3)]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
              >
                {enviando ? <Loader2 className="animate-spin" size={20} /> : <Rocket size={20} />}
                {enviando ? "Creando en Obuma..." : `Crear ${stats.aCrear} productos`}
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: Resultado */}
        {resultado && (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-200 space-y-6">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={24} className="text-[#2563EB]" />
              <h2 className="text-xl font-black uppercase italic text-slate-800">Resultado de la carga</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Badge color="emerald" label="Creados" value={resultado.resumen.creados} />
              <Badge color="amber" label="Omitidos (duplicado)" value={resultado.resumen.omitidos} />
              <Badge color="rose" label="Errores" value={resultado.resumen.errores} />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-[400px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-[9px] font-black uppercase text-slate-400">
                    <th className="p-3">#</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.resultados.map((r) => (
                    <tr key={r.fila} className="border-t border-slate-100">
                      <td className="p-3 text-slate-400 font-bold">{r.fila}</td>
                      <td className="p-3 font-black uppercase italic text-slate-700">{r.nombre}</td>
                      <td className="p-3 font-black text-[#2563EB]">{r.sku || "—"}</td>
                      <td className="p-3">
                        {r.estado === 'creado' ? (
                          <span className="text-[9px] font-black uppercase text-emerald-600">✅ Creado</span>
                        ) : r.estado === 'omitido_duplicado' ? (
                          <span className="text-[9px] font-black uppercase text-amber-600">⚠️ Omitido</span>
                        ) : (
                          <span className="text-[9px] font-black uppercase text-rose-600">❌ Error</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 text-[10px]">{r.detalle || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4 justify-end">
              <button onClick={limpiarTodo} className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:bg-slate-100">
                Cargar otro archivo
              </button>
              <Link href="/obuma-productos?created=true" className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase bg-[#2563EB] text-white hover:bg-blue-800 shadow-lg">
                Ir al listado
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ color, label, value }: { color: 'blue' | 'emerald' | 'amber' | 'rose'; label: string; value: number }) {
  const styles: Record<string, string> = {
    blue: "bg-[#EFF6FF] text-[#2563EB] border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };
  return (
    <div className={`px-5 py-3 rounded-2xl border ${styles[color]}`}>
      <div className="text-2xl font-black italic leading-none">{value}</div>
      <div className="text-[9px] font-black uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}
