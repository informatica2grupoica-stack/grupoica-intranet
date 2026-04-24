// components/rrhh/pdf/ContratoTrabajoHTML.tsx
'use client';
import { useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ContratoTrabajoHTMLProps {
  empleado: any;
  contrato: any;
  empresa: {
    nombre: string;
    rut: string;
    direccion: string;
  };
  onClose?: () => void;
}

export default function ContratoTrabajoHTML({ empleado, contrato, empresa, onClose }: ContratoTrabajoHTMLProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const formatSueldo = (sueldo: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(sueldo);
  };

  const formatFecha = (fecha: string) => {
    if (!fecha) return '___';
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  const getTipoContrato = (tipo: string) => {
    const tipos: Record<string, string> = {
      indefinido: 'plazo indefinido',
      plazo_fijo: 'plazo fijo',
      honorarios: 'a honorarios',
      practica: 'de práctica profesional',
      temporal: 'temporal',
    };
    return tipos[tipo] || tipo;
  };

  const generarPDF = async () => {
    if (!contentRef.current) return;
    
    const canvas = await html2canvas(contentRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`contrato_${empleado.rut}_${Date.now()}.pdf`);
    
    if (onClose) onClose();
  };

  const hoy = new Date().toLocaleDateString('es-CL');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header con botones */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Vista previa del Contrato</h2>
          <div className="flex gap-2">
            <button
              onClick={generarPDF}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              📄 Descargar PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-300 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Contenido del contrato */}
        <div className="overflow-y-auto p-6" ref={contentRef}>
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8 border-b pb-4">
              <h1 className="text-2xl font-bold uppercase">CONTRATO DE TRABAJO</h1>
              <p className="text-sm text-gray-500">Código: {contrato.numero_contrato || '___'}</p>
              <p className="text-sm text-gray-500">Fecha: {hoy}</p>
            </div>

            {/* Identificación de las partes */}
            <div className="mb-6">
              <h2 className="text-lg font-bold bg-gray-100 p-2 mb-3">I. IDENTIFICACIÓN DE LAS PARTES</h2>
              <div className="space-y-2">
                <p><strong>Empleador:</strong> {empresa.nombre}</p>
                <p><strong>RUT Empleador:</strong> {empresa.rut}</p>
                <p><strong>Domicilio:</strong> {empresa.direccion}</p>
                <p><strong>Trabajador:</strong> {empleado.nombre_completo}</p>
                <p><strong>RUT Trabajador:</strong> {empleado.rut}</p>
                <p><strong>Nacionalidad:</strong> {empleado.nacionalidad || 'Chilena'}</p>
                <p><strong>Domicilio:</strong> {empleado.direccion || '___'}</p>
              </div>
            </div>

            {/* Cláusulas */}
            <div className="mb-6">
              <h2 className="text-lg font-bold bg-gray-100 p-2 mb-3">II. CLÁUSULAS</h2>
              
              <div className="space-y-4">
                <p>
                  <strong>PRIMERA:</strong> El empleador contrata los servicios del trabajador para desempeñar el cargo de{' '}
                  <strong>{contrato.cargo || empleado.cargo || '___'}</strong>, en el área de{' '}
                  <strong>{contrato.area || empleado.area || '___'}</strong>.
                </p>

                <p>
                  <strong>SEGUNDA:</strong> La jornada de trabajo será de{' '}
                  <strong>{contrato.jornada || empleado.jornada || 'completa'}</strong>, cumpliendo un total de 45 horas semanales.
                </p>

                <p>
                  <strong>TERCERA:</strong> El trabajador percibirá una remuneración mensual de{' '}
                  <strong>{formatSueldo(contrato.sueldo_base || empleado.sueldo_base || 0)}</strong>.
                </p>

                <p>
                  <strong>CUARTA:</strong> El presente contrato es a{' '}
                  <strong>{getTipoContrato(contrato.tipo_contrato || empleado.tipo_contrato || 'indefinido')}</strong>.
                </p>

                <p>
                  <strong>QUINTA:</strong> La fecha de inicio de labores es el{' '}
                  <strong>{formatFecha(contrato.fecha_inicio || empleado.fecha_ingreso)}</strong>.
                  {contrato.fecha_fin && ` La fecha de término será el ${formatFecha(contrato.fecha_fin)}.`}
                </p>

                <p>
                  <strong>SEXTA:</strong> El trabajador tendrá derecho a 15 días hábiles de vacaciones por año calendario.
                </p>

                <p>
                  <strong>SÉPTIMA:</strong> Las partes se someten a la legislación laboral chilena.
                </p>
              </div>
            </div>

            {/* Firmas */}
            <div className="flex justify-between mt-12 pt-8">
              <div className="text-center w-1/2">
                <div className="border-t border-black pt-2 mx-auto w-3/4" />
                <p>Empleador</p>
                <p className="text-sm text-gray-500">{empresa.nombre}</p>
              </div>
              <div className="text-center w-1/2">
                <div className="border-t border-black pt-2 mx-auto w-3/4" />
                <p>Trabajador</p>
                <p className="text-sm text-gray-500">{empleado.nombre_completo}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-400 mt-12 pt-4 border-t">
              <p>Documento generado electrónicamente. Sin validez sin firmas originales.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}