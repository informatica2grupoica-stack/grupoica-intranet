"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, User, Download, Printer, RotateCcw,
  MapPin, Mail, Phone, Check, ChevronLeft, ChevronRight,
  BadgeCheck, Layers, FileImage,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/* ── Types ─────────────────────────────────────────────────────────────────── */
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
type Lado  = "frente" | "reverso";

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
    "colaborador autorizado de Recurso Humanos ICA. Prestando servicios para " +
    "Comercial MP SPA. En caso de pérdida, notificar de inmediato. El uso " +
    "indebido será sancionado conforme al reglamento interno vigente de la " +
    "empresa contratista.",
};

/* ── Card dimensions (portrait ID badge) ───────────────────────────────────── */
const CARD_W = 336;
const CARD_H = 534; // ratio ≈ 63.5 × 101 mm

/* ══════════════════════════════════════════════════════════════════════════════
   QR helper
══════════════════════════════════════════════════════════════════════════════ */
function QRImg({ text, size = 90 }: { text: string; size?: number }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let alive = true;
    import("qrcode").then(({ default: QRCode }) =>
      QRCode.toDataURL(text, {
        width: size * 2,
        margin: 1,
        color: { dark: "#0F172A", light: "#FFFFFF" },
      }).then((url) => alive && setSrc(url))
    );
    return () => { alive = false; };
  }, [text, size]);
  if (!src) return <div style={{ width: size, height: size, background: "#E2E8F0" }} />;
  return <img src={src} width={size} height={size} alt="QR" style={{ display: "block" }} />;
}

/* ══════════════════════════════════════════════════════════════════════════════
   DESIGN 1 — Sky-blue / Gold / Orange
══════════════════════════════════════════════════════════════════════════════ */
function D1Frente({ data, foto }: { data: CredencialData; foto: string | null }) {
  return (
    <div
      style={{
        position: "relative",
        width: CARD_W,
        height: CARD_H,
        overflow: "hidden",
        background: "linear-gradient(160deg,#C8DDEF 0%,#B2CDE8 100%)",
        fontFamily: "'Arial', sans-serif",
      }}
    >
      {/* Left gold stripe */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 22,
          height: "100%",
          background: "linear-gradient(180deg,#F59E0B,#D97706 50%,#F59E0B)",
        }}
      />
      {/* Right orange swoosh */}
      <svg
        style={{ position: "absolute", right: 0, top: 0, height: "100%" }}
        viewBox="0 0 80 534"
        width={80}
        preserveAspectRatio="none"
      >
        <path
          d="M80,0 C40,80 20,200 50,300 C70,360 80,420 80,534 L80,0Z"
          fill="#F97316"
          opacity="0.85"
        />
        <path
          d="M80,0 C60,100 45,220 65,320 C75,370 80,440 80,534 L80,0Z"
          fill="#EA580C"
          opacity="0.6"
        />
      </svg>

      {/* Photo */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: "50%",
          transform: "translateX(-50%)",
          width: 118,
          height: 118,
          border: "6px solid #F59E0B",
          background: "#CBD5E1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {foto ? (
          <img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        ) : (
          <User size={48} color="#94A3B8" />
        )}
      </div>

      {/* Name block */}
      <div
        style={{
          position: "absolute",
          top: 198,
          left: 36,
          right: 52,
          background: "#1E3A6E",
          borderRadius: 8,
          padding: "8px 14px",
          textAlign: "center",
        }}
      >
        <p style={{ color: "#FFFFFF", fontWeight: 900, fontSize: 15, lineHeight: 1.25, margin: 0, textTransform: "uppercase" }}>
          {data.nombre}
        </p>
      </div>

      {/* RUT */}
      <p
        style={{
          position: "absolute",
          top: 256,
          left: 0,
          right: 52,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "#1E293B",
          margin: 0,
          letterSpacing: "0.05em",
        }}
      >
        {data.rut}
      </p>

      {/* Cargo */}
      <p
        style={{
          position: "absolute",
          top: 276,
          left: 36,
          right: 52,
          textAlign: "center",
          fontSize: 11,
          fontWeight: 800,
          color: "#1E3A6E",
          textTransform: "uppercase",
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {data.cargo}
      </p>

      {/* Empresa */}
      <div
        style={{
          position: "absolute",
          top: 358,
          left: 36,
          right: 52,
          background: "#1E3A6E",
          borderRadius: 5,
          padding: "5px 10px",
        }}
      >
        <p style={{ color: "#FFFFFF", fontSize: 9.5, fontWeight: 700, margin: 0 }}>
          <span style={{ color: "#93C5FD" }}>EMPRESA: </span>
          {data.empresa}
        </p>
      </div>

      {/* Mandante */}
      <div
        style={{
          position: "absolute",
          top: 392,
          left: 36,
          right: 52,
          background: "#1E3A6E",
          borderRadius: 5,
          padding: "5px 10px",
        }}
      >
        <p style={{ color: "#FFFFFF", fontSize: 9.5, fontWeight: 700, margin: 0 }}>
          <span style={{ color: "#93C5FD" }}>MANDANTE: </span>
          {data.mandante}
        </p>
      </div>

      {/* Vigencia */}
      <p
        style={{
          position: "absolute",
          bottom: 18,
          left: 36,
          right: 52,
          textAlign: "center",
          fontSize: 10,
          color: "#1E293B",
          margin: 0,
        }}
      >
        Vigencia: {data.vigencia}
      </p>
    </div>
  );
}

