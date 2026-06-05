// app/lib/deepseek/client.ts — Cliente DeepSeek-V3 con retry automático

const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat'; // DeepSeek-V3

export interface DSMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DSResponse {
  content: string;
  error?: string;
  tokens?: { prompt: number; completion: number };
}

const RETRIABLE = new Set(['RATE_LIMIT', 'TIMEOUT', 'NETWORK_ERROR', 'SERVER_ERROR']);

async function callOnce(
  messages: DSMessage[],
  opts: { temperature: number; maxTokens: number; timeoutMs: number }
): Promise<DSResponse> {
  const key = process.env.DEEPSEEK_API_KEY || '';
  if (!key) return { content: '', error: 'DEEPSEEK_API_KEY no configurada' };

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), opts.timeoutMs);

  try {
    const res = await fetch(DEEPSEEK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream: false,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error(`[deepseek] HTTP ${res.status}:`, txt.slice(0, 400));
      if (res.status === 429) return { content: '', error: 'RATE_LIMIT' };
      if (res.status >= 500)  return { content: '', error: 'SERVER_ERROR' };
      return { content: '', error: `HTTP_${res.status}` };
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    const usage = data.usage;
    return {
      content,
      tokens: usage ? { prompt: usage.prompt_tokens, completion: usage.completion_tokens } : undefined,
    };
  } catch (err: any) {
    clearTimeout(tid);
    if (err.name === 'AbortError') return { content: '', error: 'TIMEOUT' };
    return { content: '', error: 'NETWORK_ERROR' };
  }
}

export async function callDeepSeek(
  messages: DSMessage[],
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number; retries?: number } = {}
): Promise<DSResponse> {
  const temperature = opts.temperature ?? 0.3;
  const maxTokens   = opts.maxTokens   ?? 1200;
  const timeoutMs   = opts.timeoutMs   ?? 25000;
  const retries     = opts.retries     ?? 3;

  let lastResult: DSResponse = { content: '', error: 'sin_inicio' };

  for (let attempt = 1; attempt <= retries; attempt++) {
    lastResult = await callOnce(messages, { temperature, maxTokens, timeoutMs });

    if (!lastResult.error) return lastResult;

    const isRetriable = RETRIABLE.has(lastResult.error);
    if (!isRetriable || attempt === retries) break;

    const delay = Math.min(1000 * 2 ** (attempt - 1), 6000);
    console.warn(`[deepseek] intento ${attempt}/${retries} (${lastResult.error}), retry en ${delay}ms`);
    await new Promise(r => setTimeout(r, delay));
  }

  return lastResult;
}

// Helper para conversación (convierte historial + agrega system prompt)
export function buildMessages(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string
): DSMessage[] {
  const msgs: DSMessage[] = [{ role: 'system', content: systemPrompt }];
  for (const m of history) {
    if (m.role === 'user' || m.role === 'assistant') {
      msgs.push({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 600) });
    }
  }
  msgs.push({ role: 'user', content: userMessage });
  return msgs;
}

// Compatibilidad con código legacy que usa callDeepSeek({messages, temperature, maxTokens})
export async function preguntarDeepSeek(pregunta: string, contexto = ''): Promise<string> {
  const system = `Eres un asistente experto en productos. Solo respondes sobre productos, SKUs, precios y stock.${contexto ? `\nContexto: ${contexto}` : ''}`;
  const result = await callDeepSeek([{ role: 'system', content: system }, { role: 'user', content: pregunta }], { maxTokens: 400 });
  return result.content || 'Lo siento, no pude procesar tu pregunta.';
}
