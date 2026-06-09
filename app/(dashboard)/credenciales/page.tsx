"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, User, Download, Printer, RotateCcw,
  MapPin, Mail, Phone, Check, BadgeCheck, FileImage,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/* ══ Types ══════════════════════════════════════════════════════════════════ */
interface CredencialData {
  nombre: string;
  rut: string;
  cargo: string;
  empresa: string;
  mandante: string;
  vigencia: string;
  direccion: string;
  emailContacto: string;
  telefono: string;
  clausulas: string;
}
type Diseño = 1 | 2 | 3;
type Lado   = "frente" | "reverso";

const DEFAULTS: CredencialData = {
  nombre:        "NOMBRE APELLIDO",
  rut:           "12.345.678-9",
  cargo:         "Cargo / Puesto",
  empresa:       "Recurso Humanos ICA SPA",
  mandante:      "Comercial MP SPA",
  vigencia:      "31/12/2026",
  direccion:     "Av. Los Jesuitas #14",
  emailContacto: "contacto@grupoica.cl",
  telefono:      "+569 754 91 040",
  clausulas:
    "Esta credencial es personal e intransferible. Identifica al portador como " +
    "colaborador autorizado de Recurso Humanos ICA, prestando servicios para " +
    "Comercial MP SPA. En caso de pérdida, notificar de inmediato. El uso " +
    "indebido será sancionado conforme al reglamento interno vigente de la " +
    "empresa contratista.",
};

const W = 336;
const H = 534;

/* ══ QR ═════════════════════════════════════════════════════════════════════ */
function QRImg({ text, size = 130 }: { text: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    import("qrcode").then(({ default: QR }) =>
      QR.toDataURL(text, { width: size * 3, margin: 1, color: { dark: "#0F172A", light: "#FFFFFF" } })
        .then((u) => alive && setSrc(u))
    );
    return () => { alive = false; };
  }, [text, size]);
  if (!src) return <div style={{ width: size, height: size, background: "#E2E8F0", borderRadius: 2 }} />;
  return <img src={src} width={size} height={size} alt="QR" style={{ display: "block" }} />;
}

/* ══ Shared reverso layout ══════════════════════════════════════════════════ */
interface ReversoProps {
  data: CredencialData;
  qrText: string;
  bg?: string;
  textColor?: string;
  titleColor?: string;
  accentColor?: string;
  decorTop?: React.ReactNode;
  decorBottom?: React.ReactNode;
  headerLabel?: string;
}
function ReversoBase({
  data, qrText,
  bg = "#F8FAFC", textColor = "#1E293B", titleColor = "#1E3A6E",
  accentColor = "#2563EB",
  decorTop, decorBottom, headerLabel = "RRHH ICA",
}: ReversoProps) {
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", background: bg, fontFamily: "Arial,sans-serif" }}>
      {decorTop}
      {decorBottom}

      {/* Header */}
      <div style={{ position: "absolute", top: 32, left: 28, right: 28 }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: titleColor, letterSpacing: "0.05em" }}>
          {headerLabel}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 800, color: textColor }}>
          TÉRMINOS Y CONDICIONES
        </p>
        <div style={{ marginTop: 6, height: 2, width: 40, background: accentColor, borderRadius: 2 }} />
      </div>

      {/* Terms */}
      <p style={{
        position: "absolute", top: 106, left: 28, right: 28,
        margin: 0, fontSize: 9.2, lineHeight: 1.65, color: textColor, opacity: 0.82,
      }}>
        {data.clausulas}
      </p>

      {/* Divider */}
      <div style={{ position: "absolute", top: 296, left: 28, right: 28, height: 1, background: textColor, opacity: 0.12 }} />

      {/* Contact */}
      <div style={{ position: "absolute", top: 312, left: 28, right: 28, display: "flex", flexDirection: "column", gap: 11 }}>
        {[
          { icon: "📍", val: data.direccion },
          { icon: "✉",  val: data.emailContacto },
          { icon: "📞", val: data.telefono },
        ].map(({ icon, val }) => (
          <div key={val} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 13 }}>{icon}</span>
            <p style={{ margin: 0, fontSize: 10, color: textColor, fontWeight: 600 }}>{val}</p>
          </div>
        ))}
      </div>

      {/* QR */}
      <div style={{
        position: "absolute", bottom: 52, left: "50%", transform: "translateX(-50%)",
        padding: 5, background: "#FFFFFF", boxShadow: "0 1px 6px rgba(0,0,0,0.12)",
      }}>
        <QRImg text={qrText} size={130} />
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: 14, left: 28, right: 28 }}>
        <div style={{ height: 1, background: textColor, opacity: 0.2, marginBottom: 5 }} />
        <p style={{ margin: 0, textAlign: "center", fontSize: 9, fontWeight: 700, color: textColor, opacity: 0.5, letterSpacing: "0.12em" }}>
          FIRMA RESPONSABLE
        </p>
      </div>
    </div>
  );
}

