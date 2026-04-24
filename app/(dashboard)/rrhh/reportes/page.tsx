// app/(dashboard)/rrhh/reportes/page.tsx
'use client';
import { useState, useRef } from 'react';
import { useRrhh } from '@/app/hooks/useRrhh';
import { Loader2, Calendar, Users, TrendingUp, Clock } from 'lucide-react';
import ExportarExcel from '@/app/components/rrhh/ExportarExcel';
import ExportarPDF from '@/app/components/rrhh/ExportarPDF';

type TipoReporte = 'asistencias' | 'empleados' | 'permisos' | 'contratos';

export default function ReportesPage() {
  const { empleados } = useRrhh();
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<TipoReporte>('asistencias');
  const [reporteData, setReporteData] = useState<any>(null);
  const [filtros, setFiltros] = useState({
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear(),
    empleadoId: '',
  });
  
  const reporteRef = useRef<HTMLDivElement>(null);

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const tiposReporte = [
    { value: 'asistencias', label: 'Reporte de Asistencias', icon: Calendar, description: 'Resumen mensual de asistencias por empleado' },
    { value: 'empleados', label: 'Reporte de Empleados', icon: Users, description: 'Listado completo de empleados' },
    { value: 'permisos', label: 'Reporte de Permisos', icon: Clock, description: 'Solicitudes de permisos y vacaciones' },
    { value: 'contratos', label: 'Reporte de Contratos', icon: TrendingUp, description: 'Historial de contratos' },
  ];

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const generarReporte = async () => {
    setLoading(true);
    try {
      let url = '';
      switch (tipo) {
        case 'asistencias':
          url = `/api/rrhh/reportes/asistencias?mes=${filtros.mes}&anio=${filtros.anio}&empleadoId=${filtros.empleadoId}`;
          break;
        case 'empleados':
          url = `/api/rrhh/empleados?page=1&limit=1000`;
          break;
        case 'permisos':
          url = `/api/rrhh/permisos?page=1&limit=1000`;
          break;
        case 'contratos':
          url = `/api/rrhh/contratos?page=1&limit=1000`;
          break;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (response.ok) {
        setReporteData(result);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error generando reporte:', error);
      alert('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const getColumnasExportacion = () => {
    switch (tipo) {
      case 'asistencias':
        return [
          { key: 'fecha', label: 'Fecha' },
          { key: 'empleado.nombre_completo', label: 'Empleado' },
          { key: 'estado', label: 'Estado' },
          { key: 'hora_entrada', label: 'Hora Entrada' },
          { key: 'hora_salida', label: 'Hora Salida' },
          { key: 'horas_trabajadas', label: 'Horas Trabajadas' },
          { key: 'horas_extras', label: 'Horas Extras' },
        ];
      case 'empleados':
        return [
          { key: 'nombre_completo', label: 'Nombre Completo' },
          { key: 'rut', label: 'RUT' },
          { key: 'cargo', label: 'Cargo' },
          { key: 'area', label: 'Área' },
          { key: 'email_corporativo', label: 'Email' },
          { key: 'telefono', label: 'Teléfono' },
          { key: 'estado', label: 'Estado' },
          { key: 'fecha_ingreso', label: 'Fecha Ingreso' },
        ];
      case 'permisos':
        return [
          { key: 'empleado.nombre_completo', label: 'Empleado' },
          { key: 'tipo', label: 'Tipo' },
          { key: 'fecha_inicio', label: 'Fecha Inicio' },
          { key: 'fecha_fin', label: 'Fecha Fin' },
          { key: 'dias_solicitados', label: 'Días' },
          { key: 'estado', label: 'Estado' },
        ];
      case 'contratos':
        return [
          { key: 'empleado.nombre_completo', label: 'Empleado' },
          { key: 'numero_contrato', label: 'N° Contrato' },
          { key: 'tipo_contrato', label: 'Tipo' },
          { key: 'fecha_inicio', label: 'Fecha Inicio' },
          { key: 'fecha_fin', label: 'Fecha Fin' },
          { key: 'sueldo_base', label: 'Sueldo Base' },
          { key: 'vigente', label: 'Vigente' },
        ];
      default:
        return [];
    }
  };

  const getDatosExportacion = () => {
    if (!reporteData) return [];
    
    switch (tipo) {
      case 'asistencias':
        return reporteData.data || [];
      case 'empleados':
        return reporteData.data || [];
      case 'permisos':
        return reporteData.data || [];
      case 'contratos':
        return reporteData.data || [];
      default:
        return [];
    }
  };

  const tipoActual = tiposReporte.find(t => t.value === tipo);
  const Icon = tipoActual?.icon || Calendar;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic">
            Reportes <span className="text-blue-600">RRHH</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Exportación de datos y análisis
          </p>
        </div>
      </div>

      {/* Selección de tipo de reporte */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiposReporte.map((t) => (
          <button
            key={t.value}
            onClick={() => setTipo(t.value as TipoReporte)}
            className={`p-4 rounded-2xl text-left transition-all ${
              tipo === t.value
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:shadow-md'
            }`}
          >
            <t.icon size={24} className={`mb-2 ${tipo === t.value ? 'text-white' : 'text-blue-500'}`} />
            <p className="text-sm font-bold">{t.label}</p>
            <p className={`text-[10px] mt-1 ${tipo === t.value ? 'text-blue-100' : 'text-slate-400'}`}>
              {t.description}
            </p>
          </button>
        ))}
      </div>

      {/* Filtros (solo para asistencias) */}
      {tipo === 'asistencias' && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-wrap items-center gap-3">
          <select
            value={filtros.mes}
            onChange={(e) => setFiltros({ ...filtros, mes: parseInt(e.target.value) })}
            className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm"
          >
            {meses.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>
          
          <input
            type="number"
            value={filtros.anio}
            onChange={(e) => setFiltros({ ...filtros, anio: parseInt(e.target.value) })}
            className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm w-24"
            placeholder="Año"
          />
          
          <select
            value={filtros.empleadoId}
            onChange={(e) => setFiltros({ ...filtros, empleadoId: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm flex-1"
          >
            <option value="">Todos los empleados</option>
            {empleados.filter(e => e.activo).map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.nombre_completo}</option>
            ))}
          </select>

          <button
            onClick={generarReporte}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Generar Reporte
          </button>
        </div>
      )}

      {/* Botón para generar reportes de empleados/permisos/contratos */}
      {tipo !== 'asistencias' && (
        <div className="flex justify-end">
          <button
            onClick={generarReporte}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Generar Reporte
          </button>
        </div>
      )}

      {/* Resultado del reporte */}
      {reporteData && !loading && (
        <div className="space-y-4" ref={reporteRef}>
          {/* Resumen (solo para asistencias) */}
          {tipo === 'asistencias' && reporteData.resumen && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-200">
                <p className="text-[9px] font-black uppercase text-slate-400">Total Días</p>
                <p className="text-2xl font-black text-slate-800">{reporteData.resumen.total_dias}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200">
                <p className="text-[9px] font-black uppercase text-slate-400">Presente</p>
                <p className="text-2xl font-black text-emerald-600">{reporteData.resumen.dias_presente}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200">
                <p className="text-[9px] font-black uppercase text-slate-400">Horas Trabajadas</p>
                <p className="text-2xl font-black text-blue-600">{reporteData.resumen.total_horas} hrs</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200">
                <p className="text-[9px] font-black uppercase text-slate-400">Horas Extras</p>
                <p className="text-2xl font-black text-amber-600">{reporteData.resumen.total_horas_extras} hrs</p>
              </div>
            </div>
          )}

          {/* Tabla de datos */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {getColumnasExportacion().map((col) => (
                      <th key={col.key} className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getDatosExportacion().slice(0, 100).map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      {getColumnasExportacion().map((col) => {
                        let value = getNestedValue(item, col.key);
                        if (value === null || value === undefined) value = '—';
                        if (col.key === 'sueldo_base' && value) {
                          value = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
                        }
                        if (col.key === 'vigente') {
                          value = value ? 'Sí' : 'No';
                        }
                        if (col.key === 'horas_trabajadas' || col.key === 'horas_extras') {
                          value = value ? `${value} hrs` : '—';
                        }
                        return (
                          <td key={col.key} className="px-4 py-3 text-xs text-slate-600">
                            {value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botones de exportación */}
          <div className="flex justify-end gap-3">
            <ExportarExcel
              data={getDatosExportacion()}
              filename={`${tipo}_reporte`}
              sheetName={tipoActual?.label}
              columns={getColumnasExportacion()}
              buttonVariant="outline"
            />
            <ExportarPDF
              contentRef={reporteRef}
              filename={`${tipo}_reporte`}
              title={tipoActual?.label}
            />
          </div>

          {/* Info de paginación */}
          <p className="text-[10px] text-slate-400 text-center">
            Mostrando {Math.min(getDatosExportacion().length, 100)} de {getDatosExportacion().length} registros
          </p>
        </div>
      )}

      {/* Estado inicial */}
      {!reporteData && !loading && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Icon size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Selecciona un tipo de reporte y genera los datos</p>
          <p className="text-slate-400 text-sm mt-1">
            {tipo === 'asistencias' 
              ? 'Ajusta los filtros y haz clic en "Generar Reporte"' 
              : 'Haz clic en "Generar Reporte" para obtener los datos'}
          </p>
        </div>
      )}
    </div>
  );
}