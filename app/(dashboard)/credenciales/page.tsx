"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, User, Download, Printer, RotateCcw, Check, BadgeCheck, FileImage } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/* ══ Types ══════════════════════════════════════════════════════════════════ */
interface CredData {
  nombre: string; rut: string; cargo: string;
  empresa: string; mandante: string; vigencia: string;
  direccion: string; emailContacto: string; telefono: string;
  clausulas: string;
}
type Diseño = 1 | 2 | 3;
type Lado   = "frente" | "reverso";

const DEF: CredData = {
  nombre: "NOMBRE APELLIDO", rut: "12.345.678-9", cargo: "Cargo / Puesto",
  empresa: "Recurso Humanos ICA SPA", mandante: "Comercial MP SPA", vigencia: "31/12/2026",
  direccion: "Av. Los Jesuitas #14", emailContacto: "contacto@grupoica.cl", telefono: "+569 754 91 040",
  clausulas:
    "Esta credencial es personal e intransferible. Identifica al portador como colaborador " +
    "autorizado de Recurso Humanos ICA, prestando servicios para Comercial MP SPA. En caso " +
    "de pérdida, notificar de inmediato. El uso indebido será sancionado conforme al " +
    "reglamento interno vigente de la empresa contratista.",
};

const W = 336, H = 534;

