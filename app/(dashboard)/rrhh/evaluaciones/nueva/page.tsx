// app/(dashboard)/rrhh/evaluaciones/nueva/page.tsx
'use client';
import { useRrhh } from '@/app/hooks/useRrhh';
import { useEvaluaciones } from '@/app/hooks/useEvaluaciones';
import { useAuth } from '@/app/hooks/useAuth';
import FormularioEvaluacion from '@/app/components/rrhh/FormularioEvaluacion';
import { Loader2 } from 'lucide-react';

export default function NuevaEvaluacionPage() {
  const { empleados, loading: loadingEmpleados } = useRrhh();
  const { crearEvaluacion, loading } = useEvaluaciones();
  const { perfil } = useAuth();

  if (loadingEmpleados) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 uppercase italic">
          Nueva <span className="text-blue-600">Evaluación</span>
        </h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
          Registrar evaluación de desempeño
        </p>
      </div>

      <FormularioEvaluacion
        empleados={empleados}
        perfilUsuario={perfil}
        onSubmit={crearEvaluacion}
        loading={loading}
      />
    </div>
  );
}