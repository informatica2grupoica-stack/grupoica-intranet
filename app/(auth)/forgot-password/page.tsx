"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Mail, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // IMPORTANTE: redirectTo debe ser la URL donde creaste el archivo anterior
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setEnviado(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Card con el mismo estilo de tu Intranet */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-10">
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 rounded-2xl mb-4 text-[#00338d]">
              <Mail className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Recuperar Acceso</h1>
            <p className="text-slate-400 text-sm mt-2 font-medium">
              Enviaremos un enlace de restauración a tu correo corporativo.
            </p>
          </div>

          {!enviado ? (
            <form onSubmit={handleReset} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    type="email" 
                    required 
                    placeholder="ejemplo@grupoica.cl"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm outline-none focus:ring-4 ring-blue-50 focus:bg-white transition-all font-medium"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p>{error === "Email not found" ? "Este correo no existe en nuestros registros." : error}</p>
                </div>
              )}

              <button 
                disabled={loading}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm hover:bg-black transition-all disabled:bg-slate-200 shadow-xl shadow-slate-200/50 flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enviar enlace de acceso"}
              </button>
            </form>
          ) : (
            /* Estado de éxito con el check verde */
            <div className="text-center py-6 animate-in fade-in zoom-in duration-300">
              <div className="flex justify-center mb-5">
                <div className="bg-emerald-50 p-4 rounded-full">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
              </div>
              <p className="text-sm font-bold text-slate-800">¡Correo enviado!</p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed px-4">
                Revisa tu bandeja de entrada. Si no lo ves, revisa la carpeta de <span className="font-bold">Spam</span>.
              </p>
              <button 
                onClick={() => setEnviado(false)}
                className="mt-8 text-[11px] font-black uppercase tracking-widest text-[#00338d] hover:opacity-70 transition-opacity"
              >
                Reintentar con otro correo
              </button>
            </div>
          )}

          <div className="mt-10 pt-6 border-t border-slate-50 text-center">
            <Link 
              href="/login" 
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}