function D1Reverso({ data, qrText }: { data: CredencialData; qrText: string }) {
  return (
    <div
      style={{
        position: "relative",
        width: CARD_W,
        height: CARD_H,
        overflow: "hidden",
        background: "#F8FAFC",
        fontFamily: "'Arial', sans-serif",
      }}
    >
      {/* Blue top-left swoosh */}
      <svg style={{ position: "absolute", left: 0, top: 0 }} width={110} height={160} viewBox="0 0 110 160">
        <path d="M0,0 C60,20 100,60 110,160 L0,160Z" fill="#1E3A6E" opacity="0.9" />
        <path d="M0,0 C40,30 70,80 80,160 L0,160Z" fill="#F59E0B" opacity="0.7" />
      </svg>

      {/* Gold bottom-right decoration */}
      <svg style={{ position: "absolute", right: 0, bottom: 0 }} width={100} height={130} viewBox="0 0 100 130">
        <path d="M100,130 C40,110 10,80 0,0 L100,0Z" fill="#1E3A6E" opacity="0.85" />
        <path d="M100,130 C60,100 30,70 20,0 L100,0Z" fill="#F59E0B" opacity="0.65" />
      </svg>

      {/* Header */}
      <div style={{ position: "absolute", top: 28, left: 22, right: 22, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#1E3A6E", letterSpacing: "0.05em" }}>
          RRHH ICA
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 800, color: "#1E293B" }}>
          TÉRMINOS Y CONDICIONES
        </p>
      </div>

      {/* Terms */}
      <div style={{ position: "absolute", top: 84, left: 22, right: 22 }}>
        <p style={{ margin: 0, fontSize: 9, lineHeight: 1.55, color: "#1E3A6E" }}>
          {data.clausulas}
        </p>
      </div>

      {/* Separator */}
      <div style={{ position: "absolute", top: 268, left: 22, right: 22, height: 1, background: "#CBD5E1" }} />

      {/* CONTACTO */}
      <p style={{ position: "absolute", top: 278, left: 22, margin: 0, fontSize: 11, fontWeight: 800, color: "#1E293B" }}>
        CONTACTO
      </p>

      <div style={{ position: "absolute", top: 300, left: 22, right: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { Icon: MapPin,  val: data.direccion },
          { Icon: Mail,    val: data.emailContacto },
          { Icon: Phone,   val: data.telefono },
        ].map(({ Icon, val }) => (
          <div key={val} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1E3A6E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={11} color="#FFFFFF" />
            </div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#1E293B" }}>{val}</p>
          </div>
        ))}
      </div>

      {/* QR */}
      <div style={{ position: "absolute", bottom: 52, left: "50%", transform: "translateX(-50%)", padding: 4, background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
        <QRImg text={qrText} size={80} />
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: 14, left: 22, right: 22 }}>
        <div style={{ height: 1, background: "#CBD5E1", marginBottom: 4 }} />
        <p style={{ margin: 0, textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569", letterSpacing: "0.1em" }}>
          FIRMA RESPONSABLE
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   DESIGN 2 — Dark Navy / Yellow frame
══════════════════════════════════════════════════════════════════════════════ */
function D2Frente({ data, foto }: { data: CredencialData; foto: string | null }) {
  return (
    <div
      style={{
        position: "relative",
        width: CARD_W,
        height: CARD_H,
        overflow: "hidden",
        fontFamily: "'Arial', sans-serif",
      }}
    >
      {/* Dark blue upper half */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "55%",
          background: "#1E3A6E",
        }}
      />
      {/* White lower half */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "45%",
          background: "#FFFFFF",
        }}
      />

      {/* Diagonal divider accent */}
      <svg style={{ position: "absolute", top: "48%", left: 0, right: 0 }} width={CARD_W} height={40}>
        <polygon points={`0,0 ${CARD_W},40 ${CARD_W},0`} fill="#1E3A6E" />
      </svg>

      {/* Yellow border photo */}
      <div
        style={{
          position: "absolute",
          top: 38,
          left: "50%",
          transform: "translateX(-50%)",
          width: 130,
          height: 130,
          border: "7px solid #EAB308",
          background: "#CBD5E1",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {foto ? (
          <img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        ) : (
          <User size={52} color="#94A3B8" />
        )}
      </div>

      {/* Name */}
      <p
        style={{
          position: "absolute",
          top: 226,
          left: 20,
          right: 20,
          textAlign: "center",
          fontSize: 17,
          fontWeight: 900,
          color: "#1E293B",
          margin: 0,
          lineHeight: 1.2,
          textTransform: "uppercase",
        }}
      >
        {data.nombre}
      </p>

      {/* RUT */}
      <p
        style={{
          position: "absolute",
          top: 268,
          left: 20,
          right: 20,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "#1E293B",
          margin: 0,
          letterSpacing: "0.05em",
        }}
      >
        {data.rut}
      </p>

      {/* Cargo */}
      <p
        style={{
          position: "absolute",
          top: 290,
          left: 20,
          right: 20,
          textAlign: "center",
          fontSize: 11,
          color: "#475569",
          margin: 0,
          lineHeight: 1.35,
        }}
      >
        {data.cargo}
      </p>

      {/* Empresa / Mandante red banner */}
      <div
        style={{
          position: "absolute",
          top: 366,
          left: 20,
          right: 20,
          background: "#DC2626",
          borderRadius: 5,
          padding: "7px 12px",
        }}
      >
        <p style={{ margin: 0, fontSize: 9.5, fontWeight: 700, color: "#FFFFFF" }}>
          <strong>EMPRESA: </strong>{data.empresa}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 9.5, fontWeight: 700, color: "#FFFFFF" }}>
          <strong>MANDANTE: </strong>{data.mandante}
        </p>
      </div>

      {/* Expira */}
      <p
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          right: 20,
          textAlign: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "#1E293B",
          margin: 0,
        }}
      >
        EXPIRA: {data.vigencia}
      </p>
    </div>
  );
}

