// app/(dashboard)/rrhh/asistencias/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRrhh } from '@/app/hooks/useRrhh';
import { useAsistencias } from '@/app/hooks/useAsistencias';
import { Loader2, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';
import CalendarioAsistencias from '@/app/components/rrhh/CalendarioAsistencias';
import ResumenAsistenciaMes from '@/app/components/rrhh/ResumenAsistenciaMes';
import RegistroAsistencia from '@/app/components/rrhh/RegistroAsistencia';

export default function AsistenciasPage() {
  const { empleados, loading: loadingEmpleados } = useRrhh();
  const {
    asistencias,
    loading,
    resumen,
    filtros,
    setFiltros,
    registrarAsistencia,
    actualizarAsistencia,
    cargarResumen,
  } = useAsistencias();

  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);

  const empleadoActual = empleados.find(e => e.id === filtros.empleadoId);
  
  // ✅ Encontrar asistencia existente para la fecha seleccionada
  const asistenciaEnFecha = asistencias.find(a => a.fecha === fechaSeleccionada);

  const handleDayClick = (fecha: string) => {
    setFechaSeleccionada(fecha);
    setMostrarModal(true);
  };

  const handleGuardarAsistencia = async (data: any) => {
    if (asistenciaEnFecha) {
      return await actualizarAsistencia(asistenciaEnFecha.id, data);
    } else {
      return await registrarAsistencia(data);
    }
  };

  const handleCambiarMes = (mes: number, anio: number) => {
    setFiltros({ ...filtros, mes, anio });
  };

  // ✅ RESETEAR MODAL cuando cambia el empleado
  useEffect(() => {
    setMostrarModal(false);
    setFechaSeleccionada(null);
  }, [filtros.empleadoId]);

  if (loadingEmpleados) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic">
            Gestión de <span className="text-blue-600">Asistencias</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Registro diario de entrada y salida
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => cargarResumen()}
            className="p-2.5 text-slate-500 hover:text-blue-600 transition-colors rounded-xl hover:bg-slate-100"
            title="Actualizar"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Selector de empleado */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200">
        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-2">
          Seleccionar Empleado
        </label>
        <select
          value={filtros.empleadoId}
          onChange={(e) => {
            // ✅ Limpiar selección de fecha y modal al cambiar empleado
            setFechaSeleccionada(null);
            setMostrarModal(false);
            setFiltros({ ...filtros, empleadoId: e.target.value });
          }}
          className="w-full md:w-96 bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Seleccione un empleado --</option>
          {empleados.filter(e => e.activo).map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.nombre_completo} - {emp.cargo || 'Sin cargo'}</option>
          ))}
        </select>
      </div>

      {/* Contenido solo si hay empleado seleccionado */}
      {!filtros.empleadoId ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <CalendarIcon size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Selecciona un empleado para ver sus asistencias</p>
        </div>
      ) : (
        <>
          {/* Resumen del mes */}
          <ResumenAsistenciaMes
            resumen={resumen}
            empleadoNombre={empleadoActual?.nombre_completo}
          />

          {/* Calendario */}
          <CalendarioAsistencias
            asistencias={asistencias}
            onDayClick={handleDayClick}
            mesActual={filtros.mes}
            anioActual={filtros.anio}
            onChangeMes={handleCambiarMes}
          />

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          )}

          {/* Modal de registro */}
          {mostrarModal && fechaSeleccionada && (
            <RegistroAsistencia
              empleadoId={filtros.empleadoId}
              empleadoNombre={empleadoActual?.nombre_completo || ''}
              fecha={fechaSeleccionada}
              asistenciaExistente={asistenciaEnFecha}
              onSave={handleGuardarAsistencia}
              onClose={() => setMostrarModal(false)}
            />
          )}
        </>
      )}
    </div>
  );
}