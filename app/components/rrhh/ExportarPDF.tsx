// components/rrhh/ExportarPDF.tsx
'use client';
import { useRef, useState } from 'react';
import { Download, Loader2, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ExportarPDFProps {
  contentRef: React.RefObject<HTMLDivElement | null>;
  filename: string;
  title?: string;
  buttonText?: string;
  buttonVariant?: 'primary' | 'secondary' | 'outline';
}

export default function ExportarPDF({ 
  contentRef, 
  filename, 
  title,
  buttonText = 'Exportar a PDF',
  buttonVariant = 'primary'
}: ExportarPDFProps) {
  const [exportando, setExportando] = useState(false);

  const getButtonColor = () => {
    switch (buttonVariant) {
      case 'primary': return 'bg-red-600 hover:bg-red-700 text-white';
      case 'secondary': return 'bg-slate-100 hover:bg-slate-200 text-slate-700';
      case 'outline': return 'border border-red-600 text-red-700 hover:bg-red-50 bg-white';
      default: return 'bg-red-600 hover:bg-red-700 text-white';
    }
  };

  const handleExport = async () => {
    if (!contentRef.current) {
      alert('No hay contenido para exportar');
      return;
    }
    
    setExportando(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.setFontSize(16);
      if (title) {
        pdf.text(title, 105, 15, { align: 'center' });
      }
      
      pdf.addImage(imgData, 'PNG', 10, title ? 25 : 10, imgWidth, imgHeight);
      pdf.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exportando a PDF:', error);
      alert('Error al exportar el PDF');
    } finally {
      setExportando(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exportando}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${getButtonColor()}`}
    >
      {exportando ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <FileText size={16} />
      )}
      {buttonText}
    </button>
  );
}