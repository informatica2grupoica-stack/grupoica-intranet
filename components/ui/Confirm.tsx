"use client";
// Confirm.tsx — diálogo de confirmación moderno con API imperativa.
// Reemplazo directo del confirm() nativo del navegador:
//
//   import { confirmar } from "@/components/ui/Confirm";
//   if (!(await confirmar({ titulo: "¿Eliminar proveedor?", danger: true }))) return;
//
// <ConfirmHost /> se monta una sola vez en el layout del dashboard.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, HelpCircle } from "lucide-react";

export interface ConfirmOpts {
  titulo: string;
  descripcion?: string;
  confirmText?: string;
  cancelText?: string;
  /** true → botón rojo y icono de advertencia (acciones destructivas) */
  danger?: boolean;
}

type Pending = ConfirmOpts & { resolve: (ok: boolean) => void };

let enqueue: ((p: Pending) => void) | null = null;

/** Muestra el diálogo y resuelve true (confirmar) o false (cancelar/cerrar). */
export function confirmar(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (!enqueue) {
      // Host no montado (no debería pasar) — degradar al confirm nativo
      resolve(window.confirm(opts.titulo));
      return;
    }
    enqueue({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    enqueue = (p) => setPending(p);
    return () => { enqueue = null; };
  }, []);

  const cerrar = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar(false);
      if (e.key === "Enter") cerrar(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.13 }}
        >
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[3px]" onClick={() => cerrar(false)} />
          <motion.div
            role="alertdialog" aria-modal="true"
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 p-6"
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: "spring", stiffness: 460, damping: 30 }}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${
              pending.danger ? "bg-rose-50 text-rose-500" : "bg-blue-50 text-[#2563EB]"
            }`}>
              {pending.danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
            </div>
            <h2 className="text-[15px] font-bold text-slate-800 leading-snug">{pending.titulo}</h2>
            {pending.descripcion && (
              <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">{pending.descripcion}</p>
            )}
            <div className="flex gap-2.5 mt-6">
              <button
                onClick={() => cerrar(false)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                {pending.cancelText || "Cancelar"}
              </button>
              <button
                onClick={() => cerrar(true)}
                autoFocus
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white shadow-lg transition-colors ${
                  pending.danger
                    ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/25"
                    : "bg-[#2563EB] hover:bg-[#1D4ED8] shadow-blue-500/25"
                }`}
              >
                {pending.confirmText || (pending.danger ? "Eliminar" : "Confirmar")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
