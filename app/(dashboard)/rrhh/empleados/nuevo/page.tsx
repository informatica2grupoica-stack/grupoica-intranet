// app/(dashboard)/rrhh/empleados/nuevo/page.tsx
'use client';
import { useRrhh } from '@/app/hooks/useRrhh';
import EmpleadoForm from '@/app/components/rrhh/EmpleadoForm';

export default function NuevoEmpleadoPage() {
  const { crearEmpleado, loading } = useRrhh();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 uppercase italic">
          Nuevo <span className="text-blue-600">Empleado</span>
        </h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
          Ingresa los datos del nuevo trabajador
        </p>
      </div>

      <EmpleadoForm onSubmit={crearEmpleado} loading={loading} />
    </div>
  );
}