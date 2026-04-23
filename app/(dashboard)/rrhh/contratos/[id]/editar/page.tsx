// app/(dashboard)/rrhh/contratos/[id]/editar/page.tsx
'use client';
import { useParams } from 'next/navigation';
import { useContratos } from '@/app/hooks/useContratos';
import FormularioContrato from '@/app/components/rrhh/FormularioContrato';
import { Loader2 } from 'lucide-react';

export default function EditarContratoPage() {
  const { id } = useParams();
  const { contratos, actualizarContrato, loading } = useContratos();
  const contrato = contratos.find(c => c.id === id);

  if (loading && !contrato) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (!contrato) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Contrato no encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 uppercase italic">
          Editar <span className="text-blue-600">Contrato</span>
        </h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
          Modificar información del contrato
        </p>
      </div>

      <FormularioContrato
        contrato={contrato}
        onSubmit={(data) => actualizarContrato(id as string, data)}
        loading={loading}
      />
    </div>
  );
}