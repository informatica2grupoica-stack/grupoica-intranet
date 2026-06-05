"use client";
// Toast.tsx — thin wrapper sobre sonner para mantener compatibilidad con llamadas existentes
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

export function ToastContainer() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        style: { borderRadius: '14px', fontWeight: 600, fontSize: '13px' },
        duration: 4000,
      }}
    />
  );
}
