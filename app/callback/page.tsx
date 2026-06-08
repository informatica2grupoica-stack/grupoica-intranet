'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, AlertCircle, Copy } from 'lucide-react';

export default function MeliCallbackPage() {
  const params = useSearchParams();
  const code   = params.get('code');
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [refreshToken, setRefreshToken] = useState('');
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!code) {
      setEstado('error');
      setError('No se recibió el código de autorización de MercadoLibre.');
      return;
    }
    fetch('/api/meli-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.refresh_token) {
          setRefreshToken(d.refresh_token);
          setEstado('ok');
        } else {
          setError(d.error || 'Error al obtener el token');
          setEstado('error');
        }
      })
      .catch(e => {
        setError(e.message);
        setEstado('error');
      });
  }, [code]);

  function copiar() {
    navigator.clipboard.writeText(refreshToken);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-lg w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#FFE600] flex items-center justify-center">
            <span className="text-xl font-bold text-slate-900">ML</span>
          </div>
          <div>
            <h1 className="font-bold text-slate-900">Autorización MercadoLibre</h1>
            <p className="text-sm text-slate-400">Configuración de acceso a la API</p>
          </div>
        </div>

        {estado === 'cargando' && (
          <div className="flex items-center gap-3 text-slate-500 py-6 justify-center">
            <Loader2 size={20} className="animate-spin" />
            <span>Intercambiando código por token...</span>
          </div>
        )}

        {estado === 'error' && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {estado === 'ok' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl p-4">
              <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-700 font-medium">¡Autorización exitosa!</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-2">
                Copia este <strong>MELI_REFRESH_TOKEN</strong> y agrégalo en las variables de entorno de Vercel:
              </p>
              <div className="bg-slate-900 rounded-xl p-3 flex items-center gap-2">
                <code className="text-green-400 text-xs break-all flex-1">{refreshToken}</code>
                <button
                  onClick={copiar}
                  className="flex-shrink-0 text-slate-400 hover:text-white transition-colors"
                  title="Copiar"
                >
                  <Copy size={16} />
                </button>
              </div>
              {copiado && <p className="text-xs text-green-600 mt-1">¡Copiado!</p>}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700">Pasos siguientes:</p>
              <p>1. Ve a <strong>Vercel → grupoica-intranet → Settings → Environment Variables</strong></p>
              <p>2. Agrega la variable: <code className="bg-white border px-1 rounded">MELI_REFRESH_TOKEN</code></p>
              <p>3. Pega el token copiado arriba</p>
              <p>4. Haz <strong>Redeploy</strong> en Vercel</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
