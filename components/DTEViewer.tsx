"use client";
import { useState, useCallback, useRef } from "react";
import { Loader2, Printer, Download, AlertCircle, X, FileText } from "lucide-react";

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface DTEData {
  tipoDte: string;
  folio: string;
  fechaEmision: string;
  emisor: { rut: string; razon_social: string; giro: string; direccion: string; ciudad: string };
  receptor: { rut: string; razon_social: string; giro: string; direccion: string; ciudad: string };
  items: { nro: string; nombre: string; qty: string; precio: string; monto: string; descuento?: string; exento?: string }[];
  totales: { neto: string; iva: string; exento: string; total: string; tasa_iva: string };
  referencias?: { tipo: string; folio: string; fecha: string; razon: string }[];
  timbre?: string;
}

const TIPO_DTE: Record<string, string> = {
  "33": "FACTURA ELECTRÓNICA",
  "34": "FACTURA NO AFECTA O EXENTA ELECTRÓNICA",
  "39": "BOLETA ELECTRÓNICA",
  "41": "BOLETA NO AFECTA O EXENTA ELECTRÓNICA",
  "52": "GUÍA DE DESPACHO ELECTRÓNICA",
  "56": "NOTA DE DÉBITO ELECTRÓNICA",
  "61": "NOTA DE CRÉDITO ELECTRÓNICA",
  "110": "FACTURA DE EXPORTACIÓN ELECTRÓNICA",
};

const get = (el: Element | null, tag: string): string =>
  el?.querySelector(tag)?.textContent?.trim() || "";

const fmt = (n: string | number) =>
  `$${Number(n || 0).toLocaleString("es-CL")}`;

// ─── Parser XML DTE chileno ─────────────────────────────────────────────────
function parseDTE(xmlText: string): DTEData | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    if (doc.querySelector("parsererror")) return null;

    const enc = doc.querySelector("Encabezado");
    if (!enc) return null;

    const idDoc = enc.querySelector("IdDoc");
    const emisor = enc.querySelector("Emisor");
    const receptor = enc.querySelector("Receptor");
    const totales = enc.querySelector("Totales");

    const detalles = Array.from(doc.querySelectorAll("Detalle")).map(d => ({
      nro: get(d, "NroLinDet"),
      nombre: get(d, "NmbItem") || get(d, "DscItem"),
      qty: get(d, "QtyItem") || "1",
      precio: get(d, "PrcItem"),
      monto: get(d, "MontoItem"),
      descuento: get(d, "DescuentoPct") || get(d, "DescuentoMonto"),
      exento: get(d, "IndExe"),
    }));

    const refs = Array.from(doc.querySelectorAll("Referencia")).map(r => ({
      tipo: get(r, "TpoDocRef"),
      folio: get(r, "FolioRef"),
      fecha: get(r, "FchRef"),
      razon: get(r, "RazonRef"),
    }));

    return {
      tipoDte: get(idDoc, "TipoDTE"),
      folio: get(idDoc, "Folio"),
      fechaEmision: get(idDoc, "FchEmis"),
      emisor: {
        rut: get(emisor, "RUTEmisor"),
        razon_social: get(emisor, "RznSoc"),
        giro: get(emisor, "GiroEmis") || get(emisor, "Giro"),
        direccion: get(emisor, "DirOrigen") || get(emisor, "Direccion"),
        ciudad: get(emisor, "CiudadOrigen") || get(emisor, "Ciudad"),
      },
      receptor: {
        rut: get(receptor, "RUTRecep"),
        razon_social: get(receptor, "RznSocRecep"),
        giro: get(receptor, "GiroRecep"),
        direccion: get(receptor, "DirRecep"),
        ciudad: get(receptor, "CiudadRecep"),
      },
      items: detalles,
      totales: {
        neto: get(totales, "MntNeto"),
        iva: get(totales, "IVA"),
        exento: get(totales, "MntExe"),
        total: get(totales, "MntTotal"),
        tasa_iva: get(totales, "TasaIVA") || "19",
      },
      referencias: refs,
    };
  } catch {
    return null;
  }
}

// ─── Componente visor ────────────────────────────────────────────────────────
interface Props {
  xmlUrl: string;
  dteInfo?: { id: string; folio: string; tipo: string; emisor: string; total: string };
  onClose: () => void;
}

