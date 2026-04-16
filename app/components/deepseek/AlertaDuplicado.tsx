// components/deepseek/AlertaDuplicado.tsx
'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ProductoSimilar {
  producto_nombre: string;
  producto_codigo_comercial: string;
}

interface AlertaDuplicadoProps {
  nombreProducto: string;
  productosExistentes: any[];
  onClose?: () => void;
}

export default function AlertaDuplicado({
  nombreProducto,
  productosExistentes,
  onClose
}: AlertaDuplicadoProps) {
  const [duplicados, setDuplicados] = useState<ProductoSimilar[]>([]);
  const [cargando, setCargando] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!nombreProducto || nombreProducto.length < 5) {
      setDuplicados([]);
      return;
    }

    const verificar = async () => {
      setCargando(true);
      try {
        const response = await fetch('/api/deepseek/verificar-producto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombreProducto,
            productosExistentes
          })
        });
        const data = await response.json();
        
        if (data.existe && data.productosSimilares?.length > 0) {
          setDuplicados(data.productosSimilares);
          setVisible(true);
        } else {
          setDuplicados([]);
        }
      } catch (error) {
        console.error("Error verificando duplicados:", error);
      } finally {
        setCargando(false);
      }
    };

    const timeout = setTimeout(verificar, 800); // Debounce
    return () => clearTimeout(timeout);
  }, [nombreProducto, productosExistentes]);

  if (!visible || duplicados.length === 0 || !nombreProducto) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-3 mb-4 relative">
      <button
        onClick={() => setVisible(false)}
        className="absolute top-2 right-2 text-amber-400 hover:text-amber-600"
      >
        <X size={14} />
      </button>
      
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="text-amber-500 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-bold text-amber-700 uppercase">Posible duplicado</p>
          <p className="text-[10px] text-amber-600 mt-1">
            Ya existe un producto similar:
          </p>
          <ul className="mt-1 space-y-0.5">
            {duplicados.slice(0, 2).map((p, i) => (
              <li key={i} className="text-[9px] text-amber-700">
                • {p.producto_nombre} (SKU: {p.producto_codigo_comercial})
              </li>
            ))}
          </ul>
          {duplicados.length > 2 && (
            <p className="text-[8px] text-amber-500 mt-1">
              +{duplicados.length - 2} más
            </p>
          )}
        </div>
      </div>
    </div>
  );
}