/* ══ DISEÑO 1 — Azul cielo · Dorado · Naranja ══════════════════════════════ */
function D1Frente({ data, foto }: { data: CredencialData; foto: string | null }) {
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", background: "#BDD5ED", fontFamily: "Arial,sans-serif" }}>

      {/* Left gold chevron stripe */}
      <svg style={{ position: "absolute", left: 0, top: 0 }} width={32} height={H}>
        <polygon points={`0,0 32,14 32,${H - 14} 0,${H}`} fill="#F59E0B" />
        <polygon points={`0,0 18,0 32,14`} fill="#D97706" />
        <polygon points={`0,${H} 18,${H} 32,${H - 14}`} fill="#D97706" />
      </svg>

      {/* Right orange swoosh */}
      <svg style={{ position: "absolute", right: 0, top: 0 }} width={68} height={H} viewBox={`0 0 68 ${H}`} preserveAspectRatio="none">
        <path d={`M68,0 C28,${H*0.12} 10,${H*0.32} 40,${H*0.52} C62,${H*0.64} 68,${H*0.78} 68,${H} L68,0Z`} fill="#F97316" opacity="0.9" />
        <path d={`M68,0 C44,${H*0.14} 28,${H*0.36} 52,${H*0.56} C66,${H*0.66} 68,${H*0.8} 68,${H} L68,0Z`} fill="#EA580C" opacity="0.5" />
      </svg>

      {/* Photo */}
      <div style={{
        position: "absolute", top: 44, left: "50%", transform: "translateX(-50%)",
        width: 122, height: 122, border: "6px solid #F59E0B",
        background: "#CBD5E1", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {foto
          ? <img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
          : <User size={44} color="#94A3B8" />}
      </div>

      {/* Name block */}
      <div style={{
        position: "absolute", top: 200, left: 42, right: 54,
        background: "#1E3A6E", borderRadius: 8, padding: "9px 14px", textAlign: "center",
      }}>
        <p style={{ margin: 0, color: "#FFFFFF", fontWeight: 900, fontSize: 14, lineHeight: 1.25, textTransform: "uppercase" }}>
          {data.nombre}
        </p>
      </div>

      {/* RUT */}
      <p style={{ position: "absolute", top: 256, left: 42, right: 54, margin: 0, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#1E293B", letterSpacing: "0.05em" }}>
        {data.rut}
      </p>

      {/* Cargo */}
      <p style={{ position: "absolute", top: 276, left: 42, right: 54, margin: 0, textAlign: "center", fontSize: 10.5, fontWeight: 800, color: "#1E3A6E", textTransform: "uppercase", lineHeight: 1.35 }}>
        {data.cargo}
      </p>

      {/* Empresa */}
      <div style={{ position: "absolute", top: 354, left: 42, right: 54, background: "#1E3A6E", borderRadius: 5, padding: "5px 10px" }}>
        <p style={{ margin: 0, fontSize: 9.5, fontWeight: 700, color: "#FFFFFF" }}>
          <span style={{ color: "#93C5FD" }}>EMPRESA:  </span>{data.empresa}
        </p>
      </div>

      {/* Mandante */}
      <div style={{ position: "absolute", top: 388, left: 42, right: 54, background: "#1E3A6E", borderRadius: 5, padding: "5px 10px" }}>
        <p style={{ margin: 0, fontSize: 9.5, fontWeight: 700, color: "#FFFFFF" }}>
          <span style={{ color: "#93C5FD" }}>MANDANTE:  </span>{data.mandante}
        </p>
      </div>

      {/* Vigencia */}
      <p style={{ position: "absolute", bottom: 18, left: 42, right: 54, margin: 0, textAlign: "center", fontSize: 10, color: "#334155" }}>
        Vigencia: {data.vigencia}
      </p>
    </div>
  );
}

function D1Reverso({ data, qrText }: { data: CredencialData; qrText: string }) {
  return (
    <ReversoBase
      data={data} qrText={qrText}
      bg="#F8FAFC" textColor="#1E293B" titleColor="#1E3A6E" accentColor="#F59E0B"
      headerLabel="RRHH ICA"
      decorTop={
        <svg style={{ position: "absolute", left: 0, top: 0 }} width={120} height={150}>
          <path d="M0,0 C70,10 110,50 120,150 L0,150Z" fill="#1E3A6E" opacity="0.9" />
          <path d="M0,0 C50,15 80,60 90,150 L0,150Z" fill="#F59E0B" opacity="0.7" />
        </svg>
      }
      decorBottom={
        <svg style={{ position: "absolute", right: 0, bottom: 0 }} width={110} height={130}>
          <path d="M110,130 C50,115 10,80 0,0 L110,0Z" fill="#1E3A6E" opacity="0.85" />
          <path d="M110,130 C65,108 28,72 20,0 L110,0Z" fill="#F59E0B" opacity="0.65" />
        </svg>
      }
    />
  );
}

/* ══ DISEÑO 2 — Navy oscuro · Amarillo · Rojo ═══════════════════════════════ */
function D2Frente({ data, foto }: { data: CredencialData; foto: string | null }) {
  const split = H * 0.54;
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", fontFamily: "Arial,sans-serif" }}>

      {/* Dark navy upper */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: split + 28, background: "#1B2D5B" }} />

      {/* White lower */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: H - split + 10, background: "#FFFFFF" }} />

      {/* Diagonal cut */}
      <svg style={{ position: "absolute", top: split - 14, left: 0 }} width={W} height={36} viewBox={`0 0 ${W} 36`} preserveAspectRatio="none">
        <polygon points={`0,0 ${W},36 ${W},0`} fill="#1B2D5B" />
      </svg>

      {/* Yellow frame photo */}
      <div style={{
        position: "absolute", top: 36, left: "50%", transform: "translateX(-50%)",
        width: 134, height: 134, border: "8px solid #EAB308",
        background: "#CBD5E1", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {foto
          ? <img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
          : <User size={50} color="#94A3B8" />}
      </div>

      {/* Name */}
      <p style={{ position: "absolute", top: 226, left: 18, right: 18, margin: 0, textAlign: "center", fontSize: 17, fontWeight: 900, color: "#1B2D5B", lineHeight: 1.2, textTransform: "uppercase" }}>
        {data.nombre}
      </p>

      {/* RUT */}
      <p style={{ position: "absolute", top: 270, left: 18, right: 18, margin: 0, textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "#1B2D5B", letterSpacing: "0.04em" }}>
        {data.rut}
      </p>

      {/* Cargo */}
      <p style={{ position: "absolute", top: 292, left: 20, right: 20, margin: 0, textAlign: "center", fontSize: 11, color: "#475569", lineHeight: 1.35 }}>
        {data.cargo}
      </p>

      {/* Red empresa/mandante badge */}
      <div style={{ position: "absolute", top: 366, left: 18, right: 18, background: "#DC2626", borderRadius: 6, padding: "8px 12px" }}>
        <p style={{ margin: 0, fontSize: 9.5, fontWeight: 700, color: "#FFFFFF" }}>
          <span style={{ fontWeight: 900 }}>EMPRESA: </span>{data.empresa}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 9.5, fontWeight: 700, color: "#FFFFFF" }}>
          <span style={{ fontWeight: 900 }}>MANDANTE: </span>{data.mandante}
        </p>
      </div>

      {/* Expira */}
      <p style={{ position: "absolute", bottom: 18, left: 18, right: 18, margin: 0, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#1B2D5B" }}>
        EXPIRA: {data.vigencia}
      </p>
    </div>
  );
}

function D2Reverso({ data, qrText }: { data: CredencialData; qrText: string }) {
  return (
    <ReversoBase
      data={data} qrText={qrText}
      bg="#FFFFFF" textColor="#1E293B" titleColor="#2563EB" accentColor="#EAB308"
      headerLabel="RRHH ICA SPA"
      decorTop={
        <svg style={{ position: "absolute", top: 0, right: 0 }} width={88} height={88}>
          <polygon points="88,0 0,0 88,88" fill="#EAB308" opacity="0.8" />
        </svg>
      }
      decorBottom={
        <svg style={{ position: "absolute", bottom: 0, left: 0 }} width={88} height={88}>
          <polygon points="0,88 88,88 0,0" fill="#1B2D5B" />
        </svg>
      }
    />
  );
}

/* ══ DISEÑO 3 — Navy oscuro · Naranja · Circular ═══════════════════════════ */
function D3Frente({ data, foto }: { data: CredencialData; foto: string | null }) {
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", background: "#F1F5F9", fontFamily: "Arial,sans-serif" }}>

      {/* Dark navy top section */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 210, background: "#0F172A" }} />

      {/* Left orange ribbon */}
      <svg style={{ position: "absolute", left: 0, top: 0 }} width={46} height={360} viewBox="0 0 46 360" preserveAspectRatio="none">
        <path d="M0,0 C28,60 46,140 30,240 C18,310 0,340 0,360 L0,0Z" fill="#F97316" />
        <path d="M0,0 C18,65 34,150 20,250 C10,318 0,348 0,360 L0,0Z" fill="#EA580C" opacity="0.55" />
      </svg>

      {/* Right orange ribbon */}
      <svg style={{ position: "absolute", right: 0, bottom: 0 }} width={46} height={360} viewBox="0 0 46 360" preserveAspectRatio="none">
        <path d="M46,0 C18,60 0,140 16,240 C28,310 46,340 46,360 L46,0Z" fill="#F97316" />
        <path d="M46,0 C28,65 12,150 26,250 C36,318 46,348 46,360 L46,0Z" fill="#EA580C" opacity="0.55" />
      </svg>

      {/* Checkered strip */}
      <div style={{
        position: "absolute", top: 198, left: 0, right: 0, height: 20,
        backgroundImage: "repeating-linear-gradient(45deg,#0F172A 0,#0F172A 5px,transparent 0,transparent 50%)",
        backgroundSize: "10px 10px", opacity: 0.1,
      }} />

      {/* Circular photo */}
      <div style={{
        position: "absolute", top: 44, left: "50%", transform: "translateX(-50%)",
        width: 142, height: 142, borderRadius: "50%", border: "8px solid #0F172A",
        background: "#CBD5E1", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {foto
          ? <img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
          : <User size={52} color="#94A3B8" />}
      </div>

      {/* Name */}
      <p style={{ position: "absolute", top: 230, left: 22, right: 22, margin: 0, textAlign: "center", fontSize: 18, fontWeight: 900, color: "#0F172A", lineHeight: 1.2, textTransform: "uppercase" }}>
        {data.nombre}
      </p>

      {/* RUT */}
      <p style={{ position: "absolute", top: 274, left: 22, right: 22, margin: 0, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#1E293B" }}>
        {data.rut}
      </p>

      {/* Cargo */}
      <p style={{ position: "absolute", top: 296, left: 26, right: 26, margin: 0, textAlign: "center", fontSize: 11, color: "#475569", lineHeight: 1.35 }}>
        {data.cargo}
      </p>

      {/* Divider */}
      <div style={{ position: "absolute", top: 355, left: 26, right: 26, height: 1.5, background: "#CBD5E1" }} />

      {/* Empresa */}
      <div style={{ position: "absolute", top: 368, left: 26, right: 26 }}>
        <p style={{ margin: 0, fontSize: 9.5, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>EMPRESA</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 800, color: "#0F172A" }}>{data.empresa}</p>
      </div>

      {/* Mandante */}
      <div style={{ position: "absolute", top: 416, left: 26, right: 26 }}>
        <p style={{ margin: 0, fontSize: 9.5, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>MANDANTE</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 800, color: "#0F172A" }}>{data.mandante}</p>
      </div>

      {/* Vigencia */}
      <p style={{ position: "absolute", bottom: 16, left: 26, right: 26, margin: 0, textAlign: "center", fontSize: 10, color: "#94A3B8", fontStyle: "italic" }}>
        Vigencia: {data.vigencia}
      </p>
    </div>
  );
}

function D3Reverso({ data, qrText }: { data: CredencialData; qrText: string }) {
  return (
    <ReversoBase
      data={data} qrText={qrText}
      bg="#0F172A" textColor="#CBD5E1" titleColor="#F97316" accentColor="#F97316"
      headerLabel="RRHH ICA"
      decorTop={
        <svg style={{ position: "absolute", left: 0, top: 0 }} width={28} height={260} viewBox="0 0 28 260" preserveAspectRatio="none">
          <path d="M0,0 L28,0 C18,70 12,150 28,260 L0,260Z" fill="#F97316" />
        </svg>
      }
      decorBottom={
        <svg style={{ position: "absolute", right: 0, bottom: 0 }} width={W} height={44} viewBox={`0 0 ${W} 44`}>
          <path d={`M0,44 C${W*0.28},8 ${W*0.6},36 ${W},0 L${W},44Z`} fill="#F97316" opacity="0.8" />
        </svg>
      }
    />
  );
}

/* ══ Card renderer ══════════════════════════════════════════════════════════ */
function CardRender({
  diseño, lado, data, foto, qrText,
}: {
  diseño: Diseño; lado: Lado; data: CredencialData; foto: string | null; qrText: string;
}) {
  if (diseño === 1) return lado === "frente" ? <D1Frente data={data} foto={foto} /> : <D1Reverso data={data} qrText={qrText} />;
  if (diseño === 2) return lado === "frente" ? <D2Frente data={data} foto={foto} /> : <D2Reverso data={data} qrText={qrText} />;
  return lado === "frente" ? <D3Frente data={data} foto={foto} /> : <D3Reverso data={data} qrText={qrText} />;
}

/* ══ Field — MUST be outside main component to avoid re-mount on each render ══
   (if defined inside the main component, React treats it as a new type every
    render and unmounts/remounts it, causing the input to lose focus after 1 char) */
interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  span2?: boolean;
  as?: "input" | "textarea";
  rows?: number;
}
function Field({ label, value, onChange, span2 = true, as = "input", rows = 4 }: FieldProps) {
  const cls = "w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition";
  return (
    <div className={span2 ? "col-span-2" : "col-span-1"}>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {as === "textarea"
        ? <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={cls + " resize-none"} />
        : <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />}
    </div>
  );
}

const DISEÑOS_INFO = [
  { id: 1 as Diseño, label: "Diseño 1", sub: "Azul · Dorado", colors: ["#BDD5ED", "#F59E0B", "#F97316"] },
  { id: 2 as Diseño, label: "Diseño 2", sub: "Navy · Amarillo", colors: ["#1B2D5B", "#EAB308", "#DC2626"] },
  { id: 3 as Diseño, label: "Diseño 3", sub: "Navy · Naranja", colors: ["#0F172A", "#F97316", "#F1F5F9"] },
];

/* ══ MAIN PAGE ══════════════════════════════════════════════════════════════ */
export default function CredencialesPage() {
  const [data, setData]     = useState<CredencialData>(DEFAULTS);
  const [foto, setFoto]     = useState<string | null>(null);
  const [diseño, setDiseño] = useState<Diseño>(1);
  const [lado, setLado]     = useState<Lado>("frente");
  const [busy, setBusy]     = useState(false);

  const frenteRef  = useRef<HTMLDivElement>(null);
  const reversoRef = useRef<HTMLDivElement>(null);
  const fileInput  = useRef<HTMLInputElement>(null);

  const qrText = `RRHH ICA | ${data.nombre} | RUT: ${data.rut} | ${data.empresa} | Vigencia: ${data.vigencia}`;

  const upd = (k: keyof CredencialData) => (v: string) =>
    setData((p) => ({ ...p, [k]: v }));

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setFoto(ev.target?.result as string);
    r.readAsDataURL(f);
  };

  /* capture a ref → canvas */
  const capture = (ref: React.RefObject<HTMLDivElement | null>) =>
    html2canvas(ref.current!, {
      scale: 4,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
    });

  /* Export PDF — ambos lados */
  const exportPDF = async () => {
    setBusy(true);
    try {
      const [c1, c2] = await Promise.all([capture(frenteRef), capture(reversoRef)]);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [63.5, 101] });
      pdf.addImage(c1.toDataURL("image/png"), "PNG", 0, 0, 63.5, 101);
      pdf.addPage();
      pdf.addImage(c2.toDataURL("image/png"), "PNG", 0, 0, 63.5, 101);
      pdf.save(`credencial-D${diseño}-${data.nombre.replace(/\s+/g, "_")}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  /* Export PNG — lado visible */
  const exportPNG = async () => {
    setBusy(true);
    try {
      const ref = lado === "frente" ? frenteRef : reversoRef;
      const canvas = await capture(ref);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `credencial-D${diseño}-${lado}-${data.nombre.replace(/\s+/g, "_")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setBusy(false);
    }
  };

  /* Print */
  const imprimir = async () => {
    setBusy(true);
    try {
      const ref = lado === "frente" ? frenteRef : reversoRef;
      const canvas = await capture(ref);
      const win = window.open("", "_blank")!;
      win.document.write(`<html><head><title>Imprimir</title><style>
        @page{size:63.5mm 101mm;margin:0}
        body{margin:0;padding:0}
        img{width:63.5mm;height:101mm;display:block}
      </style></head><body><img src="${canvas.toDataURL("image/png")}"/></body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6">

      {/* ── FORM ── */}
      <div className="space-y-4">

        {/* Design selector */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Seleccionar Diseño</p>
          <div className="grid grid-cols-3 gap-3">
            {DISEÑOS_INFO.map((d) => (
              <button
                key={d.id}
                onClick={() => setDiseño(d.id)}
                className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                  diseño === d.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {diseño === d.id && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check size={10} color="white" strokeWidth={3} />
                  </span>
                )}
                <div className="flex gap-1 mb-2">
                  {d.colors.map((c) => (
                    <span key={c} style={{ background: c, border: c === "#F1F5F9" ? "1px solid #CBD5E1" : "none" }}
                      className="w-3.5 h-3.5 rounded-full" />
                  ))}
                </div>
                <p className="text-[11px] font-bold text-slate-700">{d.label}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{d.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Photo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Foto del colaborador</p>
          <div className="flex items-center gap-3">
            <div
              className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-slate-200 transition"
              onClick={() => fileInput.current?.click()}
            >
              {foto ? <img src={foto} className="w-full h-full object-cover" alt="" /> : <User size={24} className="text-slate-400" />}
            </div>
            <div className="flex-1">
              <button onClick={() => fileInput.current?.click()} className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition">
                <Upload size={14} /> Subir foto
              </button>
              {foto && (
                <button onClick={() => setFoto(null)} className="mt-1 flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 transition">
                  <RotateCcw size={11} /> Quitar foto
                </button>
              )}
              <p className="text-[10px] text-slate-400 mt-1">JPG · PNG · Proporción 1:1 recomendada</p>
            </div>
          </div>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
        </div>

        {/* Employee data */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Datos del colaborador</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre completo" value={data.nombre}        onChange={upd("nombre")} />
            <Field label="RUT"             value={data.rut}           onChange={upd("rut")}           span2={false} />
            <Field label="Vigencia"        value={data.vigencia}      onChange={upd("vigencia")}      span2={false} />
            <Field label="Cargo / Puesto"  value={data.cargo}         onChange={upd("cargo")} />
            <Field label="Empresa"         value={data.empresa}       onChange={upd("empresa")} />
            <Field label="Mandante"        value={data.mandante}      onChange={upd("mandante")} />
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Contacto (reverso)</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dirección"  value={data.direccion}      onChange={upd("direccion")} />
            <Field label="Email"      value={data.emailContacto}  onChange={upd("emailContacto")} />
            <Field label="Teléfono"   value={data.telefono}       onChange={upd("telefono")}      span2={false} />
          </div>
        </div>

        {/* Clauses */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Términos y condiciones (reverso)</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cláusulas" value={data.clausulas} onChange={upd("clausulas")} as="textarea" rows={5} />
          </div>
        </div>
      </div>

      {/* ── PREVIEW + EXPORT ── */}
      <div className="flex flex-col items-center gap-5">

        {/* Toggle */}
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm gap-1">
          {(["frente", "reverso"] as Lado[]).map((l) => (
            <button
              key={l}
              onClick={() => setLado(l)}
              className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
                lado === l ? "bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white shadow" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {l === "frente" ? "▶  Frente" : "◀  Reverso"}
            </button>
          ))}
        </div>

        {/* Visible preview */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 18, boxShadow: "0 24px 64px rgba(0,0,0,0.28)" }} />
          <AnimatePresence mode="wait">
            <motion.div
              key={`${diseño}-${lado}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              style={{ borderRadius: 16, overflow: "hidden", width: W, height: H }}
            >
              <CardRender diseño={diseño} lado={lado} data={data} foto={foto} qrText={qrText} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Size label */}
        <p className="text-[11px] text-slate-400 font-mono tracking-wide">63.5 × 101 mm · Credencial PVC vertical</p>

        {/* Export buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={exportPNG}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-40"
          >
            <FileImage size={15} className="text-emerald-500" />
            PNG · lado actual
          </button>

          <button
            onClick={exportPDF}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] rounded-xl text-sm font-semibold text-white hover:opacity-90 transition shadow-sm disabled:opacity-40"
          >
            <Download size={15} />
            {busy ? "Generando…" : "PDF · ambos lados"}
          </button>

          <button
            onClick={imprimir}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-40"
          >
            <Printer size={15} className="text-blue-500" />
            Imprimir lado actual
          </button>
        </div>

        {/* Info */}
        <div className="max-w-sm bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700 leading-relaxed">
          <p className="font-bold mb-1 flex items-center gap-1.5">
            <BadgeCheck size={13} /> PDF exporta frente + reverso en 2 páginas
          </p>
          <p>El QR del reverso codifica nombre, RUT, empresa y vigencia — permanente, sin fecha de vencimiento propia. Para imprimir en PVC configura tu impresora en tamaño personalizado <strong>63.5 × 101 mm</strong>.</p>
        </div>
      </div>

      {/* ── HIDDEN RENDERS para html2canvas (siempre en DOM) ── */}
      <div style={{ position: "fixed", left: -9999, top: -9999, pointerEvents: "none", zIndex: -1 }}>
        <div ref={frenteRef} style={{ width: W, height: H }}>
          <CardRender diseño={diseño} lado="frente" data={data} foto={foto} qrText={qrText} />
        </div>
      </div>
      <div style={{ position: "fixed", left: -9999, top: -9999, pointerEvents: "none", zIndex: -1 }}>
        <div ref={reversoRef} style={{ width: W, height: H }}>
          <CardRender diseño={diseño} lado="reverso" data={data} foto={foto} qrText={qrText} />
        </div>
      </div>
    </div>
  );
}
