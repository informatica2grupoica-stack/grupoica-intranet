"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Database, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Search, ExternalLink, Clock, Building2, Wallet, Tag,
  Eye, Star, Trash2, FileText, Users, Gavel, MessageSquare,
  History, ChevronRight, Info, ShieldAlert, Mail, UserCheck, UserX, Contact,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { TableSkeleton } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import Paginacion from "@/components/Paginacion";

// ─────────────────────────────────────────────────────────────
// Diccionario de columnas — espejo de bi-export-client-guide.md
// ─────────────────────────────────────────────────────────────
interface ColDef { key: string; label: string; desc: string }
interface ColGroup { title: string; icon: any; cols: ColDef[] }

const COLUMN_GROUPS: ColGroup[] = [
  {
    title: "Identificadores cliente / workspace",
    icon: Building2,
    cols: [
      { key: "CLIENT_TAX_NUMBER", label: "RUT Cliente", desc: "RUT del cliente dueño del workspace (Workspaces.interested_tax_number)." },
      { key: "WORKSPACE_TITLE", label: "Workspace", desc: "Nombre del workspace en LiciTaLab." },
      { key: "WORKSPACE_ID", label: "Workspace ID", desc: "Identificador único del workspace." },
    ],
  },
  {
    title: "Identificadores y datos de la oportunidad",
    icon: FileText,
    cols: [
      { key: "OPPORTUNITY_ID", label: "ID Oportunidad", desc: "ID interno de la oportunidad en LiciTaLab." },
      { key: "OPPORTUNITY_CODE", label: "Código", desc: "Código público de la licitación / compra ágil (ej. 1234-5-LE25)." },
      { key: "OPPORTUNITY_TYPE", label: "Tipo", desc: "Tipo de oportunidad (tender, agile, etc.)." },
      { key: "OPPORTUNITY_NAME", label: "Nombre", desc: "Nombre / título de la oportunidad." },
      { key: "OPPORTUNITY_DESCRIPTION", label: "Descripción", desc: "Descripción larga publicada por el organismo." },
      { key: "PUBLISH_DATE", label: "Fecha publicación", desc: "Fecha de publicación en el portal de origen." },
      { key: "CLOSING_DATE", label: "Fecha cierre", desc: "Fecha y hora de cierre de recepción de ofertas." },
      { key: "ORGANISM", label: "Organismo", desc: "Nombre del organismo comprador." },
      { key: "ORGANISM_ID", label: "ID Organismo", desc: "Identificador del organismo en el origen." },
      { key: "ORGANISM_CATEGORY", label: "Categoría organismo", desc: "Categoría del organismo (Salud, Educación, Municipal, etc.)." },
      { key: "TENDER_TYPE", label: "Tipo licitación", desc: "Tipo / modalidad de licitación (LE, LP, LQ, etc.)." },
      { key: "REGION", label: "Región", desc: "Región geográfica asociada a la oportunidad." },
      { key: "NOMENCLATURE", label: "Nomenclatura", desc: "Nomenclatura / clasificación de la oportunidad." },
      { key: "CURRENCY", label: "Moneda", desc: "Moneda en la que está expresado el monto (CLP, USD, UF, etc.)." },
      { key: "AVAILABLE_AMOUNT", label: "Monto disponible", desc: "Monto referencial / disponible publicado por el organismo." },
      { key: "STATUS", label: "Estado origen", desc: "Estado de la oportunidad en el origen (publicada, cerrada, adjudicada, desierta, etc.)." },
      { key: "OPPORTUNITY_STATUS", label: "Estado normalizado", desc: "Estado normalizado para reportería interna LiciTaLab." },
      { key: "TOTAL_QUOTES", label: "Total cotizaciones", desc: "Cantidad total de cotizaciones / ofertas recibidas." },
    ],
  },
  {
    title: "Estado de gestión interna del workspace",
    icon: Tag,
    cols: [
      { key: "IS_FOLLOWED", label: "Seguimiento", desc: "TRUE si la oportunidad fue marcada para seguimiento por el equipo." },
      { key: "IS_READ", label: "Leída", desc: "TRUE si algún miembro del workspace ya la abrió." },
      { key: "IS_DISCARTED", label: "Descartada", desc: "TRUE si la oportunidad fue descartada manualmente." },
      { key: "MANAGED_STATUS", label: "Código gestión", desc: "Código numérico del estado de gestión (0–5)." },
      { key: "MANAGED_STATUS_NAME", label: "Estado gestión", desc: "Texto del estado de gestión: Seguimiento, Postulado, Rechazado, Aceptado, Perdida, Ganada, Sin Definir." },
      { key: "APPLIED_AMOUNT", label: "Monto postulado", desc: "Monto con el que se postuló a la oportunidad (si aplica)." },
      { key: "ACTUAL_APPLICATION_DATE", label: "Fecha postulación", desc: "Fecha real en que el equipo postuló." },
      { key: "WON_AMOUNT", label: "Monto ganado", desc: "Monto adjudicado al cliente cuando la oportunidad fue ganada." },
      { key: "TAGS", label: "Tags (códigos)", desc: "Tags crudos (códigos) asignados a la oportunidad en el workspace." },
      { key: "TRANSLATED_TAGS", label: "Tags (texto)", desc: "Mismos tags pero traducidos al texto definido en la configuración del workspace." },
      { key: "B_LINE", label: "Línea de negocio", desc: "Línea de negocio (business line) asociada por el cliente." },
      { key: "MEMBER_ID", label: "ID Miembro", desc: "ID del miembro del workspace asignado a la oportunidad." },
      { key: "SUGGESTED_AT", label: "Sugerida el", desc: "Fecha en que la oportunidad fue sugerida automáticamente al workspace." },
    ],
  },
  {
    title: "Member / usuario asignado",
    icon: Users,
    cols: [
      { key: "MEMBER_NAME", label: "Nombre miembro", desc: "Nombre del miembro responsable de la oportunidad." },
      { key: "MEMBER_TYPE", label: "Tipo miembro", desc: "Tipo de miembro (interno, contacto externo, etc.)." },
      { key: "MEMBER_ACTIVE", label: "Miembro activo", desc: "TRUE si el miembro sigue activo en el workspace." },
      { key: "IS_CONTACT", label: "Es contacto externo", desc: "TRUE si el miembro es un contacto externo (no usuario LiciTaLab)." },
      { key: "USER_ID", label: "ID Usuario", desc: "ID del usuario LiciTaLab vinculado al miembro (si existe)." },
      { key: "USER_MAIL", label: "Email usuario", desc: "Email del usuario asignado." },
    ],
  },
  {
    title: "Datos de contrato y adjudicación",
    icon: Gavel,
    cols: [
      { key: "CONTRACT_DURATION_FIXED", label: "Duración contrato", desc: "Duración numérica del contrato según las bases (valor sin unidad)." },
      { key: "CONTRACT_DURATION_UNIT_TUNED", label: "Unidad duración", desc: "Unidad de la duración: Horas, Dias, Semanas, Meses o No especificado." },
      { key: "AWARDING_TUNED", label: "Fecha adjudicación", desc: "Fecha de adjudicación de la licitación." },
      { key: "FIN_CONTRATO_ESTIMADO_TUNED", label: "Fin contrato estimado", desc: "Fecha estimada de fin de contrato (AWARDING_TUNED + duración). NULL si la unidad es horas o no está especificada." },
      { key: "TOTAL_AWARDED_AMOUNT", label: "Total adjudicado", desc: "Suma de los montos adjudicados a todos los proveedores en la oportunidad." },
      { key: "AWARDED_PROVIDERS", label: "Proveedores adjudicados", desc: "Lista (RUT - Razón Social; ...) de los proveedores adjudicados." },
    ],
  },
  {
    title: "Comentarios",
    icon: MessageSquare,
    cols: [
      { key: "COMMENTS", label: "Comentarios", desc: "Historial de comentarios internos del workspace, concatenados con formato [YYYY-MM-DD Autor] comentario | ... ordenado cronológicamente." },
    ],
  },
  {
    title: "Lifecycle (acumulativo)",
    icon: History,
    cols: [
      { key: "IS_ACTIVE_IN_SOURCE", label: "Activa en origen", desc: "TRUE si la oportunidad sigue vigente en el origen (Postgres). FALSE si fue eliminada." },
      { key: "FIRST_SEEN_IN_SOURCE_AT", label: "Primera vez vista", desc: "Primera vez que la oportunidad fue ingestada al data lake." },
      { key: "LAST_SEEN_IN_SOURCE_AT", label: "Última vez vista", desc: "Última vez que se confirmó su existencia en el origen." },
      { key: "SOURCE_DELETED_AT", label: "Eliminada el", desc: "Timestamp en que dejó de aparecer en el origen (cuando IS_ACTIVE_IN_SOURCE = FALSE)." },
      { key: "CREATED_AT", label: "Creado", desc: "Fecha de creación del registro de oportunidad." },
      { key: "UPDATED_AT", label: "Actualizado", desc: "Última actualización del registro en silver." },
    ],
  },
];

