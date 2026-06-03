"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Laptop, Smartphone, Plus, Search, Loader2, Trash2, X,
  Edit3, CheckCircle2, Mail, Monitor, Package,
  AlertTriangle, CheckCircle, XCircle, Filter,
  ChevronDown, User, Hash, Calendar, Download
} from "lucide-react";
import * as XLSX from "xlsx";

type EstadoEquipo = "operativo" | "dañado" | "de baja";
type TipoEquipo = "Notebook" | "Telefono" | "Monitor" | "Otro";

const TIPOS: TipoEquipo[] = ["Notebook", "Telefono", "Monitor", "Otro"];
const ESTADOS: EstadoEquipo[] = ["operativo", "dañado", "de baja"];

const estadoColor = (e: string) => ({
  operativo: "bg-emerald-100 text-emerald-600",
  "dañado": "bg-amber-100 text-amber-600",
  "de baja": "bg-rose-100 text-rose-600",
}[e] || "bg-slate-100 text-slate-500");

const tipoIcon = (t: string) => {
  if (t === "Telefono") return <Smartphone size={16} className="text-amber-500" />;
  if (t === "Monitor") return <Monitor size={16} className="text-purple-500" />;
  if (t === "Notebook") return <Laptop size={16} className="text-[#059669]" />;
  return <Package size={16} className="text-slate-400" />;
};

