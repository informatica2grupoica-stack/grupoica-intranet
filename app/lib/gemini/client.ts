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

// Modelo rápido para chatbot y query understanding
const MODEL_FLASH = 'gemini-2.0-flash';

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

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(`${GEMINI_API_BASE}/${MODEL_FLASH}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(tid);

    if (!res.ok) {
      const errText = await res.text();
      return { content: '', error: `Gemini ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json();
    const content: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return { content };
  } catch (err: any) {
    clearTimeout(tid);
    return { content: '', error: err.message || 'Error de conexión con Gemini' };
  }
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
