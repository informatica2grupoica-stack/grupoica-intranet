"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Mail, Lock, Loader2, AlertCircle, ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => { supabase.auth.signOut(); }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(), password: password.trim(),
      });
      if (authError) throw authError;
      if (!data.user) throw new Error("No se pudo obtener el usuario.");

      const { data: perfil, error: perfilError } = await supabase
        .from("perfiles").select("email, activo, rol").eq("user_id", data.user.id).single();

      if (perfilError || !perfil) {
        await supabase.auth.signOut();
        throw new Error("Acceso denegado: Usuario no registrado.");
      }
      if (!perfil.activo) {
        await supabase.auth.signOut();
        throw new Error("Acceso denegado: Tu cuenta está desactivada.");
      }
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
    <div className="min-h-screen bg-gradient-to-br from-[#111827] via-[#1E293B] to-[#0F172A] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Orbes animados de fondo */}
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-[#2563EB] blur-[140px] rounded-full pointer-events-none"
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-[#3B82F6] blur-[140px] rounded-full pointer-events-none"
      />

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="relative bg-white/95 backdrop-blur-xl p-10 md:p-12 rounded-3xl w-full max-w-md shadow-[0_30px_80px_rgba(0,0,0,0.55)] border border-white/20"
      >
        <header className="mb-10 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
            className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] flex items-center justify-center shadow-xl shadow-blue-900/30"
          >
            <Sparkles className="w-8 h-8 text-white" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h1 className="text-3xl font-black tracking-tight leading-none mb-2 text-slate-800">
              Comercial <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2563EB] to-[#3B82F6]">MP</span>
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.45em] text-slate-400">Workspace</p>
          </motion.div>
        </header>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="bg-rose-50 border-l-4 border-rose-500 text-rose-700 p-4 rounded-2xl flex items-center gap-3 mb-8 overflow-hidden"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-xs font-bold leading-tight">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          onSubmit={handleLogin}
          className="space-y-4"
        >
          <div className="relative group">
            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[#2563EB] transition-colors" />
            <input
              type="email" placeholder="Correo electrónico" required disabled={loading}
              className="w-full bg-slate-50 border-2 border-transparent focus:border-[#2563EB]/30 focus:bg-white rounded-2xl pl-14 pr-5 py-4 font-semibold outline-none transition-all disabled:opacity-50 text-sm text-slate-700"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[#2563EB] transition-colors" />
            <input
              type="password" placeholder="Contraseña" required disabled={loading}
              className="w-full bg-slate-50 border-2 border-transparent focus:border-[#2563EB]/30 focus:bg-white rounded-2xl pl-14 pr-5 py-4 font-semibold outline-none transition-all disabled:opacity-50 text-sm text-slate-700"
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>

          <div className="flex justify-end px-1">
            <Link href="/forgot-password" className="text-[11px] font-bold text-slate-400 hover:text-[#2563EB] transition-colors uppercase tracking-wider">
              ¿Olvidaste tu clave?
            </Link>
          </div>

          <motion.button
            whileHover={{ translateY: -2, boxShadow: '0 14px 30px rgba(79,70,229,0.4)' }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-900/20 transition-all flex items-center justify-center gap-3 disabled:opacity-60 mt-3"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Ingresar al Workspace</span><ArrowRight className="w-4 h-4" /></>}
          </motion.button>
        </motion.form>

        <footer className="mt-10 text-center border-t border-slate-100 pt-6">
          <p className="text-[9px] font-black uppercase text-slate-300 tracking-[0.3em]">
            Comercial MP Workspace &copy; 2026
          </p>
        </footer>
      </motion.div>
    </div>
  );
}
