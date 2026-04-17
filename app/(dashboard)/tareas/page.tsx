'use client';
import { useState } from 'react';
import { LayoutList, KanbanSquare, GanttChartSquare } from 'lucide-react';
import { useTareas } from './hooks/useTareas';
import MetricasTareas from './components/MetricasTareas';
import VistaTabla from './components/VistaTabla';
import VistaGantt from './components/VistaGantt';
import VistaKanban from './components/VistaKanban';
import FormularioTarea from './components/FormularioTarea';

type Vista = 'tabla' | 'gantt' | 'kanban';

export default function TareasPage() {
  const [vista, setVista] = useState<Vista>('tabla');
  const [tareaExpandida, setTareaExpandida] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const { tareas, usuarios, perfilUsuario, loading, estadisticas, fetchTareas } = useTareas();

  const puedeCrear = perfilUsuario?.rol === 'admin' || perfilUsuario?.rol === 'superuser';

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase italic">
            Gestión de <span className="text-blue-600">Tareas</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">
            Organiza, asigna y da seguimiento
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setVista('tabla')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 ${
              vista === 'tabla' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            <LayoutList size={14} /> Tabla
          </button>
          <button
            onClick={() => setVista('gantt')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 ${
              vista === 'gantt' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            <GanttChartSquare size={14} /> Gantt
          </button>
          <button
            onClick={() => setVista('kanban')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 ${
              vista === 'kanban' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            <KanbanSquare size={14} /> Kanban
          </button>
        </div>
      </div>

      {/* Métricas */}
      <MetricasTareas estadisticas={estadisticas} />

      {/* Botón nueva tarea */}
      {puedeCrear && (
        <button
          onClick={() => setMostrarFormulario(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all flex items-center gap-2"
        >
          + Nueva Tarea
        </button>
      )}

      {/* Vista seleccionada */}
      {vista === 'tabla' && (
        <VistaTabla 
          tareas={tareas} 
          usuarios={usuarios}
          perfilUsuario={perfilUsuario}
          onTaskClick={setTareaExpandida}
          onTaskUpdate={fetchTareas}
        />
      )}
      
      {vista === 'gantt' && (
        <VistaGantt tareas={tareas} onTaskClick={setTareaExpandida} />
      )}
      
      {vista === 'kanban' && (
        <VistaKanban 
          tareas={tareas} 
          onTaskUpdate={fetchTareas}
          onTaskClick={setTareaExpandida}
        />
      )}

      {/* Modal de formulario */}
      {mostrarFormulario && (
        <FormularioTarea
          usuarios={usuarios}
          perfilUsuario={perfilUsuario}
          onClose={() => setMostrarFormulario(false)}
          onSuccess={() => {
            fetchTareas();
            setMostrarFormulario(false);
          }}
        />
      )}

      {/* Drawer de detalle (implementar después) */}
      {tareaExpandida && (
        // Aquí iría el drawer de detalle de tarea
        <div>Drawer de detalle - Pendiente implementar</div>
      )}
    </div>
  );
}