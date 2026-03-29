"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Mail, Lock, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // MANTENEMOS TU LÓGICA ORIGINAL INTACTA
  useEffect(() => {
    supabase.auth.signOut();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (authError) throw authError;
      if (!data.user) throw new Error("No se pudo obtener el usuario.");

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('email, activo, rol')
        .eq('user_id', data.user.id)
        .single();

      if (perfilError || !perfil) {
        await supabase.auth.signOut();
        throw new Error("Acceso denegado: Usuario no registrado.");
      }

      if (!perfil.activo) {
        await supabase.auth.signOut();
        throw new Error("Acceso denegado: Tu cuenta está desactivada.");
      }

      // REDIRECCIÓN FORZADA (Tu solución que funciona)
      window.location.assign("/"); 

    } catch (err: any) {
      if (err.message === "Invalid login credentials") {
        setError("Correo o contraseña incorrectos.");
      } else if (err.message.includes("Email not confirmed")) {
        setError("Confirma tu correo en el panel de Supabase.");
      } else {
        setError(err.message || "Error inesperado.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#000d1a] flex items-center justify-center p-4">
      {/* Contenedor principal con tus bordes redondeados XL */}
      <div className="bg-white p-10 md:p-14 rounded-[50px] w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-white/10">
        
        <header className="mb-12 text-center">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none mb-3">
            Intranet <span className="text-[#00338d]">ICA</span>
          </h1>
          <div className="h-1 w-12 bg-[#00338d] mx-auto mb-3 rounded-full"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Acceso Corporativo</p>
        </header>

        {error && (
          <div className="bg-rose-50 border-l-4 border-rose-500 text-rose-700 p-4 rounded-2xl flex items-center gap-3 mb-8 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-xs font-bold leading-tight">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative group">
            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[#00338d] transition-colors" />
            <input 
              type="email" 
              placeholder="Correo electrónico" 
              required
              disabled={loading}
              className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500/10 focus:bg-white rounded-[25px] pl-16 pr-6 py-5 font-bold outline-none transition-all disabled:opacity-50 text-sm"
              value={email} 
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[#00338d] transition-colors" />
            <input 
              type="password" 
              placeholder="Contraseña" 
              required
              disabled={loading}
              className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500/10 focus:bg-white rounded-[25px] pl-16 pr-6 py-5 font-bold outline-none transition-all disabled:opacity-50 text-sm"
              value={password} 
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {/* LINK DE RECUPERACIÓN MINIMALISTA */}
          <div className="flex justify-end px-2">
            <Link 
              href="/forgot-password" 
              className="text-[11px] font-bold text-slate-400 hover:text-[#00338d] transition-colors uppercase tracking-wider"
            >
              ¿Olvidaste tu clave?
            </Link>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#00338d] hover:bg-[#002566] text-white py-6 rounded-[25px] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-900/20 transition-all active:scale-[0.97] flex items-center justify-center gap-3 disabled:bg-slate-300 mt-4"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Entrar al Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <footer className="mt-12 text-center border-t border-slate-50 pt-8">
          <p className="text-[9px] font-black uppercase text-slate-300 tracking-[0.3em]">
            Grupo ICA Chile &copy; 2026
          </p>
        </footer>
      </div>
    </div>
  );
}