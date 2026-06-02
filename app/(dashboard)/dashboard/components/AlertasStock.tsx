"use client";
import React, { useState, useEffect } from "react";
import { AlertTriangle, Package, Loader2 } from "lucide-react";
import Link from "next/link";

interface ProductoAlerta {
  id: string;
  nombre: string;
  sku: string;
  stock_actual: number;
  stock_minimo: number;
}

export default function AlertasStock() {
  const [productos, setProductos] = useState<ProductoAlerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarAlertas = async () => {
      try {
        const res = await fetch('/api/obuma/productos/list?limit=500');
        const result = await res.json();
        const productosData = result.data || [];
        
        // Filtrar productos con stock bajo o sin stock
        const alertas = productosData.filter((p: any) => 
          (p.stock_actual === 0 && p.inventariable) || 
          (p.stock_actual > 0 && p.stock_actual <= (p.stock_minimo || 5))
        ).slice(0, 10);
        
        setProductos(alertas);
      } catch (error) {
        console.error("Error cargando alertas:", error);
      } finally {
        setLoading(false);
      }
    };
    
    cargarAlertas();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-[#059669]" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-lg bg-amber-100 text-[#F59E0B] flex items-center justify-center"><AlertTriangle size={17} /></span>
        <h3 className="text-sm font-black uppercase text-slate-600">Alertas de Stock</h3>
      </div>

      {productos.length === 0 ? (
        <div className="text-center py-8">
          <Package size={32} className="mx-auto text-[#22C55E] mb-2" />
          <p className="text-xs text-slate-500">¡Todo en orden! No hay alertas de stock.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {productos.map((prod) => (
            <div
              key={prod.id}
              className={`p-3 rounded-xl border-l-4 ${
                prod.stock_actual === 0
                  ? 'bg-rose-50 border-[#EF4444]'
                  : 'bg-amber-50 border-[#F59E0B]'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-700 uppercase">{prod.nombre}</p>
                  <p className="text-[9px] font-mono text-slate-500 mt-0.5">SKU: {prod.sku}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-black ${
                    prod.stock_actual === 0 ? 'text-[#EF4444]' : 'text-[#F59E0B]'
                  }`}>
                    Stock: {prod.stock_actual}
                  </p>
                  {prod.stock_minimo > 0 && (
                    <p className="text-[8px] text-slate-400">Mínimo: {prod.stock_minimo}</p>
                  )}
                </div>
              </div>
              <Link
                href={`/obuma-productos?search=${prod.sku}`}
                className="inline-block mt-2 text-[8px] font-bold uppercase text-[#059669] hover:text-[#047857] transition-colors"
              >
                Ver producto →
              </Link>
            </div>
          ))}
        </div>
      )}
      
      {productos.length > 0 && (
        <Link
          href="/obuma-productos?stock=bajo"
          className="block text-center mt-4 text-[9px] font-bold uppercase text-[#059669] hover:text-[#047857] transition-colors"
        >
          Ver todos los productos con alerta
        </Link>
      )}
    </div>
  );
}