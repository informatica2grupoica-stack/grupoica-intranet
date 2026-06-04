"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  GraduationCap, Plus, Search, Loader2, X, Edit3, Trash2,
  Users, FileText, Upload, Eye, Clock, Calendar, Building2,
  CheckCircle2, AlertCircle, BookOpen, Monitor, Award,
  ChevronDown, Download, UserCheck, UserMinus, Filter
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Capacitacion {
  id: string;
  nombre: string;
  proveedor: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  horas_total: number | null;
  modalidad: string | null;
  costo: number | null;
  descripcion: string | null;
  archivo_url: string | null;
  tipo_archivo: string | null;
  activo: boolean;
  created_at: string;
}

interface PerfilAsignacion {
  id: string;
  nombre: string;
  apellido: string;
  cargo: string | null;
  rol: string;
  asignado: boolean;
}

const MODALIDADES = ["presencial", "online", "mixto"];

const modalidadColor = (m: string | null) => ({
  presencial: "bg-blue-100 text-blue-700",
  online: "bg-purple-100 text-purple-700",
  mixto: "bg-amber-100 text-amber-700",
}[m || ""] || "bg-slate-100 text-slate-500");

const modalidadIcon = (m: string | null) => ({
  presencial: <Building2 className="w-3.5 h-3.5" />,
  online: <Monitor className="w-3.5 h-3.5" />,
  mixto: <BookOpen className="w-3.5 h-3.5" />,
}[m || ""] || <BookOpen className="w-3.5 h-3.5" />);

