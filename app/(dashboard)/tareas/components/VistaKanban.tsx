'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, MoreHorizontal } from 'lucide-react';

interface VistaKanbanProps {
  tareas: any[];
  onTaskUpdate: () => void;
  onTaskClick: (tarea: any) => void;
}

const columnas = [
  { id: 'pendiente', titulo: '📋 Pendiente', color: 'bg-slate-100', border: 'border-slate-200' },
  { id: 'en_proceso', titulo: '⚙️ En Proceso', color: 'bg-amber-50', border: 'border-amber-200' },
  { id: 'completada', titulo: '✅ Completada', color: 'bg-emerald-50', border: 'border-emerald-200' }
];

export default function VistaKanban({ tareas, onTaskUpdate, onTaskClick }: VistaKanbanProps) {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, nuevoEstado: string) => {
    e.preventDefault();
    if (!draggedTask) return;

    const tarea = tareas.find(t => t.id === draggedTask);
    if (!tarea || tarea.estado === nuevoEstado) return;

    const { error } = await supabase
      .from('tareas')
      .update({ estado: nuevoEstado })
      .eq('id', draggedTask);

    if (!error) {
      onTaskUpdate();
    }
    setDraggedTask(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {columnas.map((col) => (
        <div
          key={col.id}
          className={`${col.color} rounded-2xl p-4 min-h-[500px] border ${col.border}`}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, col.id)}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-slate-700 text-sm">{col.titulo}</h3>
            <span className="bg-white px-2 py-0.5 rounded-full text-[9px] font-bold text-slate-500">
              {tareas.filter(t => t.estado === col.id).length}
            </span>
          </div>

          <div className="space-y-2">
            {tareas
              .filter(t => t.estado === col.id)
              .map((tarea) => (
                <div
                  key={tarea.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, tarea.id)}
                  onClick={() => onTaskClick(tarea)}
                  className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-slate-700 line-clamp-2">{tarea.titulo}</p>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal size={14} className="text-slate-400" />
                    </button>
                  </div>
                  {tarea.fecha_limite && (
                    <p className="text-[8px] text-slate-400 mt-2 flex items-center gap-1">
                      📅 {new Date(tarea.fecha_limite).toLocaleDateString('es-CL')}
                    </p>
                  )}
                  <div className="flex justify-between items-center mt-2">
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                      tarea.prioridad === 'alta' ? 'bg-red-100 text-red-600' :
                      tarea.prioridad === 'media' ? 'bg-amber-100 text-amber-600' :
                      'bg-emerald-100 text-emerald-600'
                    }`}>
                      {tarea.prioridad}
                    </span>
                    <span className="text-[8px] text-slate-400">
                      {tarea.responsable?.nombre}
                    </span>
                  </div>
                </div>
              ))}
            
            <button
              className="w-full mt-2 p-2 border border-dashed border-slate-200 rounded-xl text-[9px] font-bold text-slate-400 hover:bg-white hover:border-blue-300 transition-all flex items-center justify-center gap-1"
            >
              <Plus size={12} /> Nueva tarea
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}