const ALL_COLS = COLUMN_GROUPS.flatMap((g) => g.cols);
const PAGE_SIZE = 10;

// ─────────────────────────────────────────────────────────────
// Helpers de formato
// ─────────────────────────────────────────────────────────────
function fmtValue(key: string, value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (/_AT$|_DATE$/.test(key)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("es-CL", { year: "numeric", month: "short", day: "numeric" });
  }
  if (/AMOUNT$/.test(key) && typeof value === "number") {
    return value.toLocaleString("es-CL");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isTrue(v: any) {
  return v === true || v === "true" || v === "TRUE" || v === 1 || v === "1";
}

// ─────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────
export default function BiExportPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [soloActivas, setSoloActivas] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bi-export");
      const json = await res.json();
      if (!res.ok || json.error) {
        setError({ message: json.error || `Error ${res.status}`, status: json.status || res.status });
        setRows([]);
      } else {
        setRows(Array.isArray(json.rows) ? json.rows : []);
        setFetchedAt(json.fetchedAt || null);
      }
    } catch (err: any) {
      setError({ message: err?.message || "Error de red al consultar la API." });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);
  useEffect(() => { setPage(1); }, [search, soloActivas]);
  useEffect(() => { setMemberPage(1); }, [memberSearch]);

  // ── KPIs ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = rows.length;
    const activas = rows.filter((r) => isTrue(r.IS_ACTIVE_IN_SOURCE)).length;
    const seguimiento = rows.filter((r) => isTrue(r.IS_FOLLOWED)).length;
    const descartadas = rows.filter((r) => isTrue(r.IS_DISCARTED)).length;
    const ganadas = rows.filter((r) => (r.MANAGED_STATUS_NAME || "").toString().toLowerCase() === "ganada").length;
    const montoGanado = rows.reduce((s, r) => s + (Number(r.WON_AMOUNT) || 0), 0);
    const montoAdjudicado = rows.reduce((s, r) => s + (Number(r.TOTAL_AWARDED_AMOUNT) || 0), 0);
    const workspaces = new Set(rows.map((r) => r.WORKSPACE_ID).filter(Boolean)).size;

    const porGestion = new Map<string, number>();
    for (const r of rows) {
      const k = r.MANAGED_STATUS_NAME || "Sin Definir";
      porGestion.set(k, (porGestion.get(k) || 0) + 1);
    }

    return { total, activas, seguimiento, descartadas, ganadas, montoGanado, montoAdjudicado, workspaces, porGestion };
  }, [rows]);

  // ── Filtrado + paginación ──────────────────────────────────
  const filtradas = useMemo(() => {
    let r = rows;
    if (soloActivas) r = r.filter((x) => isTrue(x.IS_ACTIVE_IN_SOURCE));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((x) =>
        [x.OPPORTUNITY_CODE, x.OPPORTUNITY_NAME, x.ORGANISM, x.WORKSPACE_TITLE, x.MANAGED_STATUS_NAME]
          .some((v) => (v || "").toString().toLowerCase().includes(q))
      );
    }
    return r;
  }, [rows, search, soloActivas]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageRows = filtradas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Member / usuario asignado — agregado por miembro ───────
  const members = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of rows) {
      const key = `${r.MEMBER_ID ?? "?"}-${r.USER_ID ?? "?"}-${r.MEMBER_NAME ?? "?"}`;
      if (!map.has(key)) {
        map.set(key, {
          MEMBER_ID: r.MEMBER_ID,
          MEMBER_NAME: r.MEMBER_NAME,
          MEMBER_TYPE: r.MEMBER_TYPE,
          MEMBER_ACTIVE: r.MEMBER_ACTIVE,
          IS_CONTACT: r.IS_CONTACT,
          USER_ID: r.USER_ID,
          USER_MAIL: r.USER_MAIL,
          oportunidades: 0,
        });
      }
      map.get(key).oportunidades += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.oportunidades - a.oportunidades);
  }, [rows]);

  const memberKpis = useMemo(() => {
    const total = members.length;
    const activos = members.filter((m) => isTrue(m.MEMBER_ACTIVE)).length;
    const contactos = members.filter((m) => isTrue(m.IS_CONTACT)).length;
    const conUsuario = members.filter((m) => m.USER_ID).length;
    const conEmail = members.filter((m) => m.USER_MAIL).length;
    return { total, activos, contactos, internos: total - contactos, conUsuario, conEmail };
  }, [members]);

  const membersFiltrados = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.trim().toLowerCase();
    return members.filter((m) =>
      [m.MEMBER_NAME, m.MEMBER_TYPE, m.USER_MAIL, m.USER_ID, m.MEMBER_ID]
        .some((v) => (v ?? "").toString().toLowerCase().includes(q))
    );
  }, [members, memberSearch]);

  const memberTotalPages = Math.max(1, Math.ceil(membersFiltrados.length / PAGE_SIZE));
  const memberPageRows = membersFiltrados.slice((memberPage - 1) * PAGE_SIZE, memberPage * PAGE_SIZE);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#111827] via-[#1E293B] to-[#111827] p-6 md:p-8 shadow-xl shadow-slate-900/20">
        <div className="absolute -top-20 -right-10 w-72 h-72 bg-[#3B82F6]/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#EFF6FF] text-[#2563EB] px-2.5 py-1 rounded-full">
              <Database className="w-3 h-3" /> Vista de prueba — datos en vivo
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white mt-3 leading-tight">
              BI Export <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3B82F6] to-[#60A5FA]">/bi/opportunities</span>
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Fuente: <code className="text-slate-300">LICITALAB.GOLD.VW_CLIENT_OPPORTUNITIES</code> · biapi.licitalab.cl
            </p>
            {fetchedAt && (
              <p className="text-slate-500 text-[11px] mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Última consulta: {new Date(fetchedAt).toLocaleString("es-CL")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://biapi.licitalab.cl/bi/opportunities"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition-colors"
            >
              Endpoint <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={cargar}
              disabled={loading}
              className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-[#2563EB] to-[#3B82F6] px-3 py-2 rounded-xl shadow-lg shadow-blue-900/40 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* ── Error / Troubleshooting ──────────────────────────── */}
      {error && (
        <div className="bg-rose-50 border-l-4 border-[#EF4444] rounded-2xl px-5 py-4 shadow-sm">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-rose-800">No se pudo obtener la data{error.status ? ` (HTTP ${error.status})` : ""}</p>
              <p className="text-xs text-rose-700 mt-0.5">{error.message}</p>
              <div className="mt-3 grid sm:grid-cols-2 gap-2 text-[11px] text-rose-700">
                <p><strong>401 Missing x-api-key:</strong> el header no llega — revisa <code>x-api-key</code> en .env.local.</p>
                <p><strong>401 Invalid/inactive key:</strong> la key fue rotada o es inválida — pide una nueva.</p>
                <p><strong>Tabla vacía:</strong> tus workspaces aún no tienen oportunidades sugeridas.</p>
                <p><strong>Contacto:</strong> soporte@licitalab.cl</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs ─────────────────────────────────────────────── */}
      {!error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard icon={Database} color="sky" label="Total oportunidades" value={loading ? "—" : kpis.total} />
          <KpiCard icon={CheckCircle2} color="emerald" label="Activas en origen" value={loading ? "—" : kpis.activas} sub={!loading ? `${kpis.total - kpis.activas} históricas` : undefined} />
          <KpiCard icon={Eye} color="violet" label="En seguimiento" value={loading ? "—" : kpis.seguimiento} />
          <KpiCard icon={Star} color="amber" label="Ganadas" value={loading ? "—" : kpis.ganadas} />
          <KpiCard icon={Trash2} color="rose" label="Descartadas" value={loading ? "—" : kpis.descartadas} />
          <KpiCard icon={Building2} color="slate" label="Workspaces" value={loading ? "—" : kpis.workspaces} />
        </div>
      )}

      {!error && !loading && (kpis.montoGanado > 0 || kpis.montoAdjudicado > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
            <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><Wallet size={18} /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monto ganado (WON_AMOUNT)</p>
              <p className="text-xl font-black text-slate-800 tabular-nums">${kpis.montoGanado.toLocaleString("es-CL")}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
            <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0"><Gavel size={18} /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total adjudicado (suma proveedores)</p>
              <p className="text-xl font-black text-slate-800 tabular-nums">${kpis.montoAdjudicado.toLocaleString("es-CL")}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Estado de gestión (breakdown) ──────────────────────── */}
      {!error && !loading && kpis.porGestion.size > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="font-bold text-[#111827] text-sm mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#2563EB]" /> Distribución por MANAGED_STATUS_NAME
          </h2>
          <div className="flex flex-wrap gap-2">
            {Array.from(kpis.porGestion.entries()).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
              <span key={name} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-slate-50 border border-slate-100 text-slate-600 rounded-full px-3 py-1.5">
                {name} <span className="text-[#2563EB]">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Qué se puede / no se puede ─────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm">
          <h2 className="font-bold text-emerald-700 text-sm mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Qué se puede hacer con esta API
          </h2>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Obtener <strong>todas las oportunidades</strong> (activas e históricas) de los workspaces autorizados para esta key.</li>
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Filtrar entre vigentes vs. históricas usando <code className="bg-slate-100 px-1 rounded">IS_ACTIVE_IN_SOURCE</code>.</li>
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Cruzar con datos de mercado por <code className="bg-slate-100 px-1 rounded">OPPORTUNITY_CODE</code>.</li>
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Ver gestión interna del workspace: seguimiento, lectura, descarte, estado (Postulado/Ganada/Perdida/etc.), montos postulados y adjudicados, tags, comentarios.</li>
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Ver datos de contrato/adjudicación: duración, fecha de adjudicación, fin estimado, proveedores adjudicados.</li>
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Conectar directo a Power BI (Web + header <code className="bg-slate-100 px-1 rounded">x-api-key</code>) y programar refresh.</li>
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> Auditar lifecycle: primera/última vez vista en origen, fecha de eliminación.</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-sm">
          <h2 className="font-bold text-rose-700 text-sm mb-3 flex items-center gap-2">
            <XCircle className="w-4 h-4" /> Qué NO se puede hacer (limitaciones)
          </h2>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" /> No es un endpoint de escritura: <strong>solo lectura</strong> (GET), no permite modificar oportunidades ni gestión desde aquí.</li>
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" /> Los datos de oportunidad/gestión se refrescan <strong>cada hora</strong>; no hay tiempo real.</li>
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" /> Las columnas de <strong>contrato y adjudicación</strong> se actualizan con menor frecuencia — pueden ir desfasadas respecto al resto.</li>
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" /> Solo retorna oportunidades de los <strong>workspaces autorizados</strong> para la key — no es un listado global del mercado.</li>
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" /> No hay parámetros documentados de filtrado/paginación en el origen — toda la tabla llega completa y el filtrado se hace en cliente (Power BI / esta vista).</li>
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" /> La <code className="bg-slate-100 px-1 rounded">x-api-key</code> da acceso completo a los datos del workspace — <strong>no debe quedar expuesta al cliente</strong> (por eso esta vista consulta vía proxy server-side).</li>
            <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" /> Si la key se filtra hay que rotarla con soporte — la anterior deja de funcionar de inmediato (corte total, sin transición).</li>
          </ul>
        </div>
      </div>

      {/* Aviso entorno de prueba */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-xs text-amber-800">
        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
        <p>
          Vista de prueba: la <code className="bg-amber-100 px-1 rounded">x-api-key</code> vive solo en <code className="bg-amber-100 px-1 rounded">.env.local</code> del servidor
          y se consume mediante <code className="bg-amber-100 px-1 rounded">/api/bi-export</code>. Cuando se confirme el flujo, esta key debe rotarse a una de producción.
        </p>
      </div>

      {/* ── Tabla ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-[#111827] text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#2563EB]" /> Oportunidades ({filtradas.length})
          </h2>
          <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, nombre, organismo, workspace…"
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
            />
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer select-none">
            <input type="checkbox" checked={soloActivas} onChange={(e) => setSoloActivas(e.target.checked)} className="rounded accent-[#2563EB]" />
            Solo activas
          </label>
        </div>

        {loading ? (
          <div className="px-5 py-4"><TableSkeleton rows={6} /></div>
        ) : error ? null : filtradas.length === 0 ? (
          <EmptyState icon={Database} title="Sin oportunidades" description="Tus workspaces aún no tienen oportunidades sugeridas, o el filtro no encontró resultados." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-50">
                    <th className="px-5 py-3 whitespace-nowrap">Código</th>
                    <th className="px-5 py-3">Nombre</th>
                    <th className="px-5 py-3 whitespace-nowrap">Organismo</th>
                    <th className="px-5 py-3 whitespace-nowrap">Workspace</th>
                    <th className="px-5 py-3 whitespace-nowrap">Estado origen</th>
                    <th className="px-5 py-3 whitespace-nowrap">Gestión</th>
                    <th className="px-5 py-3 whitespace-nowrap text-right">Monto disponible</th>
                    <th className="px-5 py-3 whitespace-nowrap">Cierre</th>
                    <th className="px-5 py-3 whitespace-nowrap text-center">Activa</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pageRows.map((r, i) => (
                    <tr key={r.OPPORTUNITY_ID ?? i} className="hover:bg-slate-50/80 transition-colors cursor-pointer" onClick={() => setSelected(r)}>
                      <td className="px-5 py-3 font-mono font-bold text-slate-700 whitespace-nowrap">{r.OPPORTUNITY_CODE || "—"}</td>
                      <td className="px-5 py-3 text-slate-700 max-w-[280px] truncate">{r.OPPORTUNITY_NAME || "—"}</td>
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap max-w-[180px] truncate">{r.ORGANISM || "—"}</td>
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap max-w-[140px] truncate">{r.WORKSPACE_TITLE || "—"}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{r.STATUS || "—"}</span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="text-[10px] font-bold uppercase bg-blue-50 text-[#2563EB] rounded-full px-2 py-0.5">{r.MANAGED_STATUS_NAME || "Sin Definir"}</span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                        {r.AVAILABLE_AMOUNT ? `${Number(r.AVAILABLE_AMOUNT).toLocaleString("es-CL")} ${r.CURRENCY || ""}` : "—"}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-500">{fmtValue("CLOSING_DATE", r.CLOSING_DATE)}</td>
                      <td className="px-5 py-3 text-center">
                        {isTrue(r.IS_ACTIVE_IN_SOURCE)
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                          : <XCircle className="w-4 h-4 text-slate-300 inline" />}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pb-5">
              <Paginacion currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* ── Member / usuario asignado ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-[#111827] text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-[#2563EB]" /> Member / Usuario asignado
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Miembros del workspace que aparecen como responsables de alguna oportunidad, con su vínculo a un usuario LiciTaLab.
          </p>
        </div>

        {!error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 px-5 pt-5">
            <KpiCard icon={Users} color="sky" label="Total miembros" value={loading ? "—" : memberKpis.total} />
            <KpiCard icon={UserCheck} color="emerald" label="Miembros activos" value={loading ? "—" : memberKpis.activos} />
            <KpiCard icon={Contact} color="violet" label="Contactos externos" value={loading ? "—" : memberKpis.contactos} />
            <KpiCard icon={UserX} color="slate" label="Miembros internos" value={loading ? "—" : memberKpis.internos} />
            <KpiCard icon={Mail} color="amber" label="Con email vinculado" value={loading ? "—" : memberKpis.conEmail} sub={!loading ? `${memberKpis.conUsuario} con usuario LiciTaLab` : undefined} />
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
          <h3 className="font-bold text-[#111827] text-xs flex items-center gap-2">
            Miembros ({membersFiltrados.length})
          </h3>
          <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Buscar por nombre, tipo, email, ID…"
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-5 pb-5"><TableSkeleton rows={6} /></div>
        ) : error ? null : membersFiltrados.length === 0 ? (
          <EmptyState icon={Users} title="Sin miembros" description="No hay miembros asignados a oportunidades, o el filtro no encontró resultados." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-50">
                    <th className="px-5 py-3">Nombre</th>
                    <th className="px-5 py-3 whitespace-nowrap">Tipo</th>
                    <th className="px-5 py-3 whitespace-nowrap text-center">Activo</th>
                    <th className="px-5 py-3 whitespace-nowrap text-center">Es contacto</th>
                    <th className="px-5 py-3 whitespace-nowrap">User ID</th>
                    <th className="px-5 py-3 whitespace-nowrap">Email</th>
                    <th className="px-5 py-3 whitespace-nowrap text-right">Oportunidades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {memberPageRows.map((m, i) => (
                    <tr key={`${m.MEMBER_ID ?? "?"}-${m.USER_ID ?? "?"}-${i}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3 font-bold text-slate-700 whitespace-nowrap max-w-[220px] truncate">{m.MEMBER_NAME || "—"}</td>
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{m.MEMBER_TYPE || "—"}</td>
                      <td className="px-5 py-3 text-center">
                        {isTrue(m.MEMBER_ACTIVE)
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                          : <XCircle className="w-4 h-4 text-slate-300 inline" />}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {isTrue(m.IS_CONTACT)
                          ? <Contact className="w-4 h-4 text-violet-500 inline" />
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-500 font-mono whitespace-nowrap">{m.USER_ID || "—"}</td>
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                        {m.USER_MAIL
                          ? <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-300" />{m.USER_MAIL}</span>
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-bold text-[#2563EB]">{m.oportunidades}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pb-5">
              <Paginacion currentPage={memberPage} totalPages={memberTotalPages} onPageChange={setMemberPage} />
            </div>
          </>
        )}
      </div>

      {/* ── Diccionario de columnas (referencia completa) ──────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-[#111827] text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-[#2563EB]" /> Diccionario completo de columnas ({ALL_COLS.length})
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Tal como llegan desde <code>VW_CLIENT_OPPORTUNITIES</code>. Haz clic en una fila de la tabla para ver el detalle completo de ese registro.</p>
        </div>
        <div className="p-5 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {COLUMN_GROUPS.map((g) => (
            <div key={g.title} className="rounded-2xl border border-slate-100 p-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
                <g.icon className="w-3.5 h-3.5 text-[#2563EB]" /> {g.title}
              </h3>
              <ul className="space-y-1.5">
                {g.cols.map((c) => (
                  <li key={c.key} title={c.desc} className="text-[11px] text-slate-600">
                    <span className="font-mono font-bold text-slate-700">{c.key}</span>
                    <span className="text-slate-400"> — {c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal detalle ───────────────────────────────────────── */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.OPPORTUNITY_NAME || "Oportunidad"}
        subtitle={selected?.OPPORTUNITY_CODE}
        size="xl"
      >
        {selected && (
          <div className="grid md:grid-cols-2 gap-4">
            {COLUMN_GROUPS.map((g) => (
              <div key={g.title} className="rounded-2xl border border-slate-100 p-4">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
                  <g.icon className="w-3.5 h-3.5 text-[#2563EB]" /> {g.title}
                </h3>
                <dl className="space-y-1.5">
                  {g.cols.map((c) => (
                    <div key={c.key} className="flex items-start justify-between gap-3 text-[11px]">
                      <dt className="text-slate-400 font-semibold shrink-0">{c.label}</dt>
                      <dd className="text-slate-700 text-right break-words">{fmtValue(c.key, selected[c.key])}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, color, label, value, sub }: { icon: any; color: string; label: string; value: string | number; sub?: string }) {
  const colors: Record<string, string> = {
    sky: "bg-sky-100 text-sky-600",
    emerald: "bg-emerald-100 text-emerald-600",
    violet: "bg-violet-100 text-violet-600",
    amber: "bg-amber-100 text-amber-600",
    rose: "bg-rose-100 text-rose-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${colors[color]}`}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-black text-[#111827] tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{label}</p>
      {sub && <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
