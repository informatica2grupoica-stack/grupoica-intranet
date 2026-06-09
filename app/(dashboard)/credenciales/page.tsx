"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, User, Download, Printer, RotateCcw, Check, BadgeCheck, FileImage } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/* ── Types ───────────────────────────────────────────────────────────────── */
interface CredData {
  nombre: string; rut: string; cargo: string;
  empresa: string; mandante: string; vigencia: string;
  direccion: string; emailContacto: string; telefono: string; clausulas: string;
}
type Diseño = 1 | 2 | 3;
type Lado   = "frente" | "reverso";

const DEF: CredData = {
  nombre: "NOMBRE APELLIDO", rut: "12.345.678-9", cargo: "Cargo / Puesto",
  empresa: "Recurso Humanos ICA SPA", mandante: "Comercial MP SPA", vigencia: "31/12/2026",
  direccion: "Av. Los Jesuitas #14", emailContacto: "contacto@grupoica.cl", telefono: "+569 754 91 040",
  clausulas:
    "Esta credencial es personal e intransferible. Identifica al portador como colaborador " +
    "autorizado de Recurso Humanos ICA, prestando servicios para Comercial MP SPA. " +
    "En caso de pérdida notificar de inmediato. El uso indebido será sancionado conforme " +
    "al reglamento interno vigente de la empresa contratista.",
};

const W = 336, H = 534;
/* Foto ocupa el 53 % superior de la tarjeta */
const PH = 283;

/* ── QR ─────────────────────────────────────────────────────────────────── */
function QRImg({ text, size }: { text: string; size: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let ok = true;
    import("qrcode").then(({ default: QR }) =>
      QR.toDataURL(text, { width: size * 3, margin: 1, color: { dark: "#0F172A", light: "#FFFFFF" } })
        .then(u => ok && setSrc(u))
    );
    return () => { ok = false; };
  }, [text, size]);
  if (!src) return <div style={{ width: size, height: size, background: "#E2E8F0" }} />;
  return <img src={src} width={size} height={size} alt="QR" style={{ display: "block" }} />;
}

