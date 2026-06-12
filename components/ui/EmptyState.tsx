"use client";
// Estado vacío estandarizado — icono en burbuja, título, descripción y CTA opcional.
// Uso: <EmptyState icon={Package} title="Sin productos" description="Sube un Excel para empezar."
//                  action={<button …>Subir Excel</button>} />
import type { ElementType, ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 animate-fade-up">
      <div className="relative mb-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/80 flex items-center justify-center shadow-sm">
          <Icon className="w-6 h-6 text-slate-400" />
        </div>
        <span className="absolute -inset-2 rounded-3xl bg-[#2563EB]/[0.04] blur-md -z-10" />
      </div>
      <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      {description && <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