/* ══ QR ═════════════════════════════════════════════════════════════════════ */
function QRImg({ text, size = 120 }: { text: string; size?: number }) {
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

/* ══════════════════════════════════════════════════════════════════════════
   DISEÑO 1 — Azul cielo / Franja navy izquierda / Ribbons naranja+navy derecha
══════════════════════════════════════════════════════════════════════════ */
function D1Frente({ d, foto }: { d: CredData; foto: string | null }) {
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", background: "#B8D4EE", fontFamily: "Arial,sans-serif" }}>

      {/* Left thin navy parallelogram stripe */}
      <svg style={{ position: "absolute", left: 0, top: 0 }} width={16} height={H}>
        <polygon points={`0,0 16,20 16,${H - 20} 0,${H}`} fill="#1E3A6E" />
      </svg>

      {/* Right navy thin edge */}
      <svg style={{ position: "absolute", right: 0, top: 0 }} width={10} height={H}>
        <rect width={10} height={H} fill="#1E3A6E" />
      </svg>

      {/* Right red/orange S-curve ribbon */}
      <svg style={{ position: "absolute", right: 8, top: 0 }} width={52} height={H} viewBox={`0 0 52 ${H}`} preserveAspectRatio="none">
        <path d={`M48,0 C22,${H * 0.1} 0,${H * 0.27} 30,${H * 0.48} C48,${H * 0.61} 52,${H * 0.76} 44,${H} L36,${H} C44,${H * 0.75} 40,${H * 0.6} 24,${H * 0.47} C5,${H * 0.27} 18,${H * 0.09} 48,0Z`} fill="#E05A28" />
      </svg>

      {/* Photo – large yellow frame */}
      <div style={{
        position: "absolute", top: 40, left: "50%", transform: "translateX(-50%)",
        width: 138, height: 138, border: "7px solid #EAB308",
        background: "#CBD5E1", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {foto ? <img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <User size={56} color="#94A3B8" />}
      </div>

      {/* Name — dark navy rounded block */}
      <div style={{ position: "absolute", top: 208, left: 24, right: 32, background: "#1E3A6E", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
        <p style={{ margin: 0, color: "#FFF", fontWeight: 900, fontSize: 14, lineHeight: 1.25, textTransform: "uppercase" }}>{d.nombre}</p>
      </div>

      {/* RUT */}
      <p style={{ position: "absolute", top: 267, left: 24, right: 32, margin: 0, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#1E293B", letterSpacing: "0.05em" }}>{d.rut}</p>

      {/* Cargo */}
      <p style={{ position: "absolute", top: 288, left: 24, right: 32, margin: 0, textAlign: "center", fontSize: 11, fontWeight: 800, color: "#1E3A6E", textTransform: "uppercase", lineHeight: 1.35 }}>{d.cargo}</p>

      {/* Empresa / Mandante — YELLOW box */}
      <div style={{ position: "absolute", top: 364, left: 22, right: 30, background: "#EAB308", borderRadius: 8, padding: "9px 14px" }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#1E293B" }}><span style={{ fontWeight: 900 }}>EMPRESA:  </span>{d.empresa}</p>
        <p style={{ margin: "5px 0 0", fontSize: 10, fontWeight: 700, color: "#1E293B" }}><span style={{ fontWeight: 900 }}>MANDANTE:  </span>{d.mandante}</p>
      </div>

      {/* Vigencia */}
      <p style={{ position: "absolute", bottom: 18, left: 24, right: 32, margin: 0, textAlign: "center", fontSize: 10, color: "#334155" }}>Vigencia: {d.vigencia}</p>
    </div>
  );
}

function D1Reverso({ d, qrText }: { d: CredData; qrText: string }) {
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", background: "#FFFFFF", fontFamily: "Arial,sans-serif" }}>

      {/* Right side — large dark blue + gold flowing curves */}
      <svg style={{ position: "absolute", right: 0, top: 0 }} width={115} height={H} viewBox={`0 0 115 ${H}`} preserveAspectRatio="none">
        {/* Dark navy main shape */}
        <path d={`M115,0 C72,${H * 0.07} 48,${H * 0.24} 76,${H * 0.45} C100,${H * 0.6} 115,${H * 0.76} 100,${H} L115,${H}Z`} fill="#1E3A6E" />
        {/* Gold ribbon inside */}
        <path d={`M115,${H * 0.04} C88,${H * 0.12} 72,${H * 0.3} 90,${H * 0.49} C104,${H * 0.61} 108,${H * 0.76} 102,${H} L96,${H} C102,${H * 0.75} 98,${H * 0.6} 86,${H * 0.48} C68,${H * 0.29} 84,${H * 0.11} 113,${H * 0.04}Z`} fill="#F59E0B" opacity="0.92" />
        {/* White inner highlight */}
        <path d={`M115,${H * 0.09} C100,${H * 0.17} 90,${H * 0.33} 104,${H * 0.51} C112,${H * 0.63} 113,${H * 0.77} 108,${H} L104,${H} C109,${H * 0.76} 108,${H * 0.62} 100,${H * 0.5} C86,${H * 0.32} 97,${H * 0.16} 113,${H * 0.09}Z`} fill="rgba(255,255,255,0.3)" />
      </svg>

      {/* Header */}
      <div style={{ position: "absolute", top: 28, left: 24, right: 120 }}>
        <p style={{ margin: 0, fontSize: 21, fontWeight: 900, color: "#1E3A6E" }}>RRHH ICA</p>
        <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 800, color: "#1E293B" }}>TÉRMINOS Y CONDICIONES</p>
      </div>

      {/* Terms */}
      <p style={{ position: "absolute", top: 88, left: 24, right: 122, margin: 0, fontSize: 9.2, lineHeight: 1.65, color: "#1E3A6E", opacity: 0.85 }}>{d.clausulas}</p>

      {/* Divider */}
      <div style={{ position: "absolute", top: 282, left: 24, right: 122, height: 1, background: "#CBD5E1" }} />

      {/* CONTACTO label */}
      <p style={{ position: "absolute", top: 292, left: 24, margin: 0, fontSize: 11, fontWeight: 800, color: "#1E293B" }}>CONTACTO</p>

      {/* Contact lines */}
      {([["📍", d.direccion], ["✉", d.emailContacto], ["📞", d.telefono]] as [string, string][]).map(([ico, val], i) => (
        <div key={i} style={{ position: "absolute", top: 312 + i * 17, left: 24, right: 122, display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 12 }}>{ico}</span>
          <p style={{ margin: 0, fontSize: 9.5, color: "#1E293B", fontWeight: 600 }}>{val}</p>
        </div>
      ))}

      {/* QR — below contacts, left-aligned */}
      <div style={{ position: "absolute", top: 365, left: 24, padding: 4, background: "#FFF", border: "1.5px solid #E2E8F0" }}>
        <QRImg text={qrText} size={110} />
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: 14, left: 24, right: 24 }}>
        <div style={{ height: 1, background: "#CBD5E1", marginBottom: 4 }} />
        <p style={{ margin: 0, textAlign: "center", fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: "0.12em" }}>FIRMA RESPONSABLE</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DISEÑO 2 — Fondo navy / Banda amarilla arriba / Nombre coral / Foto redondeada
══════════════════════════════════════════════════════════════════════════ */
function D2Frente({ d, foto }: { d: CredData; foto: string | null }) {
  const splitY = Math.round(H * 0.21);
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", fontFamily: "Arial,sans-serif" }}>

      {/* Yellow top band */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: splitY + 18, background: "#EAB308" }} />

      {/* Dark navy main background */}
      <div style={{ position: "absolute", top: splitY, left: 0, right: 0, bottom: 0, background: "#1B2A6B" }} />

      {/* Diagonal cut yellow→navy */}
      <svg style={{ position: "absolute", top: splitY - 2, left: 0 }} width={W} height={22} viewBox={`0 0 ${W} 22`} preserveAspectRatio="none">
        <polygon points={`0,0 ${W},22 ${W},0`} fill="#EAB308" />
      </svg>

      {/* Photo — large, rounded corners, in navy section */}
      <div style={{
        position: "absolute", top: 28, left: "50%", transform: "translateX(-50%)",
        width: 148, height: 148, borderRadius: 14,
        background: "#CBD5E1", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {foto ? <img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <User size={60} color="#94A3B8" />}
      </div>

      {/* Name — CORAL/SALMON */}
      <p style={{ position: "absolute", top: 212, left: 16, right: 16, margin: 0, textAlign: "center", fontSize: 18, fontWeight: 900, color: "#F05A28", lineHeight: 1.2, textTransform: "uppercase" }}>{d.nombre}</p>

      {/* RUT */}
      <p style={{ position: "absolute", top: 258, left: 16, right: 16, margin: 0, textAlign: "center", fontSize: 13, fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.05em" }}>{d.rut}</p>

      {/* Cargo */}
      <p style={{ position: "absolute", top: 280, left: 18, right: 18, margin: 0, textAlign: "center", fontSize: 11, color: "#CBD5E1", lineHeight: 1.35 }}>{d.cargo}</p>

      {/* Empresa/Mandante — red badge */}
      <div style={{ position: "absolute", top: 358, left: 18, right: 18, background: "#DC2626", borderRadius: 7, padding: "8px 14px" }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#FFF" }}><span style={{ fontWeight: 900 }}>EMPRESA: </span>{d.empresa}</p>
        <p style={{ margin: "4px 0 0", fontSize: 10, fontWeight: 700, color: "#FFF" }}><span style={{ fontWeight: 900 }}>MANDANTE: </span>{d.mandante}</p>
      </div>

      {/* Expira */}
      <p style={{ position: "absolute", bottom: 20, left: 16, right: 16, margin: 0, textAlign: "center", fontSize: 12, fontWeight: 800, color: "#FFFFFF" }}>EXPIRA: {d.vigencia}</p>
    </div>
  );
}

function D2Reverso({ d, qrText }: { d: CredData; qrText: string }) {
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", background: "#FFFFFF", fontFamily: "Arial,sans-serif" }}>

      {/* Gold triangle top-right */}
      <svg style={{ position: "absolute", top: 0, right: 0 }} width={90} height={90}>
        <polygon points="90,0 0,0 90,90" fill="#EAB308" opacity="0.85" />
      </svg>

      {/* Navy triangle bottom-left */}
      <svg style={{ position: "absolute", bottom: 0, left: 0 }} width={88} height={88}>
        <polygon points="0,88 88,88 0,0" fill="#1B2A6B" />
      </svg>

      {/* Header */}
      <div style={{ position: "absolute", top: 28, left: 24, right: 24 }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#1B2A6B", letterSpacing: "0.04em" }}>RRHH ICA SPA</p>
        <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 800, color: "#1E293B" }}>TERMINOS Y CONDICIONES</p>
      </div>

      {/* Terms */}
      <p style={{ position: "absolute", top: 86, left: 24, right: 24, margin: 0, fontSize: 9.2, lineHeight: 1.65, color: "#475569" }}>{d.clausulas}</p>

      {/* Divider */}
      <div style={{ position: "absolute", top: 278, left: 24, right: 24, height: 1, background: "#E2E8F0" }} />

      {/* Contact — no header */}
      {([["📍", d.direccion], ["✉", d.emailContacto], ["📞", d.telefono]] as [string, string][]).map(([ico, val], i) => (
        <div key={i} style={{ position: "absolute", top: 292 + i * 18, left: 24, right: 24, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#2563EB" }}>{ico}</span>
          <p style={{ margin: 0, fontSize: 10, color: "#1E293B", fontWeight: 600 }}>{val}</p>
        </div>
      ))}

      {/* QR — centered */}
      <div style={{ position: "absolute", top: 358, left: "50%", transform: "translateX(-50%)", padding: 4, background: "#FFF", border: "1.5px solid #E2E8F0" }}>
        <QRImg text={qrText} size={118} />
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: 14, left: 24, right: 24 }}>
        <div style={{ height: 1, background: "#CBD5E1", marginBottom: 4 }} />
        <p style={{ margin: 0, textAlign: "center", fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: "0.12em" }}>FIRMA RESPONSABLE</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DISEÑO 3 — Fondo blanco cuadriculado / Ondas amarillo+naranja+rojo / Foto circular grande
══════════════════════════════════════════════════════════════════════════ */
function D3Frente({ d, foto }: { d: CredData; foto: string | null }) {
  return (
    <div style={{
      position: "relative", width: W, height: H, overflow: "hidden", fontFamily: "Arial,sans-serif",
      background: "#FFFFFF",
      backgroundImage: "repeating-linear-gradient(45deg,#E8ECF0 0,#E8ECF0 1px,transparent 0,transparent 50%)",
      backgroundSize: "14px 14px",
    }}>

      {/* ── TOP WAVES ────────────────────────────── */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%" }} height={132} viewBox={`0 0 ${W} 132`} preserveAspectRatio="none">
        {/* Yellow — outermost/topmost */}
        <path d={`M-4,0 L${W + 4},0 L${W + 4},78 C${W * 0.65},100 ${W * 0.3},68 -4,84 Z`} fill="#EAB308" />
        {/* Orange — middle band */}
        <path d={`M-4,84 C${W * 0.3},68 ${W * 0.65},100 ${W + 4},78 L${W + 4},105 C${W * 0.65},120 ${W * 0.3},92 -4,108 Z`} fill="#F97316" />
        {/* Red/coral — inner band */}
        <path d={`M-4,108 C${W * 0.3},92 ${W * 0.65},120 ${W + 4},105 L${W + 4},132 C${W * 0.65},125 ${W * 0.3},132 -4,128 Z`} fill="#E05A28" />
      </svg>

      {/* ── CIRCULAR PHOTO — large, dark navy ring ── */}
      <div style={{
        position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)",
        width: 162, height: 162, borderRadius: "50%",
        border: "9px solid #1E3A6E",
        background: "#CBD5E1", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {foto
          ? <img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
          : <User size={68} color="#94A3B8" />}
      </div>

      {/* Name */}
      <p style={{ position: "absolute", top: 252, left: 16, right: 16, margin: 0, textAlign: "center", fontSize: 19, fontWeight: 900, color: "#1E3A6E", lineHeight: 1.2, textTransform: "uppercase" }}>{d.nombre}</p>

      {/* RUT */}
      <p style={{ position: "absolute", top: 295, left: 16, right: 16, margin: 0, textAlign: "center", fontSize: 13, fontWeight: 800, color: "#1E3A6E" }}>{d.rut}</p>

      {/* Cargo */}
      <p style={{ position: "absolute", top: 318, left: 18, right: 18, margin: 0, textAlign: "center", fontSize: 11, color: "#475569", lineHeight: 1.35 }}>{d.cargo}</p>

      {/* Divider */}
      <div style={{ position: "absolute", top: 365, left: 22, right: 22, height: 1.5, background: "#CBD5E1" }} />

      {/* Empresa */}
      <div style={{ position: "absolute", top: 376, left: 22, right: 22, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.1em" }}>EMPRESA</p>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, fontWeight: 800, color: "#1E3A6E" }}>{d.empresa}</p>
      </div>

      {/* Mandante */}
      <div style={{ position: "absolute", top: 424, left: 22, right: 22, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.1em" }}>MANDANTE</p>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, fontWeight: 800, color: "#1E3A6E" }}>{d.mandante}</p>
      </div>

      {/* ── BOTTOM WAVES ─────────────────────────── */}
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%" }} height={118} viewBox={`0 0 ${W} 118`} preserveAspectRatio="none">
        {/* Red/coral — topmost in bottom section */}
        <path d={`M-4,0 C${W * 0.35},20 ${W * 0.65},-4 ${W + 4},12 L${W + 4},118 L-4,118 Z`} fill="#E05A28" />
        {/* Orange */}
        <path d={`M-4,22 C${W * 0.35},42 ${W * 0.65},18 ${W + 4},34 L${W + 4},12 C${W * 0.65},-4 ${W * 0.35},20 -4,0 Z`} fill="#F97316" />
        {/* Yellow — bottommost */}
        <path d={`M-4,44 C${W * 0.35},62 ${W * 0.65},40 ${W + 4},54 L${W + 4},34 C${W * 0.65},18 ${W * 0.35},42 -4,22 Z`} fill="#EAB308" />
      </svg>
    </div>
  );
}

function D3Reverso({ d, qrText }: { d: CredData; qrText: string }) {
  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", background: "#0F172A", fontFamily: "Arial,sans-serif" }}>

      {/* Left orange strip */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 22, background: "#F97316" }} />

      {/* Bottom orange wave */}
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%" }} height={52} viewBox={`0 0 ${W} 52`} preserveAspectRatio="none">
        <path d={`M0,52 L${W},52 L${W},18 C${W * 0.65},2 ${W * 0.35},30 0,14 Z`} fill="#F97316" />
      </svg>

      {/* Header */}
      <div style={{ position: "absolute", top: 28, left: 34, right: 22 }}>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#F97316" }}>RRHH ICA</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 800, color: "#FFFFFF" }}>TÉRMINOS Y CONDICIONES</p>
        <div style={{ marginTop: 7, height: 2, width: 44, background: "#F97316", borderRadius: 2 }} />
      </div>

      {/* Terms */}
      <p style={{ position: "absolute", top: 96, left: 34, right: 18, margin: 0, fontSize: 9.2, lineHeight: 1.65, color: "#94A3B8" }}>{d.clausulas}</p>

      {/* Divider */}
      <div style={{ position: "absolute", top: 284, left: 34, right: 18, height: 1, background: "#1E293B" }} />

      {/* Contact — 3 lines */}
      {([["📍", d.direccion], ["✉", d.emailContacto], ["📞", d.telefono]] as [string, string][]).map(([ico, val], i) => (
        <div key={i} style={{ position: "absolute", top: 298 + i * 18, left: 34, right: 18, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12 }}>{ico}</span>
          <p style={{ margin: 0, fontSize: 9.5, color: "#CBD5E1", fontWeight: 500 }}>{val}</p>
        </div>
      ))}

      {/* QR — centered, positioned BELOW contact (last contact at ~352, QR starts 368) */}
      <div style={{ position: "absolute", top: 362, left: "50%", transform: "translateX(-50%)", padding: 5, background: "#FFFFFF" }}>
        <QRImg text={qrText} size={118} />
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: 60, left: 34, right: 22 }}>
        <div style={{ height: 1, background: "#334155", marginBottom: 4 }} />
        <p style={{ margin: 0, textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569", letterSpacing: "0.12em" }}>FIRMA RESPONSABLE</p>
      </div>
    </div>
  );
}

/* ══ Router ═════════════════════════════════════════════════════════════════ */
function CardRender({ diseño, lado, d, foto, qrText }: { diseño: Diseño; lado: Lado; d: CredData; foto: string | null; qrText: string }) {
  if (diseño === 1) return lado === "frente" ? <D1Frente d={d} foto={foto} /> : <D1Reverso d={d} qrText={qrText} />;
  if (diseño === 2) return lado === "frente" ? <D2Frente d={d} foto={foto} /> : <D2Reverso d={d} qrText={qrText} />;
  return lado === "frente" ? <D3Frente d={d} foto={foto} /> : <D3Reverso d={d} qrText={qrText} />;
}

/* ══ Field — FUERA del componente principal para evitar re-mount y pérdida de foco ══ */
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

const DISENOS = [
  { id: 1 as Diseño, label: "Diseño 1", sub: "Azul · Dorado",    colors: ["#B8D4EE", "#EAB308", "#E05A28"] },
  { id: 2 as Diseño, label: "Diseño 2", sub: "Navy · Amarillo",  colors: ["#1B2A6B", "#EAB308", "#DC2626"] },
  { id: 3 as Diseño, label: "Diseño 3", sub: "Blanco · Naranja", colors: ["#FFFFFF", "#F97316", "#EAB308"] },
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

  const capture = (ref: React.RefObject<HTMLDivElement | null>) =>
    html2canvas(ref.current!, { scale: 4, useCORS: true, allowTaint: true, backgroundColor: null, logging: false });

  const exportPDF = async () => {
    setBusy(true);
    try {
      const [c1, c2] = await Promise.all([capture(frenteRef), capture(reversoRef)]);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [63.5, 101] });
      pdf.addImage(c1.toDataURL("image/png"), "PNG", 0, 0, 63.5, 101);
      pdf.addPage();
      pdf.addImage(c2.toDataURL("image/png"), "PNG", 0, 0, 63.5, 101);
      pdf.save(`credencial-D${diseño}-${data.nombre.replace(/\s+/g, "_")}.pdf`);
    } finally { setBusy(false); }
  };

  const exportPNG = async () => {
    setBusy(true);
    try {
      const ref = lado === "frente" ? frenteRef : reversoRef;
      const canvas = await capture(ref);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `credencial-D${diseño}-${lado}-${data.nombre.replace(/\s+/g, "_")}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } finally { setBusy(false); }
  };

  const imprimir = async () => {
    setBusy(true);
    try {
      const ref = lado === "frente" ? frenteRef : reversoRef;
      const canvas = await capture(ref);
      const win = window.open("", "_blank")!;
      win.document.write(`<html><head><title>Imprimir</title><style>
        @page{size:63.5mm 101mm;margin:0}body{margin:0}img{width:63.5mm;height:101mm;display:block}
      </style></head><body><img src="${canvas.toDataURL("image/png")}"/></body></html>`);
      win.document.close(); win.focus();
      setTimeout(() => win.print(), 500);
    } finally { setBusy(false); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6">

      {/* ── FORMULARIO ── */}
      <div className="space-y-4">

        {/* Selector diseño */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Seleccionar Diseño</p>
          <div className="grid grid-cols-3 gap-3">
            {DISENOS.map(info => (
              <button key={info.id} onClick={() => setDiseño(info.id)}
                className={`relative rounded-xl border-2 p-3 text-left transition-all ${diseño === info.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}>
                {diseño === info.id && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check size={10} color="white" strokeWidth={3} />
                  </span>
                )}
                <div className="flex gap-1 mb-2">
                  {info.colors.map(c => <span key={c} style={{ background: c, border: c === "#FFFFFF" ? "1px solid #CBD5E1" : "none" }} className="w-3.5 h-3.5 rounded-full" />)}
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
            <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-slate-200 transition" onClick={() => fileInput.current?.click()}>
              {foto ? <img src={foto} className="w-full h-full object-cover" alt="" /> : <User size={24} className="text-slate-400" />}
            </div>
            <div className="flex-1">
              <button onClick={() => fileInput.current?.click()} className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition">
                <Upload size={14} /> Subir foto
              </button>
              {foto && <button onClick={() => setFoto(null)} className="mt-1 flex items-center gap-1.5 text-xs text-rose-500"><RotateCcw size={11} /> Quitar</button>}
              <p className="text-[10px] text-slate-400 mt-1">JPG · PNG · proporción 1:1 recomendada</p>
            </div>
          </div>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
        </div>

        {/* Datos colaborador */}
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

      {/* ── PREVIEW ── */}
      <div className="flex flex-col items-center gap-5">

        {/* Toggle frente/reverso */}
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm gap-1">
          {(["frente", "reverso"] as Lado[]).map(l => (
            <button key={l} onClick={() => setLado(l)}
              className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${lado === l ? "bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white shadow" : "text-slate-500 hover:text-slate-700"}`}>
              {l === "frente" ? "▶  Frente" : "◀  Reverso"}
            </button>
          ))}
        </div>

        {/* Card preview */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 18, boxShadow: "0 28px 70px rgba(0,0,0,0.3)" }} />
          <AnimatePresence mode="wait">
            <motion.div key={`${diseño}-${lado}`} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}
              style={{ borderRadius: 16, overflow: "hidden", width: W, height: H }}>
              <CardRender diseño={diseño} lado={lado} d={data} foto={foto} qrText={qrText} />
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="text-[11px] text-slate-400 font-mono tracking-wide">63.5 × 101 mm · Credencial PVC vertical</p>

        {/* Botones */}
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
          <p>El QR del reverso codifica nombre, RUT, empresa y vigencia — permanente. Para PVC configura la impresora en tamaño <strong>63.5 × 101 mm</strong>.</p>
        </div>
      </div>

      {/* ── RENDERS OCULTOS para captura html2canvas (siempre en DOM) ── */}
      <div style={{ position: "fixed", left: -9999, top: -9999, pointerEvents: "none", zIndex: -1 }}>
        <div ref={frenteRef} style={{ width: W, height: H }}>
          <CardRender diseño={diseño} lado="frente" d={data} foto={foto} qrText={qrText} />
        </div>
      </div>
      <div style={{ position: "fixed", left: -9999, top: -9999, pointerEvents: "none", zIndex: -1 }}>
        <div ref={reversoRef} style={{ width: W, height: H }}>
          <CardRender diseño={diseño} lado="reverso" d={data} foto={foto} qrText={qrText} />
        </div>
      </div>
    </div>
  );
}
