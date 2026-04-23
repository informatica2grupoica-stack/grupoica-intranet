// components/rrhh/ContratoCard.tsx
'use client';
import { FileText, Calendar, DollarSign, Briefcase, CheckCircle, XCircle, Download, Trash2, Edit3 } from 'lucide-react';
import Link from 'next/link';

interface ContratoCardProps {
  contrato: any;
  onDelete?: (id: string) => void;
  onDownload?: (contrato: any) => void;
}

export default function ContratoCard({ contrato, onDelete, onDownload }: ContratoCardProps) {
  const getTipoLabel = (tipo: string) => {
    const tipos: Record<string, string> = {
      indefinido: 'Indefinido',
      plazo_fijo: 'Plazo Fijo',
      honorarios: 'Honorarios',
      practica: 'Práctica',
      temporal: 'Temporal',
    };
    return tipos[tipo] || tipo;
  };

  const getJornadaLabel = (jornada: string) => {
    const jornadas: Record<string, string> = {
      completa: 'Completa (45 hrs)',
      parcial: 'Parcial',
      turnos: 'Turnos',
      por_horas: 'Por Horas',
    };
    return jornadas[jornada] || jornada;
  };

  const formatFecha = (fecha: string) => {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  const formatSueldo = (sueldo: number) => {
    if (!sueldo) return '—';
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(sueldo);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:shadow-lg transition-all overflow-hidden">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">{contrato.numero_contrato}</h3>
              <p className="text-[10px] text-slate-400">{contrato.empleado?.nombre_completo}</p>
            </div>
          </div>
          {contrato.vigente ? (
            <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-600 flex items-center gap-1">
              <CheckCircle size={10} /> Vigente
            </span>
          ) : (
            <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1">
              <XCircle size={10} /> Histórico
            </span>
          )}
        </div>

        {/* Detalles */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Briefcase size={14} className="text-slate-400" />
            <span>{contrato.cargo || '—'}</span>
            {contrato.area && <span className="text-slate-400">• {contrato.area}</span>}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <FileText size={14} className="text-slate-400" />
            <span>{getTipoLabel(contrato.tipo_contrato)}</span>
            <span className="text-slate-400">•</span>
            <span>{getJornadaLabel(contrato.jornada)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <DollarSign size={14} className="text-slate-400" />
            <span className="font-medium">{formatSueldo(contrato.sueldo_base)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar size={14} className="text-slate-400" />
            <span>{formatFecha(contrato.fecha_inicio)}</span>
            {contrato.fecha_fin && (
              <>
                <span className="text-slate-400">→</span>
                <span>{formatFecha(contrato.fecha_fin)}</span>
              </>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          {onDownload && (
            <button
              onClick={() => onDownload(contrato)}
              className="p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
              title="Descargar PDF"
            >
              <Download size={16} />
            </button>
          )}
          <Link
            href={`/rrhh/contratos/${contrato.id}/editar`}
            className="p-2 text-slate-400 hover:text-amber-600 transition-colors rounded-lg hover:bg-amber-50"
          >
            <Edit3 size={16} />
          </Link>
          {onDelete && (
            <button
              onClick={() => onDelete(contrato.id)}
              className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}