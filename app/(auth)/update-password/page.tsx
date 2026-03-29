"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { KeyRound, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-2xl mb-4 text-indigo-600">
              <KeyRound className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Nueva Contraseña</h1>
            <p className="text-slate-500 text-sm mt-2 font-medium">
              Asegúrate de que sea una clave segura que puedas recordar.
            </p>
          </div>

          {!success ? (
            <form onSubmit={handleUpdate} className="space-y-5">
              <div className="space-y-4">
                {/* Nueva Password */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-400 ml-1">Nueva Clave</label>
                  <div className="relative">
                    <input 
                      type={showPass ? "text" : "password"}
                      required 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-indigo-50 focus:bg-white transition-all font-medium"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirmar Password */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-400 ml-1">Confirmar Clave</label>
                  <input 
                    type="password"
                    required 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-indigo-50 focus:bg-white transition-all font-medium"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <button 
                disabled={loading}
                className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-black transition-all disabled:bg-slate-200 shadow-lg shadow-slate-100 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Actualizar Contraseña"}
              </button>
            </form>
          ) : (
            <div className="text-center py-6 animate-in fade-in zoom-in duration-300">
              <div className="flex justify-center mb-4 text-emerald-500">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <p className="text-sm font-bold text-slate-700">¡Clave actualizada!</p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Tu contraseña ha sido cambiada con éxito. Serás redirigido al login en unos segundos...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}