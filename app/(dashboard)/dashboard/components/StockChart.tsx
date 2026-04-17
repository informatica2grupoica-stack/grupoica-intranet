"use client";
import React, { useState, useEffect } from "react";
import { PieChart, Loader2 } from "lucide-react";

export default function StockChart() {
  const [data, setData] = useState({
    conStock: 0,
    stockBajo: 0,
    sinStock: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarStock = async () => {
      try {
        const res = await fetch('/api/obuma/productos/list?limit=2000');
        const result = await res.json();
        const productos = result.data || [];
        
        const conStock = productos.filter((p: any) => p.stock_actual > 10).length;
        const stockBajo = productos.filter((p: any) => p.stock_actual > 0 && p.stock_actual <= 10).length;
        const sinStock = productos.filter((p: any) => p.stock_actual === 0 && p.inventariable).length;
        
        setData({ conStock, stockBajo, sinStock });
      } catch (error) {
        console.error("Error cargando stock:", error);
      } finally {
        setLoading(false);
      }
    };
    
    cargarStock();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-[#00338d]" />
        </div>
      </div>
    );
  }

  const total = data.conStock + data.stockBajo + data.sinStock;
  const conStockPercent = total > 0 ? (data.conStock / total) * 100 : 0;
  const stockBajoPercent = total > 0 ? (data.stockBajo / total) * 100 : 0;
  const sinStockPercent = total > 0 ? (data.sinStock / total) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <PieChart size={18} className="text-[#00338d]" />
        <h3 className="text-sm font-black uppercase text-slate-600">Estado del Stock</h3>
      </div>
      
      <div className="flex flex-col items-center">
        {/* Gráfico de dona simple */}
        <div className="relative w-40 h-40 mb-4">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            {/* Stock suficiente */}
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke="#10b981"
              strokeWidth="15"
              strokeDasharray={`${conStockPercent * 2.51} 251`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
            {/* Stock bajo */}
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="15"
              strokeDasharray={`${stockBajoPercent * 2.51} 251`}
              strokeDashoffset={-(conStockPercent * 2.51)}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
            {/* Sin stock */}
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke="#ef4444"
              strokeWidth="15"
              strokeDasharray={`${sinStockPercent * 2.51} 251`}
              strokeDashoffset={-((conStockPercent + stockBajoPercent) * 2.51)}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
            <circle cx="50" cy="50" r="25" fill="white" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-black text-slate-800">{total}</span>
          </div>
        </div>
        
        {/* Leyenda */}
        <div className="flex flex-wrap justify-center gap-4 text-[10px] font-bold">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-emerald-500 rounded-full" />
            <span>Stock suficiente: {data.conStock}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-500 rounded-full" />
            <span>Stock bajo: {data.stockBajo}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span>Sin stock: {data.sinStock}</span>
          </div>
        </div>
      </div>
    </div>
  );
}