// components/deepseek/SkuSugeridoButton.tsx
'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface SkuSugeridoButtonProps {
  nombreProducto: string;
  categoria: string;
  subcategoria: string;
  onSkuSugerido: (sku: string) => void;
  productosExistentes?: any[];
}

export default function SkuSugeridoButton({
  nombreProducto,
  categoria,
  subcategoria,
  onSkuSugerido,
  productosExistentes = []
}: SkuSugeridoButtonProps) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sugerirSku = async () => {
    if (!nombreProducto.trim()) {
      setError("Escribe un nombre de producto primero");
      return;
    }

    setCargando(true);
    setError(null);

    try {
      const response = await fetch('/api/deepseek/sugerir-sku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreProducto,
          categoria,
          subcategoria,
          productosExistentes
        })
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else if (data.sku) {
        onSkuSugerido(data.sku);
        // Mostrar explicación en consola por ahora
        console.log("🤖 SKU sugerido:", data.sku, "-", data.explicacion);
      }
    } catch (err) {
      setError("Error al conectar con la IA");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={sugerirSku}
        disabled={cargando || !nombreProducto.trim()}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 text-xs font-bold flex items-center gap-1 shadow-md"
        title="Sugerir SKU con IA"
      >
        {cargando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        IA
      </button>
      {error && (
        <div className="absolute bottom-full right-0 mb-1 p-1 bg-red-100 text-red-600 text-[9px] rounded whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}