export default function DTEViewer({ xmlUrl, dteInfo, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dte, setDte] = useState<DTEData | null>(null);
  const [xmlRaw, setXmlRaw] = useState("");
  const [vistaXml, setVistaXml] = useState(false);
  const facturaRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/obuma/compras-dte/xml?url=${encodeURIComponent(xmlUrl)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      setXmlRaw(xml);
      const parsed = parseDTE(xml);
      if (!parsed) throw new Error("No se pudo parsear el XML como DTE chileno");
      setDte(parsed);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [xmlUrl]);

  // Cargar al montar
  useState(() => { cargar(); });
  // useEffect equivalent using useState initial call trick - let me use the proper way
  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setInitialized(true);
    setTimeout(cargar, 0);
  }

  const imprimir = () => {
    const contenido = facturaRef.current?.innerHTML;
    if (!contenido) return;
    const ventana = window.open("", "_blank", "width=900,height=700");
    if (!ventana) return;
    ventana.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>DTE ${dte?.tipoDte} #${dte?.folio}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; font-family: 'Arial', sans-serif; }
          body { background:white; padding:20px; font-size:11px; color:#1a1a1a; }
          .dte-wrapper { max-width:800px; margin:0 auto; border:2px solid #000; }
          .header { background:#1a1a2e; color:white; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; }
          .header-tipo { font-size:14px; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; }
          .header-folio { background:white; color:#1a1a2e; padding:6px 12px; border-radius:4px; font-weight:900; font-size:13px; }
          .emisor-receptor { display:grid; grid-template-columns:1fr 1fr; border-bottom:1px solid #e0e0e0; }
          .box { padding:12px 16px; }
          .box-title { font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:0.1em; color:#666; margin-bottom:6px; border-bottom:1px solid #eee; padding-bottom:4px; }
          .box-name { font-size:13px; font-weight:700; margin-bottom:2px; }
          .box-row { font-size:10px; color:#555; margin:1px 0; }
          .box-rut { font-family:monospace; font-size:11px; font-weight:700; color:#059669; }
          table { width:100%; border-collapse:collapse; }
          th { background:#f5f5f5; font-size:9px; font-weight:900; text-transform:uppercase; padding:6px 8px; border:1px solid #ddd; color:#444; }
          td { padding:5px 8px; border:1px solid #eee; font-size:10px; vertical-align:top; }
          tr:nth-child(even) td { background:#fafafa; }
          .totales { margin-left:auto; width:300px; border:1px solid #ddd; }
          .total-row { display:flex; justify-content:space-between; padding:4px 8px; font-size:11px; border-bottom:1px solid #f0f0f0; }
          .total-final { background:#1a1a2e; color:white; font-weight:900; font-size:13px; }
          .footer { font-size:8px; color:#999; text-align:center; padding:8px; border-top:1px solid #eee; }
          @media print { body { padding:0; } }
        </style>
      </head>
      <body>${contenido}</body>
      </html>
    `);
    ventana.document.close();
    setTimeout(() => ventana.print(), 500);
  };

  const tipoLabel = TIPO_DTE[dte?.tipoDte || ""] || `DTE Tipo ${dte?.tipoDte}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-emerald-400" />
            <span className="text-sm font-bold text-white">Visor DTE</span>
            {dteInfo && (
              <span className="text-[10px] font-mono text-slate-400">
                {dteInfo.emisor} · Folio #{dteInfo.folio}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {dte && !loading && (
              <>
                <button
                  onClick={() => setVistaXml(v => !v)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${vistaXml ? "bg-amber-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
                >
                  {vistaXml ? "Ver DTE" : "&lt;/&gt; XML"}
                </button>
                <button
                  onClick={imprimir}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-emerald-700"
                >
                  <Printer size={12} /> Imprimir / PDF
                </button>
                <a
                  href={xmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-blue-700"
                >
                  <Download size={12} /> XML
                </a>
              </>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin text-emerald-500 mb-3" size={36} />
              <p className="text-slate-500 text-sm">Obteniendo y parseando DTE...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20">
              <AlertCircle className="text-rose-400 mb-3" size={36} />
              <p className="text-rose-500 text-sm font-bold">{error}</p>
              <button onClick={cargar} className="mt-3 text-xs text-[#059669] font-bold hover:underline">Reintentar</button>
            </div>
          )}

          {/* Vista XML raw */}
          {dte && !loading && vistaXml && (
            <div className="bg-slate-900 p-5">
              <pre className="text-[10px] font-mono text-emerald-300 whitespace-pre leading-relaxed">
                {xmlRaw.replace(/></g, ">\n<").split("\n").map(l=>l.trim()).filter(Boolean).join("\n")}
              </pre>
            </div>
          )}

          {/* Vista DTE renderizada */}
          {dte && !loading && !vistaXml && (
            <div className="p-6 bg-slate-100">
              <div ref={facturaRef} className="dte-wrapper bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 max-w-3xl mx-auto">

                {/* Cabecera */}
                <div className="header" style={{ background: "#1a1a2e", color: "white", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: "8px", fontWeight: 900, letterSpacing: "0.15em", opacity: 0.7, textTransform: "uppercase", marginBottom: "2px" }}>Documento Tributario Electrónico</p>
                    <p style={{ fontSize: "15px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.03em" }}>{tipoLabel}</p>
                  </div>
                  <div style={{ background: "white", color: "#1a1a2e", padding: "8px 16px", borderRadius: "8px", textAlign: "center" }}>
                    <p style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6 }}>Folio</p>
                    <p style={{ fontSize: "22px", fontWeight: 900, lineHeight: 1 }}>#{dte.folio}</p>
                    <p style={{ fontSize: "10px", opacity: 0.6 }}>{dte.fechaEmision}</p>
                  </div>
                </div>

                {/* Emisor / Receptor */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #e5e7eb" }}>
                  {[
                    { label: "Emisor (Proveedor)", data: dte.emisor },
                    { label: "Receptor", data: dte.receptor },
                  ].map(({ label, data }) => (
                    <div key={label} style={{ padding: "14px 18px", borderRight: "1px solid #e5e7eb" }}>
                      <p style={{ fontSize: "9px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", marginBottom: "6px", paddingBottom: "4px", borderBottom: "1px solid #f3f4f6" }}>
                        {label}
                      </p>
                      <p style={{ fontSize: "13px", fontWeight: 700, marginBottom: "2px" }}>{data.razon_social || "—"}</p>
                      <p style={{ fontSize: "11px", fontFamily: "monospace", color: "#059669", fontWeight: 700 }}>{data.rut}</p>
                      {data.giro && <p style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}>{data.giro}</p>}
                      {data.direccion && <p style={{ fontSize: "10px", color: "#6b7280" }}>{data.direccion}{data.ciudad ? ` · ${data.ciudad}` : ""}</p>}
                    </div>
                  ))}
                </div>

                {/* Items */}
                <div style={{ padding: "0" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        {["#", "Descripción del Ítem", "Cant.", "P. Unitario", "Dto", "Monto"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", borderBottom: "1px solid #e5e7eb", textAlign: h === "Monto" || h === "P. Unitario" ? "right" : "left" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dte.items.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "11px" }}>
                            Sin ítems en este documento
                          </td>
                        </tr>
                      ) : dte.items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "8px 10px", fontSize: "10px", color: "#9ca3af", width: "30px" }}>{item.nro}</td>
                          <td style={{ padding: "8px 10px", fontSize: "11px", fontWeight: 500 }}>
                            {item.nombre}
                            {item.exento === "1" && (
                              <span style={{ fontSize: "8px", background: "#fef9c3", color: "#854d0e", padding: "1px 5px", borderRadius: "3px", marginLeft: "6px", fontWeight: 700 }}>Exento</span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", fontSize: "11px", textAlign: "center" }}>{item.qty}</td>
                          <td style={{ padding: "8px 10px", fontSize: "11px", textAlign: "right" }}>{item.precio ? fmt(item.precio) : "—"}</td>
                          <td style={{ padding: "8px 10px", fontSize: "10px", textAlign: "center", color: "#6b7280" }}>
                            {item.descuento ? `${item.descuento}%` : "—"}
                          </td>
                          <td style={{ padding: "8px 10px", fontSize: "11px", fontWeight: 700, textAlign: "right" }}>{fmt(item.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totales */}
                <div style={{ padding: "16px 18px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ width: "260px", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
                    {[
                      ["Neto", dte.totales.neto, false],
                      ...(Number(dte.totales.exento) > 0 ? [["Exento", dte.totales.exento, false]] : []),
                      [`IVA (${dte.totales.tasa_iva}%)`, dte.totales.iva, false],
                    ].map(([k, v, _]) => (
                      v ? (
                        <div key={k as string} style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", fontSize: "11px", borderBottom: "1px solid #f3f4f6" }}>
                          <span style={{ color: "#6b7280" }}>{k as string}</span>
                          <span style={{ fontWeight: 600 }}>{fmt(v as string)}</span>
                        </div>
                      ) : null
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "#1a1a2e", color: "white" }}>
                      <span style={{ fontWeight: 700, fontSize: "12px" }}>TOTAL</span>
                      <span style={{ fontWeight: 900, fontSize: "16px" }}>{fmt(dte.totales.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Referencias */}
                {(dte.referencias || []).filter(r => r.tipo || r.folio).length > 0 && (
                  <div style={{ padding: "12px 18px", borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
                    <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", marginBottom: "6px" }}>
                      Documentos de Referencia
                    </p>
                    {(dte.referencias || []).map((r, i) => (
                      <p key={i} style={{ fontSize: "10px", color: "#374151" }}>
                        Tipo {r.tipo} · Folio {r.folio} · {r.fecha}
                        {r.razon && ` — ${r.razon}`}
                      </p>
                    ))}
                  </div>
                )}

                {/* Footer SII */}
                <div style={{ padding: "10px 18px", borderTop: "2px solid #1a1a2e", background: "#f9fafb", display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "8px", color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      Documento Tributario Electrónico — Resolución SII
                    </p>
                    <p style={{ fontSize: "9px", color: "#6b7280" }}>
                      {dte.emisor.rut} · {dte.emisor.razon_social}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "9px", color: "#6b7280", fontWeight: 700 }}>
                      {dte.tipoDte} Folio #{dte.folio}
                    </p>
                    <p style={{ fontSize: "8px", color: "#9ca3af" }}>Emitido: {dte.fechaEmision}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && dte && (
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
            <p className="text-[10px] text-slate-400">
              {dte.items.length} ítems · {dte.emisor.razon_social}
            </p>
            <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100">
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
