// app/(dashboard)/rrhh/empleados/[id]/editar/page.tsx
'use client';
import { useParams } from 'next/navigation';
import { useRrhh } from '@/app/hooks/useRrhh';
import EmpleadoForm from '@/app/components/rrhh/EmpleadoForm';
import { Loader2 } from 'lucide-react';

export default function EditarEmpleadoPage() {
  const { id } = useParams();
  const { empleados, actualizarEmpleado, loading } = useRrhh();
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
      <div>
        <h1 className="text-2xl font-black text-slate-800 uppercase italic">
          Editar <span className="text-blue-600">Empleado</span>
        </h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
          Modifica los datos del trabajador
        </p>
      </div>

      <EmpleadoForm empleado={empleado} onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}