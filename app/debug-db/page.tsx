"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DebugDBPage() {
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [tareas, setTareas] = useState<any[]>([]);

  useEffect(() => {
    const checkData = async () => {
      // Verificar perfiles con fechas de nacimiento
      const { data: perfilesData } = await supabase
        .from('perfiles')
        .select('id, nombre, apellido, fecha_nacimiento, activo')
        .eq('activo', true);
      
      setPerfiles(perfilesData || []);
      
      // Verificar tareas
      const { data: tareasData } = await supabase
        .from('tareas')
        .select('*')
        .limit(10);
      
      setTareas(tareasData || []);
    };
    
    checkData();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Depuración de Base de Datos</h1>
      
      <h2 className="text-xl font-bold mt-4">Perfiles con fechas de nacimiento:</h2>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(perfiles, null, 2)}
      </pre>
      
      <h2 className="text-xl font-bold mt-4">Tareas existentes:</h2>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(tareas, null, 2)}
      </pre>
    </div>
  );
}