"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, User, Download, Printer, RotateCcw, Check, BadgeCheck, FileImage } from "lucide-react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { toast } from "@/components/Toast";

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

/* Tipografía compartida de las credenciales (usa la Inter de la app al capturar) */
const CARD_FONT = "var(--font-inter), Inter, Arial, sans-serif";

/* ══════════════════════════════════════════════════════════════════════════
   DISEÑO 1 — EJECUTIVO NAVY
   Foto full-bleed que se funde en panel navy · acentos dorados finos
══════════════════════════════════════════════════════════════════════════ */
function D1Frente({ d, foto }: { d: CredData; foto: string | null }) {
  const NAVY = "#13294B";
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", fontFamily: CARD_FONT, background: NAVY }}>
      <PhotoBlock foto={foto} height={PH + 40} />

      {/* La foto se funde en el panel navy (sin corte duro) */}
      <div style={{ position: "absolute", top: PH - 60, left: 0, right: 0, height: 100, background: `linear-gradient(180deg, rgba(19,41,75,0) 0%, ${NAVY} 92%)` }} />
      <div style={{ position: "absolute", top: PH + 40, left: 0, right: 0, bottom: 0, background: NAVY }} />

      {/* Marca discreta arriba */}
      <div style={{ position: "absolute", top: 14, left: 16, display: "flex", alignItems: "center", gap: 7, padding: "5px 10px", background: "rgba(15,23,42,0.55)", borderRadius: 8, backdropFilter: "blur(4px)" }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: "#D9A441" }} />
        <span style={{ fontSize: 9, fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.18em" }}>RRHH ICA</span>
      </div>

      {/* Nombre */}
      <p style={{ position: "absolute", top: PH + 8, left: 20, right: 20, margin: 0, textAlign: "center", fontSize: 19, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.18, textTransform: "uppercase", letterSpacing: "0.01em" }}>{d.nombre}</p>

      {/* RUT en chip dorado */}
      <div style={{ position: "absolute", top: PH + 62, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ display: "inline-block", padding: "4px 14px", fontSize: 11, fontWeight: 700, color: "#E8C275", letterSpacing: "0.08em", border: "1px solid rgba(217,164,65,0.45)", borderRadius: 999 }}>{d.rut}</span>
      </div>

      {/* Cargo */}
      <p style={{ position: "absolute", top: PH + 94, left: 24, right: 24, margin: 0, textAlign: "center", fontSize: 10.5, fontWeight: 500, color: "#8FA6C9", lineHeight: 1.4 }}>{d.cargo}</p>

      {/* Mini divisor dorado centrado */}
      <div style={{ position: "absolute", top: PH + 132, left: "50%", transform: "translateX(-50%)", width: 34, height: 2, borderRadius: 2, background: "#D9A441" }} />

      {/* Empresa / Mandante */}
      <div style={{ position: "absolute", top: PH + 148, left: 24, right: 24 }}>
        <p style={{ margin: 0, fontSize: 8, fontWeight: 700, color: "#D9A441", textTransform: "uppercase", letterSpacing: "0.16em" }}>Empresa</p>
        <p style={{ margin: "3px 0 0", fontSize: 11.5, fontWeight: 600, color: "#FFFFFF", letterSpacing: "0.01em" }}>{d.empresa}</p>
      </div>
      <div style={{ position: "absolute", top: PH + 186, left: 24, right: 24 }}>
        <p style={{ margin: 0, fontSize: 8, fontWeight: 700, color: "#D9A441", textTransform: "uppercase", letterSpacing: "0.16em" }}>Mandante</p>
        <p style={{ margin: "3px 0 0", fontSize: 11.5, fontWeight: 600, color: "#FFFFFF", letterSpacing: "0.01em" }}>{d.mandante}</p>
      </div>

      {/* Footer: línea fina + vigencia */}
      <div style={{ position: "absolute", bottom: 30, left: 24, right: 24, height: 1, background: "rgba(255,255,255,0.12)" }} />
      <p style={{ position: "absolute", bottom: 11, left: 24, margin: 0, fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Credencial corporativa</p>
      <p style={{ position: "absolute", bottom: 11, right: 24, margin: 0, fontSize: 8.5, fontWeight: 700, color: "#E8C275", letterSpacing: "0.06em" }}>VIGENCIA {d.vigencia}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DISEÑO 2 — CORPORATIVO CLARO
   Tarjeta blanca · cabecera navy con marca · foto enmarcada con sombra
══════════════════════════════════════════════════════════════════════════ */
function D2Frente({ d, foto }: { d: CredData; foto: string | null }) {
  const NAVY = "#13294B", BLUE = "#2563EB";
  const PW = 188, PHH = 210; // foto rectangular enmarcada
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", fontFamily: CARD_FONT, background: "#FFFFFF" }}>
      {/* Cabecera navy con marca */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 66, background: NAVY }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 66, background: `linear-gradient(120deg, rgba(37,99,235,0.35) 0%, rgba(37,99,235,0) 55%)` }} />
      <p style={{ position: "absolute", top: 16, left: 0, right: 0, margin: 0, textAlign: "center", fontSize: 13, fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.22em" }}>RRHH ICA</p>
      <p style={{ position: "absolute", top: 36, left: 0, right: 0, margin: 0, textAlign: "center", fontSize: 7.5, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.3em" }}>CREDENCIAL CORPORATIVA</p>

      {/* Foto enmarcada */}
      <div style={{
        position: "absolute", top: 92, left: "50%", transform: "translateX(-50%)",
        width: PW, height: PHH, borderRadius: 14, overflow: "hidden",
        background: "#E2E8F0", boxShadow: "0 14px 30px rgba(19,41,75,0.22)",
        border: "4px solid #FFFFFF", outline: "1px solid #E2E8F0",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {foto
          ? <img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} alt="" />
          : <User size={64} color="#94A3B8" />}
      </div>

      {/* Nombre */}
      <p style={{ position: "absolute", top: 320, left: 20, right: 20, margin: 0, textAlign: "center", fontSize: 18, fontWeight: 800, color: NAVY, lineHeight: 1.2, textTransform: "uppercase" }}>{d.nombre}</p>

      {/* RUT */}
      <p style={{ position: "absolute", top: 366, left: 20, right: 20, margin: 0, textAlign: "center", fontSize: 11.5, fontWeight: 700, color: BLUE, letterSpacing: "0.08em" }}>{d.rut}</p>

      {/* Cargo en chip */}
      <div style={{ position: "absolute", top: 386, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ display: "inline-block", maxWidth: 270, padding: "4px 14px", fontSize: 9.5, fontWeight: 600, color: "#475569", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 999 }}>{d.cargo}</span>
      </div>

      {/* Empresa / Mandante en dos columnas */}
      <div style={{ position: "absolute", top: 430, left: 24, right: 24, display: "flex", gap: 14 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 7.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.14em" }}>Empresa</p>
          <p style={{ margin: "3px 0 0", fontSize: 10, fontWeight: 700, color: NAVY, lineHeight: 1.3 }}>{d.empresa}</p>
        </div>
        <div style={{ width: 1, background: "#E2E8F0" }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 7.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.14em" }}>Mandante</p>
          <p style={{ margin: "3px 0 0", fontSize: 10, fontWeight: 700, color: NAVY, lineHeight: 1.3 }}>{d.mandante}</p>
        </div>
      </div>

      {/* Footer con vigencia + banda azul */}
      <p style={{ position: "absolute", bottom: 18, left: 0, right: 0, margin: 0, textAlign: "center", fontSize: 8.5, fontWeight: 700, color: "#64748B", letterSpacing: "0.08em" }}>VIGENCIA {d.vigencia}</p>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 7, background: `linear-gradient(90deg, ${NAVY}, ${BLUE})` }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DISEÑO 3 — MODERNO OSCURO
   Fondo gradiente nocturno con geometría sutil · foto circular con doble anillo
══════════════════════════════════════════════════════════════════════════ */
function D3Frente({ d, foto }: { d: CredData; foto: string | null }) {
  const PHOTO_D = 168;
  const PHOTO_TOP = 96;
  const AFTER = PHOTO_TOP + PHOTO_D; // 264
  return (
    <div style={{
      position: "relative", width: W, height: H, overflow: "hidden", fontFamily: CARD_FONT,
      background: "linear-gradient(160deg, #0B1220 0%, #13294B 58%, #1D3A6E 100%)",
    }}>
      {/* Geometría decorativa sutil */}
      <svg style={{ position: "absolute", inset: 0 }} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <circle cx={W - 30} cy={50} r={110} fill="none" stroke="rgba(96,165,250,0.10)" strokeWidth="1.5" />
        <circle cx={W - 30} cy={50} r={70} fill="none" stroke="rgba(96,165,250,0.14)" strokeWidth="1.5" />
        <circle cx={16} cy={H - 70} r={90} fill="none" stroke="rgba(96,165,250,0.08)" strokeWidth="1.5" />
        <circle cx={40} cy={86} r={3} fill="rgba(96,165,250,0.35)" />
        <circle cx={W - 56} cy={H - 120} r={2.5} fill="rgba(232,194,117,0.45)" />
      </svg>

      {/* Marca */}
      <p style={{ position: "absolute", top: 22, left: 0, right: 0, margin: 0, textAlign: "center", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.9)", letterSpacing: "0.32em" }}>RRHH ICA</p>
      <div style={{ position: "absolute", top: 42, left: "50%", transform: "translateX(-50%)", width: 26, height: 2, borderRadius: 2, background: "#60A5FA" }} />

      {/* Foto circular con doble anillo */}
      <div style={{ position: "absolute", top: PHOTO_TOP - 7, left: "50%", transform: "translateX(-50%)", width: PHOTO_D + 14, height: PHOTO_D + 14, borderRadius: "50%", background: "linear-gradient(135deg, #60A5FA, rgba(96,165,250,0.12) 60%, #E8C275)" }} />
      <div style={{
        position: "absolute", top: PHOTO_TOP, left: "50%", transform: "translateX(-50%)",
        width: PHOTO_D, height: PHOTO_D, borderRadius: "50%",
        border: "4px solid #0B1220", background: "#1E293B",
        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {foto
          ? <img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
          : <User size={64} color="#475569" />}
      </div>

      {/* Nombre */}
      <p style={{ position: "absolute", top: AFTER + 24, left: 18, right: 18, margin: 0, textAlign: "center", fontSize: 18, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.2, textTransform: "uppercase" }}>{d.nombre}</p>

      {/* RUT */}
      <p style={{ position: "absolute", top: AFTER + 70, left: 18, right: 18, margin: 0, textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "#60A5FA", letterSpacing: "0.1em" }}>{d.rut}</p>

      {/* Cargo en chip translúcido */}
      <div style={{ position: "absolute", top: AFTER + 92, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ display: "inline-block", maxWidth: 270, padding: "4px 14px", fontSize: 9.5, fontWeight: 600, color: "#C7D6EE", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999 }}>{d.cargo}</span>
      </div>

      {/* Empresa / Mandante en tarjeta translúcida */}
      <div style={{ position: "absolute", top: AFTER + 136, left: 22, right: 22, padding: "12px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, display: "flex", gap: 14 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 7.5, fontWeight: 700, color: "#E8C275", textTransform: "uppercase", letterSpacing: "0.14em" }}>Empresa</p>
          <p style={{ margin: "3px 0 0", fontSize: 10, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.3 }}>{d.empresa}</p>
        </div>
        <div style={{ width: 1, background: "rgba(255,255,255,0.12)" }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 7.5, fontWeight: 700, color: "#E8C275", textTransform: "uppercase", letterSpacing: "0.14em" }}>Mandante</p>
          <p style={{ margin: "3px 0 0", fontSize: 10, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.3 }}>{d.mandante}</p>
        </div>
      </div>

      {/* Vigencia */}
      <p style={{ position: "absolute", bottom: 14, left: 0, right: 0, margin: 0, textAlign: "center", fontSize: 8.5, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.12em" }}>VIGENCIA {d.vigencia}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   REVERSO — Layout compartido, tema por diseño
   ─ QR siempre debajo del contacto, sin líneas encima
══════════════════════════════════════════════════════════════════════════ */
interface BackTheme { headerBg: string; titleColor: string; subColor: string; accent: string; bodyBg: string; textColor: string; mutedColor: string; }

const BACK_THEMES: Record<Diseño, BackTheme> = {
  1: { headerBg: "#13294B", titleColor: "#FFFFFF", subColor: "rgba(255,255,255,0.65)", accent: "#D9A441", bodyBg: "#FFFFFF", textColor: "#1E293B", mutedColor: "#64748B" },
  2: { headerBg: "#13294B", titleColor: "#FFFFFF", subColor: "rgba(255,255,255,0.65)", accent: "#2563EB", bodyBg: "#FFFFFF", textColor: "#1E293B", mutedColor: "#64748B" },
  3: { headerBg: "#0B1220", titleColor: "#FFFFFF", subColor: "rgba(255,255,255,0.6)",  accent: "#60A5FA", bodyBg: "#FFFFFF", textColor: "#1E293B", mutedColor: "#64748B" },
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
  const CONTACTO: Array<[string, string]> = [
    ["DIRECCIÓN", d.direccion],
    ["EMAIL", d.emailContacto],
    ["TELÉFONO", d.telefono],
  ];
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", background: t.bodyBg, fontFamily: CARD_FONT }}>

      {/* Header coloreado */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: t.headerBg }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: `linear-gradient(120deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 50%)` }} />

      {/* RRHH ICA */}
      <p style={{ position: "absolute", top: 16, left: 24, margin: 0, fontSize: 19, fontWeight: 800, color: t.titleColor, letterSpacing: "0.04em" }}>RRHH ICA</p>
      <p style={{ position: "absolute", top: 44, left: 24, margin: 0, fontSize: 9, fontWeight: 700, color: t.subColor, letterSpacing: "0.18em" }}>TÉRMINOS Y CONDICIONES</p>
      <div style={{ position: "absolute", top: 62, left: 24, width: 40, height: 2.5, background: t.accent, borderRadius: 2 }} />

      {/* Cláusulas */}
      <p style={{ position: "absolute", top: 94, left: 24, right: 24, margin: 0, fontSize: 9.5, lineHeight: 1.7, color: t.textColor, opacity: 0.8 }}>{d.clausulas}</p>

      {/* Contacto — etiqueta + valor, alineado y sin emojis */}
      <div style={{ position: "absolute", top: 298, left: 24, right: 24, borderTop: "1px solid rgba(15,23,42,0.08)", paddingTop: 9 }}>
        {CONTACTO.map(([label, val], i) => (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: i ? 5 : 0 }}>
            <span style={{ width: 62, fontSize: 7, fontWeight: 700, color: t.accent, letterSpacing: "0.12em" }}>{label}</span>
            <span style={{ flex: 1, fontSize: 9.5, color: t.textColor, fontWeight: 600, opacity: 0.85 }}>{val}</span>
          </div>
        ))}
      </div>

      {/* QR con marco fino */}
      <div style={{ position: "absolute", top: 362, left: "50%", transform: "translateX(-50%)", padding: 7, background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 6px 20px rgba(15,23,42,0.10)", borderRadius: 10 }}>
        <QRImg text={qrText} size={120} />
      </div>

      {/* Firma responsable */}
      <div style={{ position: "absolute", top: 504, left: 90, right: 90, borderTop: `1px solid ${t.mutedColor}`, opacity: 0.55 }} />
      <p style={{ position: "absolute", top: 509, left: 24, right: 24, margin: 0, textAlign: "center", fontSize: 8, fontWeight: 700, color: t.mutedColor, letterSpacing: "0.16em", textTransform: "uppercase" }}>
        Firma Responsable
      </p>

      {/* Acento inferior */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, background: t.accent }} />
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
  { id: 1 as Diseño, label: "Ejecutivo",    sub: "Navy · Dorado",      colors: ["#13294B", "#D9A441", "#FFFFFF"] },
  { id: 2 as Diseño, label: "Corporativo",  sub: "Blanco · Navy",      colors: ["#FFFFFF", "#13294B", "#2563EB"] },
  { id: 3 as Diseño, label: "Moderno",      sub: "Nocturno · Acentos", colors: ["#0B1220", "#60A5FA", "#E8C275"] },
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

  const capture = (ref: React.RefObject<HTMLDivElement | null>): Promise<string> => {
    if (!ref.current) return Promise.reject(new Error("Referencia no disponible"));
    return toPng(ref.current, { pixelRatio: 4, backgroundColor: "#FFFFFF", cacheBust: true });
  };

  const exportPDF = async () => {
    setBusy(true);
    try {
      const [d1, d2] = await Promise.all([capture(frenteRef), capture(reversoRef)]);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [63.5, 101] });
      pdf.addImage(d1, "PNG", 0, 0, 63.5, 101);
      pdf.addPage();
      pdf.addImage(d2, "PNG", 0, 0, 63.5, 101);
      pdf.save(`credencial-D${diseño}-${data.nombre.replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      console.error("PDF error:", e);
      toast("Error al generar el PDF. Revisa la consola.", "error");
    } finally { setBusy(false); }
  };

  const exportPNG = async () => {
    setBusy(true);
    try {
      const dataUrl = await capture(lado === "frente" ? frenteRef : reversoRef);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `credencial-D${diseño}-${lado}-${data.nombre.replace(/\s+/g, "_")}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) {
      console.error("PNG error:", e);
      toast("Error al exportar PNG.", "error");
    } finally { setBusy(false); }
  };

  const imprimir = async () => {
    setBusy(true);
    // Abrir ventana ANTES del await para evitar bloqueo de popup
    const win = window.open("", "_blank");
    if (!win) {
      toast("Permite ventanas emergentes en este sitio para imprimir.", "warning");
      setBusy(false);
      return;
    }
    try {
      const dataUrl = await capture(lado === "frente" ? frenteRef : reversoRef);
      win.document.write(`<html><head><title>Credencial</title><style>
        @page{size:63.5mm 101mm;margin:0}body{margin:0;padding:0}img{width:63.5mm;height:101mm;display:block}
      </style></head><body><img src="${dataUrl}"/></body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 600);
    } catch (e) {
      console.error("Print error:", e);
      win.close();
      toast("Error al generar la impresión.", "error");
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
