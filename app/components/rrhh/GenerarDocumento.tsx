// components/rrhh/GenerarDocumento.tsx
'use client';
import { useState } from 'react';
import { FileText, Loader2, FileCheck, FileSignature, Award, Calendar } from 'lucide-react';
import ContratoTrabajoHTML from './pdf/ContratoTrabajoHTML';

type TipoDocumento = 
  | 'contrato'
  | 'certificado_vacaciones'
  | 'certificado_remuneraciones'
  | 'certificado_antiguedad'
  | 'evaluacion_desempeno'
  | 'carta_termino';

interface GenerarDocumentoProps {
  empleadoId: string;
  tipo: TipoDocumento;
  contratoId?: string;
  evaluacionId?: string;
  buttonText?: string;
  buttonVariant?: 'primary' | 'secondary' | 'outline';
  onSuccess?: () => void;
}

export default function GenerarDocumento({ 
  empleadoId, 
  tipo, 
  contratoId,
  evaluacionId,
  buttonText,
  buttonVariant = 'primary',
  onSuccess 
}: GenerarDocumentoProps) {
  const [generando, setGenerando] = useState(false);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [datosDocumento, setDatosDocumento] = useState<any>(null);

  const getIcon = () => {
    switch (tipo) {
      case 'contrato': return <FileSignature size={14} />;
      case 'certificado_antiguedad': return <Award size={14} />;
      case 'certificado_vacaciones': return <Calendar size={14} />;
      case 'certificado_remuneraciones': return <FileText size={14} />;
      case 'evaluacion_desempeno': return <FileCheck size={14} />;
      default: return <FileText size={14} />;
    }
  };

  const getButtonColor = () => {
    switch (buttonVariant) {
      case 'primary': return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'secondary': return 'bg-slate-100 hover:bg-slate-200 text-slate-700';
      case 'outline': return 'border border-purple-600 text-purple-700 hover:bg-purple-50 bg-white';
      default: return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };

  const getLabel = () => {
    const labels: Record<TipoDocumento, string> = {
      contrato: 'Contrato',
      certificado_vacaciones: 'Vacaciones',
      certificado_remuneraciones: 'Remuneraciones',
      certificado_antiguedad: 'Antigüedad',
      evaluacion_desempeno: 'Evaluación',
      carta_termino: 'Carta Término',
    };
    return buttonText || labels[tipo];
  };

  const handleGenerar = async () => {
    setGenerando(true);
    try {
      const body: any = { empleadoId };
      if (contratoId) body.contratoId = contratoId;
      if (evaluacionId) body.evaluacionId = evaluacionId;

      const response = await fetch(`/api/rrhh/documentos/${tipo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        const result = await response.json();
        setDatosDocumento(result.data);
        setMostrarPreview(true);
        onSuccess?.();
      } else {
        const error = await response.json();
        console.error('Error:', error);
        alert('Error al generar el documento: ' + (error.error || 'Intente nuevamente'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al generar el documento');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <>
      <button
        onClick={handleGenerar}
        disabled={generando}
        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${getButtonColor()}`}
      >
        {generando ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          getIcon()
        )}
        {getLabel()}
      </button>

      {/* Preview del documento */}
      {mostrarPreview && datosDocumento && tipo === 'contrato' && (
        <ContratoTrabajoHTML
          empleado={datosDocumento.empleado}
          contrato={datosDocumento.contrato}
          empresa={datosDocumento.empresa}
          onClose={() => setMostrarPreview(false)}
        />
      )}
    </>
  );
}