const fmtFecha = (f: string | null) =>
  f ? new Date(f).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtMoneda = (n: number | null) =>
  n ? `$${n.toLocaleString("es-CL")}` : "—";

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CapacitacionesPage() {
  const [perfilId, setPerfilId] = useState<string>("");
  const [userRol, setUserRol] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Vista admin
  const [capacitaciones, setCapacitaciones] = useState<Capacitacion[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<string>("todos");

  // Vista usuario
  const [misCapacitaciones, setMisCapacitaciones] = useState<any[]>([]);

  // Modales
  const [modalForm, setModalForm] = useState(false);
  const [editando, setEditando] = useState<Capacitacion | null>(null);
  const [modalAsignar, setModalAsignar] = useState<Capacitacion | null>(null);
  const [modalViewer, setModalViewer] = useState<{ cap: Capacitacion | any; signedUrl: string } | null>(null);

  // Asignaciones
  const [perfilesAsig, setPerfilesAsig] = useState<PerfilAsignacion[]>([]);
  const [busquedaAsig, setBusquedaAsig] = useState("");
  const [loadingAsig, setLoadingAsig] = useState(false);
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());

  // Form
  const formInit = {
    nombre: "", proveedor: "", fecha_inicio: "", fecha_fin: "",
    horas_total: "", modalidad: "", costo: "", descripcion: "", activo: true,
  };
  const [form, setForm] = useState(formInit);
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const esAdminOSuper = userRol === "admin" || userRol === "superuser";

  const showToast = (msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("id, rol")
        .eq("user_id", session.user.id)
        .single();
      if (perfil) {
        setPerfilId(perfil.id);
        setUserRol(perfil.rol);
        if (perfil.rol === "admin" || perfil.rol === "superuser") {
          await fetchCapacitaciones();
        } else {
          await fetchMisCapacitaciones(perfil.id);
        }
      }
      setLoading(false);
    })();
  }, []);

  const fetchCapacitaciones = async () => {
    const res = await fetch("/api/rrhh/capacitaciones?limit=100");
    const json = await res.json();
    if (json.success) setCapacitaciones(json.data);
  };

  const fetchMisCapacitaciones = async (pid: string) => {
    const res = await fetch(`/api/capacitaciones/mis?perfil_id=${pid}`);
    const json = await res.json();
    if (json.success) setMisCapacitaciones(json.data);
  };

  // ─── Filtro admin ─────────────────────────────────────────────────────────
  const capsFiltradas = capacitaciones.filter(c => {
    const matchBusq = !busqueda ||
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.proveedor || "").toLowerCase().includes(busqueda.toLowerCase());
    const matchActivo = filtroActivo === "todos"
      ? true
      : filtroActivo === "activas" ? c.activo : !c.activo;
    return matchBusq && matchActivo;
  });

  // ─── Subida de archivo ────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const esValido = file.type === "application/pdf" ||
      file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      file.name.endsWith(".pptx");
    if (!esValido) {
      showToast("Solo se permiten archivos PDF o PPTX", "err");
      return;
    }
    setArchivoPendiente(file);
  };

  const subirArchivo = async (): Promise<{ archivo_url: string; tipo_archivo: string } | null> => {
    if (!archivoPendiente) return null;
    setSubiendoArchivo(true);
    try {
      const tipo_archivo = archivoPendiente.name.endsWith(".pptx") ? "pptx" : "pdf";

      // 1. Pedir URL firmada al servidor (crea el bucket si no existe)
      const res = await fetch("/api/capacitaciones/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo_archivo }),
      });
      const urlData = await res.json();
      if (urlData.error) throw new Error(urlData.error);

      const { bucket, path, token } = urlData;

      // 2. Subir usando uploadToSignedUrl del cliente Supabase (igual que buscador-productos)
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(path, token, archivoPendiente);

      if (upErr) throw new Error(`Error subiendo archivo: ${upErr.message}`);

      return { archivo_url: path, tipo_archivo };
    } catch (e: any) {
      showToast(`Error al subir: ${e.message}`, "err");
      return null;
    } finally {
      setSubiendoArchivo(false);
    }
  };

  // ─── Guardar capacitación ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.nombre.trim()) { showToast("El nombre es obligatorio", "err"); return; }
    setSavingForm(true);
    try {
      let archivo_url = editando?.archivo_url || null;
      let tipo_archivo = editando?.tipo_archivo || null;

      if (archivoPendiente) {
        const subirResult = await subirArchivo();
        if (!subirResult) { setSavingForm(false); return; }
        archivo_url = subirResult.archivo_url;
        tipo_archivo = subirResult.tipo_archivo;
      }

      const payload = {
        nombre: form.nombre.trim(),
        proveedor: form.proveedor || null,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        horas_total: form.horas_total ? parseInt(form.horas_total) : null,
        modalidad: form.modalidad || null,
        costo: form.costo ? parseInt(form.costo) : null,
        descripcion: form.descripcion || null,
        activo: form.activo,
        archivo_url,
        tipo_archivo,
        created_by: perfilId,
      };

      if (editando) {
        const res = await fetch(`/api/rrhh/capacitaciones/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        showToast("Capacitación actualizada");
      } else {
        const res = await fetch("/api/rrhh/capacitaciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        showToast("Capacitación creada");
      }

      setModalForm(false);
      setEditando(null);
      setForm(formInit);
      setArchivoPendiente(null);
      await fetchCapacitaciones();
    } catch (e: any) {
      showToast(e.message, "err");
    } finally {
      setSavingForm(false);
    }
  };

  // ─── Eliminar capacitación ────────────────────────────────────────────────
  const handleDelete = async (cap: Capacitacion) => {
    if (!confirm(`¿Eliminar "${cap.nombre}"? Esta acción es irreversible.`)) return;
    const res = await fetch(`/api/rrhh/capacitaciones/${cap.id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      showToast("Capacitación eliminada");
      await fetchCapacitaciones();
    } else {
      showToast(json.error, "err");
    }
  };

  // ─── Abrir modal edición ──────────────────────────────────────────────────
  const abrirEdicion = (cap: Capacitacion) => {
    setEditando(cap);
    setForm({
      nombre: cap.nombre,
      proveedor: cap.proveedor || "",
      fecha_inicio: cap.fecha_inicio?.slice(0, 10) || "",
      fecha_fin: cap.fecha_fin?.slice(0, 10) || "",
      horas_total: cap.horas_total?.toString() || "",
      modalidad: cap.modalidad || "",
      costo: cap.costo?.toString() || "",
      descripcion: cap.descripcion || "",
      activo: cap.activo,
    });
    setArchivoPendiente(null);
    setModalForm(true);
  };

  // ─── Asignaciones ─────────────────────────────────────────────────────────
  const abrirAsignar = async (cap: Capacitacion) => {
    setModalAsignar(cap);
    setLoadingAsig(true);
    setPendientes(new Set());
    setBusquedaAsig("");
    const res = await fetch(`/api/capacitaciones/asignar?capacitacion_id=${cap.id}`);
    const json = await res.json();
    if (json.success) setPerfilesAsig(json.perfiles);
    setLoadingAsig(false);
  };

  const toggleAsignacion = (pid: string) => {
    setPendientes(prev => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  };

  const guardarAsignaciones = async () => {
    if (!modalAsignar || pendientes.size === 0) return;
    setLoadingAsig(true);

    const asignar = [...pendientes].filter(pid => {
      const p = perfilesAsig.find(x => x.id === pid);
      return p && !p.asignado;
    });
    const desasignar = [...pendientes].filter(pid => {
      const p = perfilesAsig.find(x => x.id === pid);
      return p && p.asignado;
    });

    try {
      if (asignar.length > 0) {
        await fetch("/api/capacitaciones/asignar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capacitacion_id: modalAsignar.id,
            perfil_ids: asignar,
            asignado_por: perfilId,
          }),
        });
      }
      if (desasignar.length > 0) {
        await fetch("/api/capacitaciones/asignar", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capacitacion_id: modalAsignar.id,
            perfil_ids: desasignar,
          }),
        });
      }
      showToast("Asignaciones guardadas");
      setModalAsignar(null);
    } catch {
      showToast("Error al guardar asignaciones", "err");
    } finally {
      setLoadingAsig(false);
    }
  };

  // ─── Visor de archivo ─────────────────────────────────────────────────────
  const abrirViewer = async (cap: Capacitacion | any) => {
    if (!cap.archivo_url) { showToast("Esta capacitación no tiene archivo adjunto", "err"); return; }
    const res = await fetch("/api/capacitaciones/view-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: cap.archivo_url }),
    });
    const { signedUrl, error } = await res.json();
    if (error) { showToast(error, "err"); return; }
    setModalViewer({ cap, signedUrl });
  };

  const viewerUrl = useCallback((signedUrl: string, tipoArchivo: string | null) => {
    if (tipoArchivo === "pptx") {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`;
    }
    return signedUrl;
  }, []);

  // ─── Render loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#059669]" />
      </div>
    );
  }

  // ─── Vista usuario normal ─────────────────────────────────────────────────
  if (!esAdminOSuper) {
    return (
      <div>
        {/* Toast */}
        {toast && (
          <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all
            ${toast.tipo === "ok" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
            {toast.tipo === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">Mis Capacitaciones</h2>
            <p className="text-xs text-slate-400">{misCapacitaciones.length} capacitación{misCapacitaciones.length !== 1 ? "es" : ""} asignada{misCapacitaciones.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {misCapacitaciones.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No tienes capacitaciones asignadas</p>
            <p className="text-xs text-slate-400 mt-1">Cuando un administrador te asigne una capacitación aparecerá aquí.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {misCapacitaciones.map(cap => (
              <div key={cap.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 text-sm leading-snug">{cap.nombre}</h3>
                    {cap.proveedor && <p className="text-xs text-slate-500 mt-0.5">{cap.proveedor}</p>}
                  </div>
                  {cap.completado && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full shrink-0">
                      <Award className="w-3 h-3" /> Completado
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {cap.modalidad && (
                    <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${modalidadColor(cap.modalidad)}`}>
                      {modalidadIcon(cap.modalidad)} {cap.modalidad}
                    </span>
                  )}
                  {cap.horas_total && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" /> {cap.horas_total}h
                    </span>
                  )}
                </div>

                {(cap.fecha_inicio || cap.fecha_fin) && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {fmtFecha(cap.fecha_inicio)} — {fmtFecha(cap.fecha_fin)}
                  </div>
                )}

                {cap.descripcion && (
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{cap.descripcion}</p>
                )}

                <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className={`flex items-center gap-1 text-[10px] font-medium ${cap.archivo_url ? "text-[#059669]" : "text-slate-400"}`}>
                    <FileText className="w-3.5 h-3.5" />
                    {cap.archivo_url ? `Archivo ${cap.tipo_archivo?.toUpperCase() || "adjunto"}` : "Sin archivo"}
                  </span>
                  {cap.archivo_url && (
                    <button
                      onClick={() => abrirViewer(cap)}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#059669] to-[#10B981] px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver contenido
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal visor */}
        {modalViewer && (
          <ModalViewer
            cap={modalViewer.cap}
            signedUrl={modalViewer.signedUrl}
            viewerUrl={viewerUrl}
            onClose={() => setModalViewer(null)}
          />
        )}
      </div>
    );
  }

  // ─── Vista administrador ──────────────────────────────────────────────────
  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all
          ${toast.tipo === "ok" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
          {toast.tipo === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header admin */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">Gestión de Capacitaciones</h2>
            <p className="text-xs text-slate-400">{capacitaciones.length} capacitación{capacitaciones.length !== 1 ? "es" : ""} registrada{capacitaciones.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button
          onClick={() => { setEditando(null); setForm(formInit); setArchivoPendiente(null); setModalForm(true); }}
          className="flex items-center gap-2 bg-gradient-to-r from-[#059669] to-[#10B981] text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nueva Capacitación
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: capacitaciones.length, color: "text-slate-800", bg: "bg-slate-50", border: "border-slate-200" },
          { label: "Activas", value: capacitaciones.filter(c => c.activo).length, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
          { label: "Con archivo", value: capacitaciones.filter(c => c.archivo_url).length, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
          { label: "Inactivas", value: capacitaciones.filter(c => !c.activo).length, color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-4`}>
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-black ${s.color} mt-1`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o proveedor…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 bg-white"
          />
        </div>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {[["todos", "Todos"], ["activas", "Activas"], ["inactivas", "Inactivas"]].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFiltroActivo(k)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${filtroActivo === k ? "bg-[#059669] text-white" : "text-slate-500 hover:bg-slate-100"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {capsFiltradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No hay capacitaciones</p>
          <p className="text-xs text-slate-400 mt-1">Crea la primera con el botón "Nueva Capacitación".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {capsFiltradas.map(cap => (
            <div key={cap.id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3 ${cap.activo ? "border-slate-200" : "border-rose-100 opacity-75"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-800 text-sm leading-snug">{cap.nombre}</h3>
                    {!cap.activo && (
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Inactiva</span>
                    )}
                  </div>
                  {cap.proveedor && <p className="text-xs text-slate-500">{cap.proveedor}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => abrirViewer(cap)}
                    title="Ver archivo"
                    disabled={!cap.archivo_url}
                    className={`p-2 rounded-lg transition-colors ${cap.archivo_url ? "text-blue-600 hover:bg-blue-50" : "text-slate-300 cursor-not-allowed"}`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => abrirAsignar(cap)} title="Asignar perfiles" className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                    <Users className="w-4 h-4" />
                  </button>
                  <button onClick={() => abrirEdicion(cap)} title="Editar" className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(cap)} title="Eliminar" className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {cap.modalidad && (
                  <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${modalidadColor(cap.modalidad)}`}>
                    {modalidadIcon(cap.modalidad)} {cap.modalidad}
                  </span>
                )}
                {cap.horas_total && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                    <Clock className="w-3 h-3" /> {cap.horas_total}h
                  </span>
                )}
                {cap.costo && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                    {fmtMoneda(cap.costo)}
                  </span>
                )}
                {cap.archivo_url && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-[#059669] bg-emerald-50 px-2 py-1 rounded-full">
                    <FileText className="w-3 h-3" /> {cap.tipo_archivo?.toUpperCase() || "Archivo"}
                  </span>
                )}
              </div>

              {(cap.fecha_inicio || cap.fecha_fin) && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {fmtFecha(cap.fecha_inicio)} — {fmtFecha(cap.fecha_fin)}
                </div>
              )}

              {cap.descripcion && (
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{cap.descripcion}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Modal Crear/Editar ────────────────────────────────────────────── */}
      {modalForm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-800">
                {editando ? "Editar Capacitación" : "Nueva Capacitación"}
              </h3>
              <button onClick={() => setModalForm(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre <span className="text-rose-500">*</span></label>
                <input
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Excel Avanzado"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30"
                />
              </div>

              {/* Proveedor + Modalidad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Proveedor / Institución</label>
                  <input
                    value={form.proveedor}
                    onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))}
                    placeholder="Ej: SENCE"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Modalidad</label>
                  <select
                    value={form.modalidad}
                    onChange={e => setForm(f => ({ ...f, modalidad: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 bg-white"
                  >
                    <option value="">Sin especificar</option>
                    {MODALIDADES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Fecha inicio</label>
                  <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Fecha fin</label>
                  <input type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30" />
                </div>
              </div>

              {/* Horas + Costo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Horas totales</label>
                  <input type="number" min="0" value={form.horas_total} onChange={e => setForm(f => ({ ...f, horas_total: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Costo (CLP)</label>
                  <input type="number" min="0" value={form.costo} onChange={e => setForm(f => ({ ...f, costo: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30" />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={3}
                  placeholder="Describe el contenido de esta capacitación…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 resize-none"
                />
              </div>

              {/* Archivo */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Archivo (PDF o PPTX)</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-[#059669] rounded-xl p-5 text-center cursor-pointer transition-colors"
                >
                  <input ref={fileInputRef} type="file" accept=".pdf,.pptx" className="hidden" onChange={handleFileChange} />
                  {archivoPendiente ? (
                    <div className="flex items-center justify-center gap-2 text-[#059669]">
                      <FileText className="w-5 h-5" />
                      <span className="text-sm font-medium">{archivoPendiente.name}</span>
                      <button onClick={e => { e.stopPropagation(); setArchivoPendiente(null); }} className="text-rose-400 hover:text-rose-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : editando?.archivo_url ? (
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                      <FileText className="w-5 h-5 text-[#059669]" />
                      <span className="text-sm">Archivo actual: <strong>{editando.tipo_archivo?.toUpperCase()}</strong></span>
                      <span className="text-xs text-slate-400">(clic para reemplazar)</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Arrastra o haz clic para subir</p>
                      <p className="text-xs text-slate-400 mt-1">PDF o PPTX · máx 100 MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Activo */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                  className={`w-11 h-6 rounded-full transition-colors ${form.activo ? "bg-[#059669]" : "bg-slate-300"} relative`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.activo ? "translate-x-5.5" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">Capacitación activa</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-100">
              <button onClick={() => setModalForm(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={savingForm || subiendoArchivo}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#059669] to-[#10B981] text-white text-sm font-bold hover:opacity-90 disabled:opacity-60"
              >
                {(savingForm || subiendoArchivo) && <Loader2 className="w-4 h-4 animate-spin" />}
                {editando ? "Guardar cambios" : "Crear capacitación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Asignar perfiles ────────────────────────────────────────── */}
      {modalAsignar && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800">Asignar perfiles</h3>
                <p className="text-xs text-slate-400 mt-0.5">{modalAsignar.nombre}</p>
              </div>
              <button onClick={() => setModalAsignar(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={busquedaAsig}
                  onChange={e => setBusquedaAsig(e.target.value)}
                  placeholder="Buscar perfil…"
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30"
                />
              </div>
              {pendientes.size > 0 && (
                <p className="text-xs text-[#059669] font-medium mt-2">{pendientes.size} cambio{pendientes.size !== 1 ? "s" : ""} pendiente{pendientes.size !== 1 ? "s" : ""}</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {loadingAsig ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#059669]" /></div>
              ) : perfilesAsig
                    .filter(p =>
                      !busquedaAsig ||
                      `${p.nombre} ${p.apellido}`.toLowerCase().includes(busquedaAsig.toLowerCase()) ||
                      (p.cargo || "").toLowerCase().includes(busquedaAsig.toLowerCase())
                    )
                    .map(p => {
                      const asignadoActual = pendientes.has(p.id) ? !p.asignado : p.asignado;
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleAsignacion(p.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            asignadoActual
                              ? "border-[#059669]/30 bg-emerald-50"
                              : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${asignadoActual ? "bg-[#059669]" : "bg-slate-300"}`}>
                            {p.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-700 truncate">{p.nombre} {p.apellido}</p>
                            {p.cargo && <p className="text-xs text-slate-400 truncate">{p.cargo}</p>}
                          </div>
                          {asignadoActual
                            ? <UserCheck className="w-4 h-4 text-[#059669] shrink-0" />
                            : <UserMinus className="w-4 h-4 text-slate-300 shrink-0" />
                          }
                        </button>
                      );
                    })
              }
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-slate-100">
              <button onClick={() => setModalAsignar(null)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={guardarAsignaciones}
                disabled={loadingAsig || pendientes.size === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#059669] to-[#10B981] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
              >
                {loadingAsig && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar asignaciones
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal visor */}
      {modalViewer && (
        <ModalViewer
          cap={modalViewer.cap}
          signedUrl={modalViewer.signedUrl}
          viewerUrl={viewerUrl}
          onClose={() => setModalViewer(null)}
        />
      )}
    </div>
  );
}

// ─── Modal visor de archivos ─────────────────────────────────────────────────
function ModalViewer({
  cap, signedUrl, viewerUrl, onClose,
}: {
  cap: any;
  signedUrl: string;
  viewerUrl: (url: string, tipo: string | null) => string;
  onClose: () => void;
}) {
  const url = viewerUrl(signedUrl, cap.tipo_archivo);
  const esPptx = cap.tipo_archivo === "pptx";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col" style={{ height: "90vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#059669]" />
            <div>
              <h3 className="font-black text-slate-800 text-sm">{cap.nombre}</h3>
              <p className="text-xs text-slate-400">{cap.tipo_archivo?.toUpperCase() || "Archivo"} · {cap.proveedor || "Sin proveedor"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={signedUrl}
              download
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" /> Descargar
            </a>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-3 bg-slate-100 rounded-b-2xl">
          {esPptx ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <p className="text-sm text-slate-500">Cargando visor de PowerPoint…</p>
              <iframe
                src={url}
                className="w-full h-full rounded-xl border-0 bg-white"
                allowFullScreen
                title={cap.nombre}
              />
            </div>
          ) : (
            <iframe
              src={url}
              className="w-full h-full rounded-xl border-0"
              title={cap.nombre}
            />
          )}
        </div>
      </div>
    </div>
  );
}