export default function DispositivosPage() {
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [vistaAgrupada, setVistaAgrupada] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tabActivo, setTabActivo] = useState<TipoEquipo>("Notebook");
  const [alert, setAlert] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const [form, setForm] = useState({
    trabajador_id: "",
    tipo: "Notebook" as TipoEquipo,
    marca: "",
    modelo: "",
    serie_imei: "",
    numero_telefono: "",
    nombre_equipo: "",
    estado: "operativo" as EstadoEquipo,
    observacion: "",
  });

  const showAlert = (msg: string, tipo: "ok" | "err" = "ok") => {
    setAlert({ msg, tipo });
    setTimeout(() => setAlert(null), 3500);
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: perfil } = await supabase.from("perfiles").select("rol, permisos").eq("user_id", session.user.id).single();
        const esAdmin = perfil?.rol === "admin" || perfil?.rol === "superuser";
        if (session.user.email === "informatica2.grupoica@gmail.com" || esAdmin || perfil?.permisos?.can_manage_devices) {
          setCanEdit(true);
        }
      }
      await fetchData();
    })();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [resDisp, resUsers] = await Promise.all([
      supabase.from("dispositivos").select("*, perfiles!dispositivos_asignado_a_fkey(nombre, email)").order("created_at", { ascending: false }),
      supabase.from("perfiles").select("user_id, nombre, email").order("nombre", { ascending: true }),
    ]);
    setDispositivos(resDisp.data || []);
    setUsuarios(resUsers.data || []);
    setLoading(false);
  };

  const dispositivosFiltrados = useMemo(() => {
    return dispositivos.filter((d) => {
      const term = searchTerm.toLowerCase();
      const matchText = !term ||
        d.nombre_equipo?.toLowerCase().includes(term) ||
        d.marca?.toLowerCase().includes(term) ||
        d.modelo?.toLowerCase().includes(term) ||
        d.serie_imei?.toLowerCase().includes(term) ||
        d.perfiles?.nombre?.toLowerCase().includes(term);
      const matchEstado = filtroEstado === "todos" || d.estado === filtroEstado;
      const matchTipo = filtroTipo === "todos" || d.tipo === filtroTipo;
      return matchText && matchEstado && matchTipo;
    });
  }, [dispositivos, searchTerm, filtroEstado, filtroTipo]);

  // Grupos por usuario
  const grupos = useMemo(() => {
    const map = new Map<string, any>();
    dispositivosFiltrados.forEach((d) => {
      const key = d.asignado_a || "STOCK";
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          nombre: d.perfiles?.nombre || "BODEGA / STOCK",
          email: d.perfiles?.email || "Sin correo",
          equipos: [],
        });
      }
      map.get(key).equipos.push(d);
    });
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [dispositivosFiltrados]);

  // KPIs
  const total = dispositivos.length;
  const operativos = dispositivos.filter((d) => d.estado === "operativo").length;
  const dañados = dispositivos.filter((d) => d.estado === "dañado").length;
  const deBaja = dispositivos.filter((d) => d.estado === "de baja").length;

  const exportarExcel = () => {
    const rows = dispositivosFiltrados.map((d) => ({
      "Asignado a": d.perfiles?.nombre || "STOCK",
      "Email": d.perfiles?.email || "—",
      "Tipo": d.tipo,
      "Nombre": d.nombre_equipo,
      "Marca": d.marca || "—",
      "Modelo": d.modelo || "—",
      "Serie / IMEI": d.serie_imei || "—",
      "N° Teléfono": d.numero_telefono || "—",
      "Estado": d.estado,
      "Observación": d.observacion || "—",
      "Fecha Asignación": d.created_at ? new Date(d.created_at).toLocaleDateString("es-CL") : "—",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dispositivos");
    ws["!cols"] = [25, 30, 12, 25, 15, 20, 20, 15, 12, 30, 16].map((w) => ({ wch: w }));
    XLSX.writeFile(wb, `Dispositivos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const openNew = () => {
    setEditMode(false);
    setSelectedId(null);
    setTabActivo("Notebook");
    setForm({ trabajador_id: "", tipo: "Notebook", marca: "", modelo: "", serie_imei: "", numero_telefono: "", nombre_equipo: "", estado: "operativo", observacion: "" });
    setShowModal(true);
  };

  const openEdit = (disp: any) => {
    setEditMode(true);
    setSelectedId(disp.id);
    setTabActivo(disp.tipo as TipoEquipo);
    setForm({
      trabajador_id: disp.asignado_a || "",
      tipo: disp.tipo,
      marca: disp.marca || "",
      modelo: disp.modelo || "",
      serie_imei: disp.serie_imei || "",
      numero_telefono: disp.numero_telefono || "",
      nombre_equipo: disp.nombre_equipo || "",
      estado: disp.estado || "operativo",
      observacion: disp.observacion || "",
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditMode(false); setSelectedId(null); };

  const handleSave = async () => {
    const tipo = editMode ? form.tipo : tabActivo;
    if (!editMode && !form.trabajador_id) {
      showAlert("Selecciona un trabajador (o elige STOCK)", "err"); return;
    }
    if (!form.serie_imei && !editMode) {
      showAlert("Ingresa la serie o IMEI del equipo", "err"); return;
    }

    const payload = {
      nombre_equipo: form.nombre_equipo || `${tipo} ${form.marca}`.trim(),
      tipo,
      marca: form.marca,
      modelo: form.modelo,
      serie_imei: form.serie_imei,
      numero_telefono: tipo === "Telefono" ? form.numero_telefono : null,
      asignado_a: form.trabajador_id === "" ? null : form.trabajador_id,
      estado: form.estado,
      observacion: form.observacion || null,
    };

    let error: any = null;
    if (editMode && selectedId) {
      ({ error } = await supabase.from("dispositivos").update(payload).eq("id", selectedId));
    } else {
      ({ error } = await supabase.from("dispositivos").insert([payload]));
    }

    if (error) { showAlert(error.message, "err"); return; }
    showAlert(editMode ? "Dispositivo actualizado correctamente" : "Dispositivo registrado correctamente");
    closeModal();
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este dispositivo del inventario?")) return;
    const { error } = await supabase.from("dispositivos").delete().eq("id", id);
    if (error) { showAlert(error.message, "err"); return; }
    showAlert("Dispositivo eliminado");
    fetchData();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="animate-spin text-[#059669]" size={40} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando inventario...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">

      {/* Alert toast */}
      {alert && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-bold animate-in slide-in-from-top duration-300 ${alert.tipo === "ok" ? "bg-emerald-600" : "bg-rose-600"}`}>
          {alert.tipo === "ok" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {alert.msg}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Equipos", value: total, icon: Package, color: "text-slate-700", bg: "bg-slate-100" },
          { label: "Operativos", value: operativos, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
          { label: "Con Fallas", value: dañados, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-100" },
          { label: "De Baja", value: deBaja, icon: XCircle, color: "text-rose-500", bg: "bg-rose-100" },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${k.bg}`}><k.icon size={18} className={k.color} /></div>
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{k.label}</p>
              <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Barra de control */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input type="text" placeholder="Buscar trabajador, serie, marca..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-[#6EE7B7]" />
          </div>

          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            <option value="todos">Todos los tipos</option>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            <option value="todos">Todos los estados</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>

          <button onClick={() => setVistaAgrupada((v) => !v)}
            className="px-3 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl flex items-center gap-1.5 hover:bg-slate-200 transition-all">
            <Filter size={14} /> {vistaAgrupada ? "Vista Lista" : "Vista Agrupada"}
          </button>

          <button onClick={exportarExcel}
            className="px-3 py-2.5 text-xs font-bold text-white bg-[#059669] rounded-xl flex items-center gap-1.5 hover:bg-[#047857] transition-all shadow-sm">
            <Download size={14} /> Excel
          </button>

          {canEdit && (
            <button onClick={openNew}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-slate-700 transition-all shadow-sm">
              <Plus size={16} /> Nuevo Equipo
            </button>
          )}
        </div>
      </div>

      {/* Vista agrupada por trabajador */}
      {vistaAgrupada ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {grupos.length === 0 ? (
            <div className="col-span-2 text-center py-20 text-slate-400">No hay equipos que coincidan con los filtros.</div>
          ) : grupos.map((grupo) => (
            <div key={grupo.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:border-[#A7F3D0] transition-all group/card">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-base font-black group-hover/card:bg-[#059669] transition-colors">
                    {grupo.nombre.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 uppercase text-sm">{grupo.nombre}</h4>
                    <p className="text-[10px] text-[#059669] font-bold flex items-center gap-1">
                      <Mail size={10} /> {grupo.email}
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                      {grupo.equipos.length} {grupo.equipos.length === 1 ? "equipo" : "equipos"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[...new Set<string>(grupo.equipos.map((e: any) => e.tipo))].map((t: string) => (
                    <span key={t} className="text-[8px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">{t}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {grupo.equipos.map((eq: any) => (
                  <div key={eq.id}
                    className={`group/eq relative flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-transparent transition-all ${canEdit ? "hover:border-[#D1FAE5] hover:bg-white cursor-pointer" : "cursor-default"}`}
                    onClick={() => canEdit && openEdit(eq)}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${eq.tipo === "Telefono" ? "bg-amber-100" : eq.tipo === "Monitor" ? "bg-purple-100" : "bg-[#D1FAE5]"}`}>
                      {tipoIcon(eq.tipo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-slate-700 uppercase truncate">{eq.nombre_equipo}</p>
                      <p className="text-[9px] font-bold text-slate-400 truncate">{eq.marca} {eq.modelo} · {eq.serie_imei}</p>
                      {eq.numero_telefono && <p className="text-[9px] text-slate-400">{eq.numero_telefono}</p>}
                    </div>
                    <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg flex-shrink-0 ${estadoColor(eq.estado)}`}>{eq.estado}</span>
                    {canEdit && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(eq.id); }}
                        className="opacity-0 group-hover/eq:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 transition-all rounded-lg"
                        title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Vista lista plana */
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-4">Tipo</th>
                  <th className="px-5 py-4">Equipo</th>
                  <th className="px-5 py-4">Serie / IMEI</th>
                  <th className="px-5 py-4">Asignado a</th>
                  <th className="px-5 py-4 text-center">Estado</th>
                  {canEdit && <th className="px-5 py-4 text-center">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dispositivosFiltrados.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${d.tipo === "Telefono" ? "bg-amber-100" : d.tipo === "Monitor" ? "bg-purple-100" : "bg-[#D1FAE5]"}`}>
                        {tipoIcon(d.tipo)}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-xs font-bold text-slate-700">{d.nombre_equipo}</p>
                      <p className="text-[9px] text-slate-400">{d.marca} {d.modelo}</p>
                    </td>
                    <td className="px-5 py-3 font-mono text-[10px] text-slate-500">{d.serie_imei || "—"}</td>
                    <td className="px-5 py-3">
                      <p className="text-xs font-bold text-slate-700">{d.perfiles?.nombre || "STOCK"}</p>
                      <p className="text-[9px] text-slate-400">{d.perfiles?.email || "—"}</p>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase ${estadoColor(d.estado)}`}>{d.estado}</span>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-all"><Edit3 size={14} /></button>
                          <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-500 transition-all"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-y-auto max-h-[90vh] relative">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                {editMode ? <Edit3 size={18} className="text-[#059669]" /> : <Plus size={18} className="text-[#059669]" />}
                {editMode ? "Editar Dispositivo" : "Registrar Nuevo Equipo"}
              </h3>
              <button onClick={closeModal} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={22} /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Asignado a */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1.5">Asignar a trabajador</label>
                <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#059669]/20"
                  value={form.trabajador_id} onChange={(e) => setForm({ ...form, trabajador_id: e.target.value })}>
                  <option value="">— BODEGA / STOCK (sin asignar) —</option>
                  {usuarios.map((u) => <option key={u.user_id} value={u.user_id}>{u.nombre} ({u.email})</option>)}
                </select>
              </div>

              {/* Tabs tipo equipo */}
              {!editMode && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">Tipo de equipo</label>
                  <div className="flex gap-2 flex-wrap">
                    {TIPOS.map((t) => (
                      <button key={t} onClick={() => setTabActivo(t)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${tabActivo === t ? "bg-[#059669] text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                        {t === "Notebook" && <Laptop size={13} />}
                        {t === "Telefono" && <Smartphone size={13} />}
                        {t === "Monitor" && <Monitor size={13} />}
                        {t === "Otro" && <Package size={13} />}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Campos del equipo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1.5">Nombre del equipo</label>
                  <input type="text" placeholder={`Ej: Notebook HP EliteBook`}
                    className="w-full p-3 bg-slate-50 rounded-xl text-sm border border-slate-200 outline-none focus:ring-2 focus:ring-[#059669]/20"
                    value={form.nombre_equipo} onChange={(e) => setForm({ ...form, nombre_equipo: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1.5">Marca</label>
                  <input type="text" placeholder="HP, Samsung, Dell..."
                    className="w-full p-3 bg-slate-50 rounded-xl text-sm border border-slate-200 outline-none focus:ring-2 focus:ring-[#059669]/20"
                    value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1.5">Modelo</label>
                  <input type="text" placeholder="ProBook 450 G8, Galaxy A54..."
                    className="w-full p-3 bg-slate-50 rounded-xl text-sm border border-slate-200 outline-none focus:ring-2 focus:ring-[#059669]/20"
                    value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1.5">
                    {tabActivo === "Telefono" ? "IMEI" : "N° Serie"}
                  </label>
                  <input type="text" placeholder={tabActivo === "Telefono" ? "IMEI del teléfono" : "Número de serie"}
                    className="w-full p-3 bg-slate-50 rounded-xl text-sm border border-slate-200 outline-none font-mono focus:ring-2 focus:ring-[#059669]/20"
                    value={form.serie_imei} onChange={(e) => setForm({ ...form, serie_imei: e.target.value })} />
                </div>
                {tabActivo === "Telefono" && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1.5">Número de teléfono</label>
                    <input type="text" placeholder="+56 9 XXXX XXXX"
                      className="w-full p-3 bg-slate-50 rounded-xl text-sm border border-slate-200 outline-none focus:ring-2 focus:ring-[#059669]/20"
                      value={form.numero_telefono} onChange={(e) => setForm({ ...form, numero_telefono: e.target.value })} />
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1.5">Estado</label>
                  <select className="w-full p-3 bg-slate-50 rounded-xl text-sm border border-slate-200 outline-none focus:ring-2 focus:ring-[#059669]/20"
                    value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoEquipo })}>
                    <option value="operativo">Operativo</option>
                    <option value="dañado">Dañado / Con falla</option>
                    <option value="de baja">De Baja / Obsoleto</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1.5">Observaciones</label>
                <textarea rows={2} placeholder="Notas adicionales..."
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm border border-slate-200 outline-none resize-none focus:ring-2 focus:ring-[#059669]/20"
                  value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} />
              </div>

              <button onClick={handleSave}
                className="w-full py-4 bg-[#059669] text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 hover:bg-[#047857] transition-all active:scale-[0.98]">
                <CheckCircle2 size={18} />
                {editMode ? "Guardar cambios" : "Registrar equipo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
