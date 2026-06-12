"use client";
// Spinner moderno del design system — anillo con gradiente + etiqueta opcional.
// Uso: <Spinner />  ·  <Spinner size={28} label="Cargando productos…" />
//      <PageLoader label="Cargando análisis…" /> para estados de página completa.

export function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  const border = Math.max(2, Math.round(size / 9));
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block animate-spin rounded-full border-slate-200 border-t-[#2563EB] ${className}`}
      style={{ width: size, height: size, borderWidth: border }}
    />
  );
}

export function PageLoader({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 animate-fade-up">
      <div className="relative">
        <Spinner size={40} />
        <span className="absolute inset-0 rounded-full bg-[#2563EB]/10 blur-xl animate-pulse" />
      </div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
    </div>
  );
}

/** Skeleton de tabla — para listas mientras cargan */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 py-2" role="status" aria-label="Cargando datos">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton h-9 w-9 shrink-0 rounded-lg" />
          <div className="skeleton h-4 rounded" style={{ width: `${72 - (i % 3) * 14}%` }} />
          <div className="skeleton ml-auto h-4 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}
