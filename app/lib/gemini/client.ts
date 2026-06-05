// app/lib/gemini/client.ts
// Cliente unificado para Google Gemini — reemplaza DeepSeek en chatbot y buscador

interface GeminiMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

interface GeminiResponse {
  content: string;
  error?: string;
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Orden de fallback: intenta el más nuevo, si no existe usa 1.5-flash
const MODELS_FALLBACK = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];

function getKey(): string {
  return process.env.GEMINI_API_KEY || '';
}

// Llamada genérica — soporta system instruction + historial
export async function callGemini(
  systemPrompt: string,
  messages: GeminiMessage[],
  opts: { temperature?: number; maxTokens?: number; jsonMode?: boolean; timeoutMs?: number } = {}
): Promise<GeminiResponse> {
  const apiKey = getKey();
  if (!apiKey) return { content: '', error: 'GEMINI_API_KEY no configurada' };

  const { temperature = 0.3, maxTokens = 800, jsonMode = false, timeoutMs = 15000 } = opts;

  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };

  for (const model of MODELS_FALLBACK) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(tid);

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[gemini] ${model} HTTP ${res.status}:`, errText.slice(0, 400));
        if (res.status === 404) continue; // modelo no existe, prueba el siguiente
        if (res.status === 429) return { content: '', error: 'RATE_LIMIT' };
        return { content: '', error: `Gemini ${res.status}: ${errText.slice(0, 300)}` };
      }

      const data = await res.json();
      const content: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!content) {
        const raw = JSON.stringify(data).slice(0, 300);
        console.error(`[gemini] ${model} empty content:`, raw);
        return { content: '', error: `Gemini sin contenido: ${raw}` };
      }
      console.log(`[gemini] OK con modelo ${model}`);
      return { content };
    } catch (err: any) {
      clearTimeout(tid);
      if (err.name === 'AbortError') return { content: '', error: 'Timeout Gemini' };
      console.error(`[gemini] ${model} excepción:`, err.message);
      // Si es error de red intenta el siguiente modelo
      continue;
    }
  }

  return { content: '', error: 'Todos los modelos Gemini fallaron' };
}

// Helper para conversación simple (sin historial)
export async function callGeminiSimple(
  systemPrompt: string,
  userMessage: string,
  opts?: Parameters<typeof callGemini>[2]
): Promise<GeminiResponse> {
  return callGemini(systemPrompt, [{ role: 'user', parts: [{ text: userMessage }] }], opts);
}

// Convierte mensajes del formato {role, content} al formato Gemini {role, parts}
// — DeepSeek usa 'system'/'user'/'assistant'; Gemini usa 'user'/'model'
export function toGeminiMessages(
  msgs: Array<{ role: string; content: string }>
): GeminiMessage[] {
  return msgs
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content).slice(0, 500) }],
    }));
}
