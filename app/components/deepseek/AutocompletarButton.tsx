// components/deepseek/AutocompletarButton.tsx
'use client';

import { useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';

interface AutocompletarButtonProps {
  nombreCompleto: string;
  onAutocompletar: (campos: { c1: string; c2: string; c3: string; c4: string }) => void;
}

export default function AutocompletarButton({
  nombreCompleto,
  onAutocompletar
}: AutocompletarButtonProps) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autocompletar = async () => {
    if (!nombreCompleto.trim()) {
      setError("Escribe el nombre completo primero");
      return;
    }

    setCargando(true);
    setError(null);

    try {
      const response = await fetch('/api/deepseek/autocompletar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombreProducto: nombreCompleto })
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        onAutocompletar({
          c1: data.c1 || "",
          c2: data.c2 || "",
          c3: data.c3 || "",
          c4: data.c4 || ""
        });
      }
    } catch (err) {
      setError("Error al conectar con la IA");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={autocompletar}
        disabled={cargando || !nombreCompleto.trim()}
        className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-bold uppercase hover:bg-emerald-200 transition-all disabled:opacity-50"
      >
        {cargando ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
        Autocompletar
      </button>
      {error && <div className="text-red-500 text-[8px] mt-1">{error}</div>}
    </div>
  );
}