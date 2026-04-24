// app/(dashboard)/rrhh/empleados/[id]/editar/page.tsx
'use client';
import { useParams } from 'next/navigation';
import { useRrhh } from '@/app/hooks/useRrhh';
import EmpleadoForm from '@/app/components/rrhh/EmpleadoForm';
import GenerarDocumento from '@/app/components/rrhh/GenerarDocumento';
import { Loader2, FileText, FileSignature, Calendar, Award, FileCheck } from 'lucide-react';
import { useState } from 'react';

export default function EditarEmpleadoPage() {
  const { id } = useParams();
  const { empleados, actualizarEmpleado, loading } = useRrhh();
  const [mostrarDocumentos, setMostrarDocumentos] = useState(false);
  const empleado = empleados.find(e => e.id === id);

  if (!empleado && !loading) {
    return <div className="text-center py-20">Empleado no encontrado</div>;
  }

  if (!empleado) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  const handleSubmit = async (data: any) => {
    return actualizarEmpleado(id as string, data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic">
            Editar <span className="text-blue-600">Empleado</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Modifica los datos del trabajador
          </p>
        </div>
        
        {/* Botón para mostrar panel de documentos */}
        <button
          onClick={() => setMostrarDocumentos(!mostrarDocumentos)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase tracking-wide shadow-lg transition-all"
        >
          <FileText size={16} />
          {mostrarDocumentos ? 'Ocultar Documentos' : 'Generar Documentos'}
        </button>
      </div>

      {/* Panel de generación de documentos */}
      {mostrarDocumentos && (
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-2xl p-5 border border-purple-200 shadow-sm animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 mb-4">
            <FileSignature size={20} className="text-purple-600" />
            <h3 className="text-sm font-bold text-purple-800 uppercase tracking-wider">Generar Documentos Oficiales</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <GenerarDocumento 
              empleadoId={empleado.id} 
              tipo="contrato" 
              buttonVariant="outline"
              buttonText="📄 Contrato"
            />
            <GenerarDocumento 
              empleadoId={empleado.id} 
              tipo="certificado_antiguedad" 
              buttonVariant="outline"
              buttonText="🏆 Antigüedad"
            />
            <GenerarDocumento 
              empleadoId={empleado.id} 
              tipo="certificado_vacaciones" 
              buttonVariant="outline"
              buttonText="🌴 Vacaciones"
            />
            <GenerarDocumento 
              empleadoId={empleado.id} 
              tipo="certificado_remuneraciones" 
              buttonVariant="outline"
              buttonText="💰 Remuneraciones"
            />
            <GenerarDocumento 
              empleadoId={empleado.id} 
              tipo="evaluacion_desempeno" 
              buttonVariant="outline"
              buttonText="⭐ Evaluación"
            />
          </div>
          <p className="text-[9px] text-purple-500 mt-3 text-center">
            Los documentos se generan en formato PDF y se descargan automáticamente
          </p>
        </div>
      )}

      {/* Formulario de edición */}
      <EmpleadoForm empleado={empleado} onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}