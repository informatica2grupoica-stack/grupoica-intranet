// lib/deepseek/client.ts

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  content: string;
  error?: string;
}

export async function callDeepSeek(
  messages: DeepSeekMessage[],
  temperature: number = 0.3,
  maxTokens: number = 500
): Promise<DeepSeekResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    console.error("❌ Falta DEEPSEEK_API_KEY en .env.local");
    return { content: "", error: "API Key no configurada" };
  }

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error DeepSeek:", errorText);
      return { content: "", error: `Error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";
    
    return { content };
    
  } catch (error: any) {
    console.error("❌ Error llamando a DeepSeek:", error.message);
    return { content: "", error: error.message };
  }
}

// Función específica para responder preguntas sobre productos
export async function preguntarDeepSeek(pregunta: string, contexto: string = ""): Promise<string> {
  const systemPrompt = `Eres un asistente experto en productos de una empresa. 
Ayudas a encontrar información sobre productos, SKUs, precios y stock.
Solo respondes preguntas relacionadas con productos. Si no sabes algo, dices "No tengo información sobre eso".
${contexto ? `\nContexto adicional: ${contexto}` : ''}`;

  const result = await callDeepSeek([
    { role: "system", content: systemPrompt },
    { role: "user", content: pregunta }
  ], 0.5, 300);

  return result.content || "Lo siento, no pude procesar tu pregunta.";
}