/* ── Photo block (reutilizable) ─────────────────────────────────────────── */
function PhotoBlock({ foto, height, placeholderSize = 80 }: { foto: string | null; height: number; placeholderSize?: number }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height,
      background: "#D1D5DB", overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {foto
        ? <img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} alt="" />
        : <User size={placeholderSize} color="#9CA3AF" />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DISEÑO 1 — AZUL NAVY · DORADO
   Foto full-bleed arriba · Sección info navy · Acentos dorados
══════════════════════════════════════════════════════════════════════════ */
function D1Frente({ d, foto }: { d: CredData; foto: string | null }) {
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", fontFamily: "Arial,sans-serif" }}>
      <PhotoBlock foto={foto} height={PH} />

      {/* Barra dorada separadora */}
      <div style={{ position: "absolute", top: PH, left: 0, right: 0, height: 6, background: "#F59E0B" }} />

      {/* Sección info — navy */}
      <div style={{ position: "absolute", top: PH + 6, left: 0, right: 0, bottom: 0, background: "#1E3A6E" }} />

      {/* Franja dorada izquierda */}
      <div style={{ position: "absolute", top: PH + 6, left: 0, bottom: 0, width: 5, background: "#F59E0B" }} />

      {/* Nombre */}
      <p style={{ position: "absolute", top: PH + 22, left: 18, right: 14, margin: 0, textAlign: "center", fontSize: 17, fontWeight: 900, color: "#FFFFFF", lineHeight: 1.22, textTransform: "uppercase" }}>{d.nombre}</p>

      {/* RUT */}
      <p style={{ position: "absolute", top: PH + 74, left: 18, right: 14, margin: 0, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#F59E0B", letterSpacing: "0.06em" }}>{d.rut}</p>

      {/* Cargo */}
      <p style={{ position: "absolute", top: PH + 94, left: 18, right: 14, margin: 0, textAlign: "center", fontSize: 10.5, color: "#93C5FD", lineHeight: 1.4 }}>{d.cargo}</p>

      {/* Línea separadora */}
      <div style={{ position: "absolute", top: PH + 136, left: 18, right: 14, height: 1, background: "rgba(245,158,11,0.35)" }} />

      {/* Empresa */}
      <div style={{ position: "absolute", top: PH + 148, left: 18, right: 14 }}>
        <p style={{ margin: 0, fontSize: 8.5, fontWeight: 700, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.1em" }}>Empresa</p>
        <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 600, color: "#FFFFFF" }}>{d.empresa}</p>
      </div>

      {/* Mandante */}
      <div style={{ position: "absolute", top: PH + 184, left: 18, right: 14 }}>
        <p style={{ margin: 0, fontSize: 8.5, fontWeight: 700, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.1em" }}>Mandante</p>
        <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 600, color: "#FFFFFF" }}>{d.mandante}</p>
      </div>

      {/* Vigencia */}
      <p style={{ position: "absolute", bottom: 14, right: 14, margin: 0, fontSize: 9, color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>Vigencia: {d.vigencia}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DISEÑO 2 — AMARILLO · BLANCO
   Foto full-bleed · Barra amarilla · Sección info blanca · Nombre coral
══════════════════════════════════════════════════════════════════════════ */
function D2Frente({ d, foto }: { d: CredData; foto: string | null }) {
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", fontFamily: "Arial,sans-serif" }}>
      <PhotoBlock foto={foto} height={PH} />

      {/* Barra amarilla separadora */}
      <div style={{ position: "absolute", top: PH, left: 0, right: 0, height: 6, background: "#EAB308" }} />

      {/* Sección info — blanco */}
      <div style={{ position: "absolute", top: PH + 6, left: 0, right: 0, bottom: 0, background: "#FFFFFF" }} />

      {/* Franja roja izquierda en info */}
      <div style={{ position: "absolute", top: PH + 6, left: 0, bottom: 0, width: 5, background: "#DC2626" }} />

      {/* Nombre — coral */}
      <p style={{ position: "absolute", top: PH + 22, left: 18, right: 14, margin: 0, textAlign: "center", fontSize: 17, fontWeight: 900, color: "#F05A28", lineHeight: 1.22, textTransform: "uppercase" }}>{d.nombre}</p>

      {/* RUT */}
      <p style={{ position: "absolute", top: PH + 72, left: 18, right: 14, margin: 0, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#1B2A6B", letterSpacing: "0.06em" }}>{d.rut}</p>

      {/* Cargo */}
      <p style={{ position: "absolute", top: PH + 92, left: 18, right: 14, margin: 0, textAlign: "center", fontSize: 10.5, color: "#475569", lineHeight: 1.4 }}>{d.cargo}</p>

      {/* Línea separadora */}
      <div style={{ position: "absolute", top: PH + 134, left: 18, right: 14, height: 1, background: "#E2E8F0" }} />

      {/* Empresa */}
      <div style={{ position: "absolute", top: PH + 146, left: 18, right: 14 }}>
        <p style={{ margin: 0, fontSize: 8.5, fontWeight: 700, color: "#EAB308", textTransform: "uppercase", letterSpacing: "0.1em" }}>Empresa</p>
        <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 700, color: "#1B2A6B" }}>{d.empresa}</p>
      </div>

      {/* Mandante */}
      <div style={{ position: "absolute", top: PH + 182, left: 18, right: 14 }}>
        <p style={{ margin: 0, fontSize: 8.5, fontWeight: 700, color: "#EAB308", textTransform: "uppercase", letterSpacing: "0.1em" }}>Mandante</p>
        <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 700, color: "#1B2A6B" }}>{d.mandante}</p>
      </div>

      {/* Vigencia */}
      <p style={{ position: "absolute", bottom: 14, right: 14, margin: 0, fontSize: 9, color: "#94A3B8", fontStyle: "italic" }}>Vigencia: {d.vigencia}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DISEÑO 3 — BLANCO · NARANJA · FOTO CIRCULAR GRANDE
   Ondas naranja/amarillo arriba y abajo · Foto circular prominente
══════════════════════════════════════════════════════════════════════════ */
function D3Frente({ d, foto }: { d: CredData; foto: string | null }) {
  const WAVE_TOP = 114;  // altura zona ondas arriba
  const PHOTO_D  = 172;  // diámetro foto circular
  const PHOTO_CY = WAVE_TOP + 14; // top de la foto
  return (
    <div style={{
      position: "relative", width: W, height: H, overflow: "hidden", fontFamily: "Arial,sans-serif",
      background: "#FAFAFA",
      backgroundImage: "repeating-linear-gradient(45deg,#E5E7EB 0,#E5E7EB 1px,transparent 0,transparent 50%)",
      backgroundSize: "16px 16px",
    }}>

      {/* Ondas superiores */}
      <svg style={{ position: "absolute", top: 0, left: 0 }} width={W} height={WAVE_TOP} viewBox={`0 0 ${W} ${WAVE_TOP}`} preserveAspectRatio="none">
        <path d={`M-4,0 L${W+4},0 L${W+4},74 C${W*0.65},96 ${W*0.3},64 -4,80 Z`} fill="#EAB308" />
        <path d={`M-4,80 C${W*0.3},64 ${W*0.65},96 ${W+4},74 L${W+4},98 C${W*0.65},114 ${W*0.3},88 -4,104 Z`} fill="#F97316" />
        <path d={`M-4,104 C${W*0.3},88 ${W*0.65},114 ${W+4},98 L${W+4},${WAVE_TOP} C${W*0.65},${WAVE_TOP-6} ${W*0.3},${WAVE_TOP+4} -4,${WAVE_TOP-2} Z`} fill="#E05A28" />
      </svg>

      {/* Foto circular grande */}
      <div style={{
        position: "absolute", top: PHOTO_CY, left: "50%", transform: "translateX(-50%)",
        width: PHOTO_D, height: PHOTO_D, borderRadius: "50%",
        border: "9px solid #1E3A6E", background: "#D1D5DB",
        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {foto
          ? <img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
          : <User size={70} color="#9CA3AF" />}
      </div>

      {/* Nombre */}
      <p style={{ position: "absolute", top: PHOTO_CY + PHOTO_D + 12, left: 14, right: 14, margin: 0, textAlign: "center", fontSize: 18, fontWeight: 900, color: "#1E3A6E", lineHeight: 1.2, textTransform: "uppercase" }}>{d.nombre}</p>

      {/* RUT */}
      <p style={{ position: "absolute", top: PHOTO_CY + PHOTO_D + 58, left: 14, right: 14, margin: 0, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#1E3A6E" }}>{d.rut}</p>

      {/* Cargo */}
      <p style={{ position: "absolute", top: PHOTO_CY + PHOTO_D + 78, left: 16, right: 16, margin: 0, textAlign: "center", fontSize: 10.5, color: "#475569", lineHeight: 1.4 }}>{d.cargo}</p>

      {/* Línea separadora */}
      <div style={{ position: "absolute", top: PHOTO_CY + PHOTO_D + 118, left: 22, right: 22, height: 1.5, background: "#E2E8F0" }} />

      {/* Empresa */}
      <div style={{ position: "absolute", top: PHOTO_CY + PHOTO_D + 130, left: 22, right: 22, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 8.5, fontWeight: 700, color: "#F97316", textTransform: "uppercase", letterSpacing: "0.1em" }}>Empresa</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 700, color: "#1E3A6E" }}>{d.empresa}</p>
      </div>

      {/* Mandante */}
      <div style={{ position: "absolute", top: PHOTO_CY + PHOTO_D + 166, left: 22, right: 22, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 8.5, fontWeight: 700, color: "#F97316", textTransform: "uppercase", letterSpacing: "0.1em" }}>Mandante</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 700, color: "#1E3A6E" }}>{d.mandante}</p>
      </div>

      {/* Ondas inferiores */}
      <svg style={{ position: "absolute", bottom: 0, left: 0 }} width={W} height={94} viewBox={`0 0 ${W} 94`} preserveAspectRatio="none">
        <path d={`M-4,0 C${W*0.35},18 ${W*0.65},-4 ${W+4},10 L${W+4},94 L-4,94 Z`} fill="#E05A28" />
        <path d={`M-4,22 C${W*0.35},40 ${W*0.65},18 ${W+4},30 L${W+4},10 C${W*0.65},-4 ${W*0.35},18 -4,0 Z`} fill="#F97316" />
        <path d={`M-4,44 C${W*0.35},60 ${W*0.65},38 ${W+4},50 L${W+4},30 C${W*0.65},18 ${W*0.35},40 -4,22 Z`} fill="#EAB308" />
      </svg>

      {/* Vigencia */}
      <p style={{ position: "absolute", bottom: 104, left: 14, right: 14, margin: 0, textAlign: "center", fontSize: 9, color: "#64748B", fontStyle: "italic" }}>Vigencia: {d.vigencia}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   REVERSO — Layout compartido, tema por diseño
   ─ QR siempre debajo del contacto, sin líneas encima
══════════════════════════════════════════════════════════════════════════ */
interface BackTheme { headerBg: string; titleColor: string; subColor: string; accent: string; bodyBg: string; textColor: string; mutedColor: string; }

const BACK_THEMES: Record<Diseño, BackTheme> = {
  1: { headerBg: "#1E3A6E", titleColor: "#FFFFFF", subColor: "rgba(255,255,255,0.75)", accent: "#F59E0B",  bodyBg: "#FFFFFF", textColor: "#1E293B", mutedColor: "#64748B" },
  2: { headerBg: "#1B2A6B", titleColor: "#FFFFFF", subColor: "rgba(255,255,255,0.75)", accent: "#EAB308",  bodyBg: "#FFFFFF", textColor: "#1E293B", mutedColor: "#64748B" },
  3: { headerBg: "#0F172A", titleColor: "#FFFFFF", subColor: "rgba(255,255,255,0.7)",  accent: "#F97316",  bodyBg: "#FFFFFF", textColor: "#1E293B", mutedColor: "#64748B" },
};

/* Layout back (posiciones fijas, sin solapamiento):
   0–82   → header coloreado
   88–290 → cláusulas
   296    → divider
   304–338 → contacto (3 líneas × 12px h × 11px gap)
   346    → divider
   356–492 → QR box (6px pad + 124px QR + 6px pad = 136px)
   500–520 → FIRMA RESPONSABLE   ← siempre DEBAJO del QR
*/
function CardReverso({ d, qrText, diseño }: { d: CredData; qrText: string; diseño: Diseño }) {
  const t = BACK_THEMES[diseño];
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", background: t.bodyBg, fontFamily: "Arial,sans-serif" }}>

      {/* Header coloreado */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 82, background: t.headerBg }} />

      {/* Diagonal sutil al borde inferior del header */}
      <svg style={{ position: "absolute", top: 76, left: 0 }} width={W} height={10} viewBox={`0 0 ${W} 10`} preserveAspectRatio="none">
        <polygon points={`0,0 ${W},10 ${W},0`} fill={t.headerBg} />
      </svg>

      {/* RRHH ICA */}
      <p style={{ position: "absolute", top: 15, left: 24, margin: 0, fontSize: 22, fontWeight: 900, color: t.titleColor }}>RRHH ICA</p>
      <p style={{ position: "absolute", top: 45, left: 24, margin: 0, fontSize: 11, fontWeight: 700, color: t.subColor, letterSpacing: "0.04em" }}>TÉRMINOS Y CONDICIONES</p>
      <div style={{ position: "absolute", top: 64, left: 24, width: 46, height: 3, background: t.accent, borderRadius: 2 }} />

      {/* Cláusulas */}
      <p style={{ position: "absolute", top: 90, left: 24, right: 24, margin: 0, fontSize: 9.5, lineHeight: 1.72, color: t.textColor, opacity: 0.82 }}>{d.clausulas}</p>

      {/* Divider 1 */}
      <div style={{ position: "absolute", top: 296, left: 24, right: 24, height: 1, background: t.textColor, opacity: 0.1 }} />

      {/* Contacto — 3 líneas sin solapamiento */}
      {([["📍", d.direccion], ["✉", d.emailContacto], ["📞", d.telefono]] as [string, string][]).map(([ico, val], i) => (
        <div key={i} style={{ position: "absolute", top: 305 + i * 14, left: 24, right: 24, display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 11, lineHeight: 1 }}>{ico}</span>
          <p style={{ margin: 0, fontSize: 9.5, color: t.textColor, fontWeight: 600, opacity: 0.85 }}>{val}</p>
        </div>
      ))}
      {/* Último contacto: 305 + 2×14 = 333, altura ~12 → termina en 345 */}

      {/* Divider 2 */}
      <div style={{ position: "absolute", top: 352, left: 24, right: 24, height: 1, background: t.textColor, opacity: 0.08 }} />

      {/* QR — top=360, size=124, padding=6 → box bottom = 360+136 = 496 */}
      <div style={{ position: "absolute", top: 360, left: "50%", transform: "translateX(-50%)", padding: 6, background: "#FFFFFF", boxShadow: "0 2px 12px rgba(0,0,0,0.10)", borderRadius: 2 }}>
        <QRImg text={qrText} size={124} />
      </div>

      {/* FIRMA RESPONSABLE — top ≥ 500, siempre debajo del QR (496) */}
      <p style={{ position: "absolute", top: 502, left: 24, right: 24, margin: 0, textAlign: "center", fontSize: 9, fontWeight: 700, color: t.mutedColor, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        Firma Responsable
      </p>

      {/* Acento inferior decorativo (solo diseño 3) */}
      {diseño === 3 && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 8, background: "#F97316" }} />
      )}
    </div>
  );
}

/* ── Router ─────────────────────────────────────────────────────────────── */
function CardRender({ diseño, lado, d, foto, qrText }: { diseño: Diseño; lado: Lado; d: CredData; foto: string | null; qrText: string }) {
  if (lado === "reverso") return <CardReverso d={d} qrText={qrText} diseño={diseño} />;
  if (diseño === 1) return <D1Frente d={d} foto={foto} />;
  if (diseño === 2) return <D2Frente d={d} foto={foto} />;
  return <D3Frente d={d} foto={foto} />;
}

/* ── Field — FUERA del componente principal (evita pérdida de foco) ──────── */
function Field({ label, value, onChange, span2 = true, as = "input", rows = 4 }:
  { label: string; value: string; onChange: (v: string) => void; span2?: boolean; as?: "input" | "textarea"; rows?: number }) {
  const cls = "w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition";
  return (
    <div className={span2 ? "col-span-2" : "col-span-1"}>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {as === "textarea"
        ? <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} className={cls + " resize-none"} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} className={cls} />}
    </div>
  );
}

const DISENOS_INFO = [
  { id: 1 as Diseño, label: "Diseño 1", sub: "Navy · Dorado",   colors: ["#1E3A6E", "#F59E0B", "#FFFFFF"] },
  { id: 2 as Diseño, label: "Diseño 2", sub: "Blanco · Coral",  colors: ["#FFFFFF", "#F05A28", "#EAB308"] },
  { id: 3 as Diseño, label: "Diseño 3", sub: "Blanco · Naranja", colors: ["#FAFAFA", "#F97316", "#EAB308"] },
];

/* ══ MAIN PAGE ══════════════════════════════════════════════════════════════ */
export default function CredencialesPage() {
  const [data, setData]     = useState<CredData>(DEF);
  const [foto, setFoto]     = useState<string | null>(null);
  const [diseño, setDiseño] = useState<Diseño>(1);
  const [lado, setLado]     = useState<Lado>("frente");
  const [busy, setBusy]     = useState(false);

  const frenteRef  = useRef<HTMLDivElement>(null);
  const reversoRef = useRef<HTMLDivElement>(null);
  const fileInput  = useRef<HTMLInputElement>(null);

  const qrText = `RRHH ICA | ${data.nombre} | RUT: ${data.rut} | ${data.empresa} | Vigencia: ${data.vigencia}`;
  const upd = (k: keyof CredData) => (v: string) => setData(p => ({ ...p, [k]: v }));

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => setFoto(ev.target?.result as string);
    r.readAsDataURL(f);
  };

  const capture = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return Promise.reject(new Error("Referencia no disponible"));
    return html2canvas(ref.current, { scale: 4, useCORS: true, allowTaint: true, backgroundColor: "#FFFFFF", logging: false });
  };

  const exportPDF = async () => {
    setBusy(true);
    try {
      const [c1, c2] = await Promise.all([capture(frenteRef), capture(reversoRef)]);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [63.5, 101] });
      pdf.addImage(c1.toDataURL("image/png"), "PNG", 0, 0, 63.5, 101);
      pdf.addPage();
      pdf.addImage(c2.toDataURL("image/png"), "PNG", 0, 0, 63.5, 101);
      pdf.save(`credencial-D${diseño}-${data.nombre.replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      console.error("PDF error:", e);
      alert("Error al generar el PDF. Revisa la consola.");
    } finally { setBusy(false); }
  };

  const exportPNG = async () => {
    setBusy(true);
    try {
      const canvas = await capture(lado === "frente" ? frenteRef : reversoRef);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `credencial-D${diseño}-${lado}-${data.nombre.replace(/\s+/g, "_")}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) {
      console.error("PNG error:", e);
      alert("Error al exportar PNG.");
    } finally { setBusy(false); }
  };

  const imprimir = async () => {
    setBusy(true);
    // Abrir ventana ANTES del await para evitar bloqueo de popup
    const win = window.open("", "_blank");
    if (!win) {
      alert("Permite ventanas emergentes en este sitio para imprimir.");
      setBusy(false);
      return;
    }
    try {
      const canvas = await capture(lado === "frente" ? frenteRef : reversoRef);
      const img = canvas.toDataURL("image/png");
      win.document.write(`<html><head><title>Credencial</title><style>
        @page{size:63.5mm 101mm;margin:0}body{margin:0;padding:0}img{width:63.5mm;height:101mm;display:block}
      </style></head><body><img src="${img}"/></body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 600);
    } catch (e) {
      console.error("Print error:", e);
      win.close();
      alert("Error al generar la impresión.");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6">

      {/* ── FORMULARIO ─────────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Selector diseño */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Seleccionar Diseño</p>
          <div className="grid grid-cols-3 gap-3">
            {DISENOS_INFO.map(info => (
              <button key={info.id} onClick={() => setDiseño(info.id)}
                className={`relative rounded-xl border-2 p-3 text-left transition-all ${diseño === info.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}>
                {diseño === info.id && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check size={10} color="white" strokeWidth={3} />
                  </span>
                )}
                <div className="flex gap-1 mb-2">
                  {info.colors.map(c => <span key={c} style={{ background: c, border: c === "#FFFFFF" || c === "#FAFAFA" ? "1px solid #CBD5E1" : "none" }} className="w-3.5 h-3.5 rounded-full" />)}
                </div>
                <p className="text-[11px] font-bold text-slate-700">{info.label}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{info.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Foto */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Foto del colaborador</p>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-slate-200 transition"
              onClick={() => fileInput.current?.click()}>
              {foto ? <img src={foto} className="w-full h-full object-cover" alt="" /> : <User size={24} className="text-slate-400" />}
            </div>
            <div className="flex-1">
              <button onClick={() => fileInput.current?.click()} className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition">
                <Upload size={14} /> Subir foto
              </button>
              {foto && <button onClick={() => setFoto(null)} className="mt-1 flex items-center gap-1.5 text-xs text-rose-500"><RotateCcw size={11} /> Quitar</button>}
              <p className="text-[10px] text-slate-400 mt-1">JPG · PNG · proporción 1:1 ideal</p>
            </div>
          </div>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
        </div>

        {/* Datos */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Datos del colaborador</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre completo" value={data.nombre}   onChange={upd("nombre")} />
            <Field label="RUT"             value={data.rut}      onChange={upd("rut")}      span2={false} />
            <Field label="Vigencia"        value={data.vigencia} onChange={upd("vigencia")} span2={false} />
            <Field label="Cargo / Puesto"  value={data.cargo}    onChange={upd("cargo")} />
            <Field label="Empresa"         value={data.empresa}  onChange={upd("empresa")} />
            <Field label="Mandante"        value={data.mandante} onChange={upd("mandante")} />
          </div>
        </div>

        {/* Contacto */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Contacto (reverso)</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dirección"  value={data.direccion}     onChange={upd("direccion")} />
            <Field label="Email"      value={data.emailContacto} onChange={upd("emailContacto")} />
            <Field label="Teléfono"   value={data.telefono}      onChange={upd("telefono")} span2={false} />
          </div>
        </div>

        {/* Cláusulas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Términos y condiciones (reverso)</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cláusulas" value={data.clausulas} onChange={upd("clausulas")} as="textarea" rows={5} />
          </div>
        </div>
      </div>

      {/* ── PREVIEW ────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-5">

        {/* Toggle */}
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm gap-1">
          {(["frente", "reverso"] as Lado[]).map(l => (
            <button key={l} onClick={() => setLado(l)}
              className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${lado === l ? "bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white shadow" : "text-slate-500 hover:text-slate-700"}`}>
              {l === "frente" ? "▶  Frente" : "◀  Reverso"}
            </button>
          ))}
        </div>

        {/* Card visible */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 18, boxShadow: "0 28px 70px rgba(0,0,0,0.28)" }} />
          <AnimatePresence mode="wait">
            <motion.div key={`${diseño}-${lado}`} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}
              style={{ borderRadius: 16, overflow: "hidden", width: W, height: H }}>
              <CardRender diseño={diseño} lado={lado} d={data} foto={foto} qrText={qrText} />
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="text-[11px] text-slate-400 font-mono tracking-wide">63.5 × 101 mm · Credencial PVC vertical</p>

        {/* Botones exportación */}
        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={exportPNG} disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-40">
            <FileImage size={15} className="text-emerald-500" /> PNG · lado actual
          </button>
          <button onClick={exportPDF} disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] rounded-xl text-sm font-semibold text-white hover:opacity-90 transition shadow-sm disabled:opacity-40">
            <Download size={15} /> {busy ? "Generando…" : "PDF · ambos lados"}
          </button>
          <button onClick={imprimir} disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-40">
            <Printer size={15} className="text-blue-500" /> Imprimir lado actual
          </button>
        </div>

        <div className="max-w-sm bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700 leading-relaxed">
          <p className="font-bold mb-1 flex items-center gap-1.5"><BadgeCheck size={13} /> PDF exporta frente + reverso en 2 páginas</p>
          <p>QR permanente en el reverso. Para PVC configura impresora en <strong>63.5 × 101 mm</strong>.</p>
        </div>
      </div>

      {/* ── RENDERS OCULTOS para html2canvas ─────────────────────────── */}
      {/* Sin zIndex negativo: html2canvas no captura elementos con z-index < 0 */}
      <div style={{ position: "fixed", left: -9999, top: 0, pointerEvents: "none", opacity: 0 }}>
        <div ref={frenteRef} style={{ width: W, height: H }}>
          <CardRender diseño={diseño} lado="frente" d={data} foto={foto} qrText={qrText} />
        </div>
      </div>
      <div style={{ position: "fixed", left: -9999, top: 0, pointerEvents: "none", opacity: 0 }}>
        <div ref={reversoRef} style={{ width: W, height: H }}>
          <CardRender diseño={diseño} lado="reverso" d={data} foto={foto} qrText={qrText} />
        </div>
      </div>
    </div>
  );
}
