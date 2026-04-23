// app/(dashboard)/rrhh/contratos/nuevo/page.tsx
'use client';
import { useRrhh } from '@/app/hooks/useRrhh';
import { useContratos } from '@/app/hooks/useContratos';
import FormularioContrato from '@/app/components/rrhh/FormularioContrato';
import { Loader2 } from 'lucide-react';

export default function NuevoContratoPage() {
  const { empleados, loading: loadingEmpleados } = useRrhh();
  const { crearContrato, loading } = useContratos();

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
          Nuevo <span className="text-blue-600">Contrato</span>
        </h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
          Registrar nuevo contrato laboral
        </p>
      </div>

      <FormularioContrato
        empleados={empleados}
        onSubmit={crearContrato}
        loading={loading}
      />
    </div>
  );
}