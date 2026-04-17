"use client";
import React, { useState, useEffect } from "react";
import { Zap, Loader2, Lightbulb, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

interface InsightsIAProps {
  stats?: {
    total_productos: number;
    total_stock: number;
    total_valor_inventario: number;
    productos_con_stock_bajo: number;
    productos_sin_stock: number;
    precio_promedio: number;
  };
}

export default function InsightsIA({ stats }: InsightsIAProps) {
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomendaciones, setRecomendaciones] = useState<string[]>([]);

  useEffect(() => {
    const generarInsights = async () => {
      if (!stats) return;
      
      setLoading(true);
      try {
        const res = await fetch('/api/dashboard/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stats })
        });
        const data = await res.json();
        
        if (data.insights) {
          setInsights(data.insights.slice(0, 3));
        }
        
        if (data.recomendaciones) {
          setRecomendaciones(data.recomendaciones.slice(0, 2));
        }
      } catch (error) {
        console.error("Error generando insights:", error);
        // Insights por defecto si falla la IA
        setInsights([
          `📊 Tienes ${stats.total_productos} productos en inventario`,
          `💰 Valor total del inventario: $${stats.total_valor_inventario.toLocaleString('es-CL')}`,
          `⚠️ ${stats.productos_sin_stock} productos sin stock requieren atención`
        ]);
        setRecomendaciones([
          "Revisa los productos con stock bajo para evitar rotura de inventario",
          "Considera sincronizar regularmente con Obuma para datos actualizados"
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    generarInsights();
  }, [stats]);

  if (loading || !stats) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-purple-500" />
          <h3 className="text-sm font-black uppercase text-slate-600">Insights IA</h3>
        </div>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="animate-spin text-[#00338d]" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={18} className="text-purple-500" />
        <h3 className="text-sm font-black uppercase text-slate-600">Insights IA</h3>
      </div>
      
      {/* Insights */}
      <div className="space-y-3 mb-4">
        <p className="text-[9px] font-bold uppercase text-slate-400">Análisis inteligente</p>
        {insights.map((insight, idx) => (
          <div key={idx} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
            <Lightbulb size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-slate-600">{insight}</p>
          </div>
        ))}
      </div>
      
      {/* Recomendaciones */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        <p className="text-[9px] font-bold uppercase text-slate-400">Recomendaciones</p>
        {recomendaciones.map((recom, idx) => (
          <div key={idx} className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
            <CheckCircle size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-slate-600">{recom}</p>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-[8px] text-slate-400">
          🤖 Análisis generado por IA basado en tus datos actuales
        </p>
      </div>
    </div>
  );
}