function D2Reverso({ data, qrText }: { data: CredencialData; qrText: string }) {
  return (
    <div
      style={{
        position: "relative",
        width: CARD_W,
        height: CARD_H,
        overflow: "hidden",
        background: "#FFFFFF",
        fontFamily: "'Arial', sans-serif",
      }}
    >
      {/* Top-right gold triangle */}
      <svg style={{ position: "absolute", top: 0, right: 0 }} width={90} height={90} viewBox="0 0 90 90">
        <polygon points="90,0 0,0 90,90" fill="#EAB308" opacity="0.8" />
      </svg>

      {/* Bottom-left navy triangle */}
      <svg style={{ position: "absolute", bottom: 0, left: 0 }} width={90} height={90} viewBox="0 0 90 90">
        <polygon points="0,90 90,90 0,0" fill="#1E3A6E" />
      </svg>

      {/* Header */}
      <div style={{ position: "absolute", top: 28, left: 22, right: 22 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#2563EB", letterSpacing: "0.06em" }}>
          RRHH ICA SPA
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 800, color: "#1E293B" }}>
          TERMINOS Y CONDICIONES
        </p>
      </div>

      {/* Terms */}
      <div style={{ position: "absolute", top: 82, left: 22, right: 22 }}>
        <p style={{ margin: 0, fontSize: 9, lineHeight: 1.55, color: "#475569" }}>
          {data.clausulas}
        </p>
      </div>

      {/* Contact — no header, just icons */}
      <div style={{ position: "absolute", top: 286, left: 22, right: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { Icon: MapPin,  val: data.direccion },
          { Icon: Mail,    val: data.emailContacto },
          { Icon: Phone,   val: data.telefono },
        ].map(({ Icon, val }) => (
          <div key={val} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon size={13} color="#2563EB" strokeWidth={2.5} style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#1E293B" }}>{val}</p>
          </div>
        ))}
      </div>

      {/* QR */}
      <div style={{ position: "absolute", bottom: 50, left: "50%", transform: "translateX(-50%)", padding: 4, background: "#FFFFFF", border: "1.5px solid #E2E8F0" }}>
        <QRImg text={qrText} size={80} />
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: 14, left: 22, right: 22 }}>
        <div style={{ height: 1, background: "#CBD5E1", marginBottom: 4 }} />
        <p style={{ margin: 0, textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569", letterSpacing: "0.1em" }}>
          FIRMA RESPONSABLE
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   DESIGN 3 — Dark Navy / Orange circular
══════════════════════════════════════════════════════════════════════════════ */
function D3Frente({ data, foto }: { data: CredencialData; foto: string | null }) {
  return (
    <div
      style={{
        position: "relative",
        width: CARD_W,
        height: CARD_H,
        overflow: "hidden",
        fontFamily: "'Arial', sans-serif",
        background: "#FFFFFF",
      }}
    >
      {/* Dark navy upper area */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220, background: "#0F172A" }} />

      {/* Orange left wave */}
      <svg style={{ position: "absolute", left: 0, top: 0, height: 420 }} width={55} viewBox="0 0 55 420" preserveAspectRatio="none">
        <path d="M0,0 C30,80 50,160 30,260 C15,330 0,380 0,420 L0,0Z" fill="#F97316" />
        <path d="M0,0 C20,70 35,150 18,250 C8,320 0,370 0,420 L0,0Z" fill="#EA580C" opacity="0.6" />
      </svg>

      {/* Orange right wave */}
      <svg style={{ position: "absolute", right: 0, bottom: 0, height: 300 }} width={50} viewBox="0 0 50 300" preserveAspectRatio="none">
        <path d="M50,0 C20,60 10,140 30,220 C40,260 50,290 50,300 L50,0Z" fill="#F97316" />
      </svg>

      {/* Checkered pattern strip */}
      <div
        style={{
          position: "absolute",
          top: 195,
          left: 0,
          right: 0,
          height: 30,
          backgroundImage:
            "repeating-linear-gradient(45deg,#0F172A 0,#0F172A 6px,transparent 0,transparent 50%)",
          backgroundSize: "12px 12px",
          opacity: 0.12,
        }}
      />

      {/* Circular photo */}
      <div
        style={{
          position: "absolute",
          top: 46,
          left: "50%",
          transform: "translateX(-50%)",
          width: 136,
          height: 136,
          borderRadius: "50%",
          border: "7px solid #0F172A",
          background: "#CBD5E1",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {foto ? (
          <img src={foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        ) : (
          <User size={52} color="#94A3B8" />
        )}
      </div>

      {/* Name */}
      <p
        style={{
          position: "absolute",
          top: 226,
          left: 20,
          right: 20,
          textAlign: "center",
          fontSize: 18,
          fontWeight: 900,
          color: "#0F172A",
          margin: 0,
          lineHeight: 1.2,
          textTransform: "uppercase",
        }}
      >
        {data.nombre}
      </p>

      {/* RUT */}
      <p
        style={{
          position: "absolute",
          top: 270,
          left: 20,
          right: 20,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "#1E293B",
          margin: 0,
        }}
      >
        {data.rut}
      </p>

      {/* Cargo */}
      <p
        style={{
          position: "absolute",
          top: 291,
          left: 24,
          right: 24,
          textAlign: "center",
          fontSize: 11,
          color: "#475569",
          margin: 0,
          lineHeight: 1.35,
        }}
      >
        {data.cargo}
      </p>

      {/* Divider */}
      <div style={{ position: "absolute", top: 356, left: 24, right: 24, height: 1.5, background: "#E2E8F0" }} />

      {/* Empresa */}
      <div style={{ position: "absolute", top: 368, left: 24, right: 24 }}>
        <p style={{ margin: 0, fontSize: 10, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>EMPRESA</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{data.empresa}</p>
      </div>

      {/* Mandante */}
      <div style={{ position: "absolute", top: 416, left: 24, right: 24 }}>
        <p style={{ margin: 0, fontSize: 10, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>MANDANTE</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{data.mandante}</p>
      </div>

      {/* Vigencia */}
      <p
        style={{
          position: "absolute",
          bottom: 16,
          left: 24,
          right: 24,
          textAlign: "center",
          fontSize: 10,
          color: "#94A3B8",
          margin: 0,
          fontStyle: "italic",
        }}
      >
        Vigencia: {data.vigencia}
      </p>
    </div>
  );
}

function D3Reverso({ data, qrText }: { data: CredencialData; qrText: string }) {
  return (
    <div
      style={{
        position: "relative",
        width: CARD_W,
        height: CARD_H,
        overflow: "hidden",
        background: "#0F172A",
        fontFamily: "'Arial', sans-serif",
      }}
    >
      {/* Orange left accent */}
      <svg style={{ position: "absolute", left: 0, top: 0, height: "60%" }} width={30} viewBox="0 0 30 320" preserveAspectRatio="none">
        <path d="M0,0 L30,0 C20,80 10,160 30,320 L0,320Z" fill="#F97316" />
      </svg>

      {/* Orange bottom accent */}
      <svg style={{ position: "absolute", bottom: 0, right: 0 }} width={CARD_W} height={50} viewBox={`0 0 ${CARD_W} 50`}>
        <path d={`M0,50 C${CARD_W * 0.3},10 ${CARD_W * 0.6},40 ${CARD_W},0 L${CARD_W},50Z`} fill="#F97316" />
      </svg>

      {/* Header */}
      <div style={{ position: "absolute", top: 30, left: 30, right: 22 }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#F97316", letterSpacing: "0.06em" }}>
          RRHH ICA
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 800, color: "#FFFFFF" }}>
          TÉRMINOS Y CONDICIONES
        </p>
      </div>

      {/* Divider */}
      <div style={{ position: "absolute", top: 80, left: 30, right: 22, height: 1, background: "#F97316", opacity: 0.5 }} />

      {/* Terms */}
      <div style={{ position: "absolute", top: 92, left: 30, right: 22 }}>
        <p style={{ margin: 0, fontSize: 9, lineHeight: 1.6, color: "#94A3B8" }}>
          {data.clausulas}
        </p>
      </div>

      {/* Contact */}
      <div style={{ position: "absolute", top: 302, left: 30, right: 22, display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { Icon: MapPin,  val: data.direccion },
          { Icon: Mail,    val: data.emailContacto },
          { Icon: Phone,   val: data.telefono },
        ].map(({ Icon, val }) => (
          <div key={val} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Icon size={12} color="#F97316" strokeWidth={2.5} style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 10, color: "#CBD5E1", fontWeight: 500 }}>{val}</p>
          </div>
        ))}
      </div>

      {/* QR — white background so it scans */}
      <div style={{ position: "absolute", bottom: 58, left: "50%", transform: "translateX(-50%)", padding: 5, background: "#FFFFFF" }}>
        <QRImg text={qrText} size={78} />
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: 22, left: 30, right: 22 }}>
        <div style={{ height: 1, background: "#334155", marginBottom: 4 }} />
        <p style={{ margin: 0, textAlign: "center", fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: "0.12em" }}>
          FIRMA RESPONSABLE
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Design thumbnails for selector
══════════════════════════════════════════════════════════════════════════════ */
const DISEÑO_INFO = [
  { id: 1 as Diseño, label: "Diseño 1", subtitle: "Azul Cielo · Dorado", colors: ["#C8DDEF", "#F59E0B", "#F97316"] },
  { id: 2 as Diseño, label: "Diseño 2", subtitle: "Navy · Amarillo", colors: ["#1E3A6E", "#EAB308", "#DC2626"] },
  { id: 3 as Diseño, label: "Diseño 3", subtitle: "Navy Oscuro · Naranja", colors: ["#0F172A", "#F97316", "#FFFFFF"] },
];

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
export default function CredencialesPage() {
  const [data, setData]       = useState<CredencialData>(DEFAULTS);
  const [foto, setFoto]       = useState<string | null>(null);
  const [diseño, setDiseño]   = useState<Diseño>(1);
  const [lado, setLado]       = useState<Lado>("frente");
  const [exporting, setExporting] = useState(false);

  const cardRef   = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const qrText = `RRHH ICA | ${data.nombre} | RUT: ${data.rut} | ${data.empresa} | Vigencia: ${data.vigencia}`;

  const upd = useCallback(
    (k: keyof CredencialData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setData((prev) => ({ ...prev, [k]: e.target.value })),
    []
  );

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const exportPNG = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    const canvas = await html2canvas(cardRef.current, { scale: 3, useCORS: true, backgroundColor: null });
    const link = document.createElement("a");
    link.download = `credencial-d${diseño}-${lado}-${data.nombre.replace(/\s+/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setExporting(false);
  };

  const exportPDF = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [63.5, 101] });

    // Capture current side
    const canvas1 = await html2canvas(cardRef.current, { scale: 4, useCORS: true });
    pdf.addImage(canvas1.toDataURL("image/png"), "PNG", 0, 0, 63.5, 101);

    // Flip to other side and capture
    const otherSide: Lado = lado === "frente" ? "reverso" : "frente";
    setLado(otherSide);
    // give React time to re-render
    await new Promise((r) => setTimeout(r, 400));
    const canvas2 = await html2canvas(cardRef.current, { scale: 4, useCORS: true });
    pdf.addPage();
    pdf.addImage(canvas2.toDataURL("image/png"), "PNG", 0, 0, 63.5, 101);

    setLado(lado); // restore
    pdf.save(`credencial-d${diseño}-${data.nombre.replace(/\s+/g, "_")}.pdf`);
    setExporting(false);
  };

  /* ─── Render the selected design ──────────────────────────────────────── */
  const renderCard = () => {
    if (diseño === 1)
      return lado === "frente"
        ? <D1Frente data={data} foto={foto} />
        : <D1Reverso data={data} qrText={qrText} />;
    if (diseño === 2)
      return lado === "frente"
        ? <D2Frente data={data} foto={foto} />
        : <D2Reverso data={data} qrText={qrText} />;
    return lado === "frente"
      ? <D3Frente data={data} foto={foto} />
      : <D3Reverso data={data} qrText={qrText} />;
  };

  /* ─── Input helpers ────────────────────────────────────────────────────── */
  const Field = ({
    label, k, half = false, as = "input",
  }: {
    label: string;
    k: keyof CredencialData;
    half?: boolean;
    as?: "input" | "textarea";
  }) => (
    <div className={half ? "col-span-1" : "col-span-2"}>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      {as === "textarea" ? (
        <textarea
          rows={4}
          value={data[k]}
          onChange={upd(k)}
          className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none transition"
        />
      ) : (
        <input
          type="text"
          value={data[k]}
          onChange={upd(k)}
          className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
        />
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6">
      {/* ── LEFT PANEL: form ─────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Design selector */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            Seleccionar Diseño
          </p>
          <div className="grid grid-cols-3 gap-3">
            {DISEÑO_INFO.map((d) => (
              <button
                key={d.id}
                onClick={() => setDiseño(d.id)}
                className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                  diseño === d.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                {diseño === d.id && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check size={10} color="white" strokeWidth={3} />
                  </span>
                )}
                {/* Color dots */}
                <div className="flex gap-1 mb-2">
                  {d.colors.map((c) => (
                    <span
                      key={c}
                      style={{ background: c, border: c === "#FFFFFF" ? "1px solid #E2E8F0" : "none" }}
                      className="w-3.5 h-3.5 rounded-full inline-block"
                    />
                  ))}
                </div>
                <p className="text-[11px] font-bold text-slate-700">{d.label}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{d.subtitle}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Photo upload */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Foto</p>
          <div className="flex items-center gap-3">
            <div
              className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-slate-200 transition"
              onClick={() => fileInput.current?.click()}
            >
              {foto ? (
                <img src={foto} className="w-full h-full object-cover" alt="" />
              ) : (
                <User size={24} className="text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <button
                onClick={() => fileInput.current?.click()}
                className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
              >
                <Upload size={14} /> Subir foto
              </button>
              {foto && (
                <button
                  onClick={() => setFoto(null)}
                  className="mt-1 flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 transition"
                >
                  <RotateCcw size={11} /> Quitar foto
                </button>
              )}
              <p className="text-[10px] text-slate-400 mt-1">JPG, PNG · Recomendado 1:1</p>
            </div>
          </div>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
        </div>

        {/* Employee data */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            Datos del Colaborador
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre completo" k="nombre" />
            <Field label="RUT"             k="rut"    half />
            <Field label="Vigencia"        k="vigencia" half />
            <Field label="Cargo / Puesto"  k="cargo" />
            <Field label="Empresa"         k="empresa" />
            <Field label="Mandante"        k="mandante" />
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            Contacto (reverso)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dirección"  k="direccion" />
            <Field label="Email"      k="emailContacto" />
            <Field label="Teléfono"   k="telefono" />
          </div>
        </div>

        {/* Clauses */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            Cláusulas (reverso)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Texto de términos y condiciones" k="clausulas" as="textarea" />
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: preview + export ────────────────────────────────── */}
      <div className="flex flex-col items-center gap-5">

        {/* Toggle front/back */}
        <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-sm gap-1">
          {(["frente", "reverso"] as Lado[]).map((l) => (
            <button
              key={l}
              onClick={() => setLado(l)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                lado === l
                  ? "bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white shadow"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {l === "frente" ? "▶ Frente" : "◀ Reverso"}
            </button>
          ))}
        </div>

        {/* Card preview */}
        <div className="relative">
          {/* Shadow ring */}
          <div
            className="absolute inset-0 rounded-[18px]"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.25)", borderRadius: 18 }}
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={`${diseño}-${lado}`}
              initial={{ opacity: 0, rotateY: 90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: -90 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ perspective: 800 }}
            >
              <div
                ref={cardRef}
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  borderRadius: 16,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {renderCard()}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Size label */}
        <p className="text-[11px] text-slate-400 font-mono">
          63.5 × 101 mm — Credencial PVC vertical
        </p>

        {/* Export buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={exportPNG}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-sm disabled:opacity-50"
          >
            <FileImage size={15} className="text-emerald-500" />
            Exportar PNG
          </button>

          <button
            onClick={exportPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] rounded-xl text-sm font-semibold text-white hover:opacity-90 transition shadow-sm disabled:opacity-50"
          >
            <Download size={15} />
            {exporting ? "Generando…" : "Exportar PDF (ambos lados)"}
          </button>

          <button
            onClick={() => {
              const win = window.open("", "_blank");
              if (!win || !cardRef.current) return;
              win.document.write(`
                <html>
                  <head>
                    <title>Imprimir Credencial</title>
                    <style>
                      @page { size: 63.5mm 101mm; margin: 0; }
                      body { margin: 0; display: flex; justify-content: center; align-items: center; }
                      img { width: 63.5mm; height: 101mm; display: block; }
                    </style>
                  </head>
                  <body></body>
                </html>
              `);
              html2canvas(cardRef.current, { scale: 6, useCORS: true }).then((canvas) => {
                const img = win.document.createElement("img");
                img.src = canvas.toDataURL("image/png");
                win.document.body.appendChild(img);
                win.focus();
                win.print();
              });
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-sm"
          >
            <Printer size={15} className="text-blue-500" />
            Imprimir lado actual
          </button>
        </div>

        {/* Info box */}
        <div className="max-w-sm bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-600 leading-relaxed">
          <p className="font-bold mb-1 flex items-center gap-1.5"><BadgeCheck size={13} /> Formato PVC 63.5 × 101 mm</p>
          <p>El QR del reverso codifica el nombre, RUT, empresa y vigencia — permanente y sin vencimiento propio. Para impresión profesional usa <strong>Exportar PDF</strong> y configura tu impresora en tamaño personalizado 63.5 × 101 mm.</p>
        </div>
      </div>
    </div>
  );
}
