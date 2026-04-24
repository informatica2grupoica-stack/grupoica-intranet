// components/rrhh/ExportarExcel.tsx
'use client';
import { useState } from 'react';
import { Loader2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExportarExcelProps {
  data: any[];
  filename: string;
  sheetName?: string;
  columns?: { key: string; label: string }[];
  buttonText?: string;
  buttonVariant?: 'primary' | 'secondary' | 'outline';
}

export default function ExportarExcel({ 
  data, 
  filename, 
  sheetName = 'Reporte',
  columns,
  buttonText = 'Exportar a Excel',
  buttonVariant = 'primary'
}: ExportarExcelProps) {
  const [exportando, setExportando] = useState(false);

  const getButtonColor = () => {
    switch (buttonVariant) {
      case 'primary': return 'bg-emerald-600 hover:bg-emerald-700 text-white';
      case 'secondary': return 'bg-slate-100 hover:bg-slate-200 text-slate-700';
      case 'outline': return 'border border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-white';
      default: return 'bg-emerald-600 hover:bg-emerald-700 text-white';
    }
  };

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const formatDataForExcel = () => {
    if (columns) {
      return data.map(row => {
        const newRow: any = {};
        columns.forEach(col => {
          let value = getNestedValue(row, col.key);
          if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
          }
          if (value === null || value === undefined) {
            value = '';
          }
          newRow[col.label] = value;
        });
        return newRow;
      });
    }
    return data;
  };

  const handleExport = () => {
    setExportando(true);
    try {
      const formattedData = formatDataForExcel();
      if (formattedData.length === 0) {
        alert('No hay datos para exportar');
        setExportando(false);
        return;
      }
      
      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      
      // Ajustar ancho de columnas
      const colWidths = Object.keys(formattedData[0] || {}).map(() => ({ wch: 20 }));
      ws['!cols'] = colWidths;
      
      XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Error exportando a Excel:', error);
      alert('Error al exportar los datos');
    } finally {
      setExportando(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exportando || data.length === 0}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${getButtonColor()}`}
    >
      {exportando ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <FileSpreadsheet size={16} />
      )}
      {buttonText}
    </button>
  );
}