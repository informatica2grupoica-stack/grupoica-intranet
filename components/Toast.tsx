"use client";
// Toast.tsx — wrapper sobre sonner con el estilo del design system.
// API compatible: toast(mensaje, tipo) · nuevo: toastPromise(promesa, msgs)
import { toast as sonnerToast, Toaster } from "sonner";

export type ToastType = "success" | "error" | "warning" | "info";

export function toast(message: string, type: ToastType = "info") {
  switch (type) {
    case "success": sonnerToast.success(message); break;
    case "error":   sonnerToast.error(message);   break;
    case "warning": sonnerToast.warning(message); break;
    default:        sonnerToast.info(message);    break;
  }
}

/** Toast con estados de carga/éxito/error ligado a una promesa.
 *  toastPromise(fetch(...), { loading: 'Guardando…', success: 'Guardado', error: 'No se pudo guardar' }) */
export function toastPromise<T>(
  promise: Promise<T>,
  msgs: { loading: string; success: string; error: string },
) {
  return sonnerToast.promise(promise, msgs);
}

export function ToastContainer() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      expand={false}
      gap={10}
      toastOptions={{
        duration: 4000,
        style: {
          borderRadius: "14px",
          fontWeight: 600,
          fontSize: "13px",
          letterSpacing: "-0.01em",
          boxShadow: "0 10px 38px -10px rgb(15 23 42 / 0.22), 0 4px 12px -6px rgb(15 23 42 / 0.12)",
          border: "1px solid rgb(15 23 42 / 0.06)",
        },
        classNames: {
          toast: "backdrop-blur-md",
        },
      }}
    />
  );
}
