import requests
import json
import re
import os
from flask import Flask, request, jsonify
from concurrent.futures import ThreadPoolExecutor
from openai import OpenAI # DeepSeek usa la misma librería

app = Flask(__name__)

# --- CONFIGURACIÓN ---
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"
# Reemplaza con tu API KEY de DeepSeek
DEEPSEEK_API_KEY = "TU_API_KEY_DEEPSEEK" 

client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")

def filtrar_con_ia(producto_buscado, resultados_raw):
    """
    Usa la IA para analizar los títulos y snippets y descartar basura.
    """
    if not resultados_raw: return []

    # Creamos un resumen para que la IA no gaste tantos tokens
    candidatos = []
    for i, res in enumerate(resultados_raw):
        candidatos.append({
            "id": i,
            "titulo": res['nombre'],
            "tienda": res['tienda']
        })

    prompt = f"""
    Actúa como un experto en materiales de construcción en Chile. 
    El usuario busca: "{producto_buscado}"
    
    Analiza esta lista de resultados de Google y devuélveme SOLO los IDs de los productos 
    que coinciden EXACTAMENTE con lo que el usuario busca. 
    Descarta: accesorios, repuestos (si busca la máquina), noticias o cursos.
    
    Lista: {json.dumps(candidatos)}
    
    Responde solo con un array JSON de IDs, ejemplo: [0, 2, 5]
    """

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "system", "content": "Eres un filtro de inventario preciso."},
                      {"role": "user", "content": prompt}],
            response_format={ 'type': 'json_object' } if "deepseek" not in "deepseek-chat" else None # Depende de la versión
        )
        
        # Extraer IDs del texto (manejando si la IA responde con texto extra)
        contenido = response.choices[0].message.content
        ids_validos = json.loads(re.search(r'\[.*\]', contenido).group())
        
        return [resultados_raw[i] for i in ids_validos if i < len(resultados_raw)]
    except Exception as e:
        print(f"❌ Error IA: {e}")
        return resultados_raw[:10] # Si falla la IA, devolvemos los top 10 por defecto

# ... (Mantener funciones fetch_serper_data igual)

@app.route("/api/index", methods=["GET"])
def scrape_prices():
    producto_raw = request.args.get("producto")
    origen_excel = request.args.get("origen") 
    
    if not producto_raw: return jsonify([])

    # 1. Búsqueda normal en Serper
    query_maestra = f"{producto_raw} precio chile"
    final_data = []
    vistos = set()

    with ThreadPoolExecutor(max_workers=2) as executor:
        future_organic = executor.submit(fetch_serper_data, query_maestra, "search")
        future_shopping = executor.submit(fetch_serper_data, query_maestra, "shopping")
        
        data_org = future_organic.result()
        data_shop = future_shopping.result()

    # --- PROCESAMIENTO (Igual al tuyo, omitido por brevedad para llegar a la IA) ---
    # ... (Aquí va tu lógica de procesar data_shop y data_org que llena final_data)
    
    # 2. APLICAR INTELIGENCIA ARTIFICIAL
    # Solo filtramos si hay muchos resultados para optimizar
    if len(final_data) > 3:
        print(f"🧠 Filtrando {len(final_data)} resultados con IA para: {producto_raw}")
        final_data = filtrar_con_ia(producto_raw, final_data)

    return jsonify(sorted(final_data, key=lambda x: (x['precio_valor'] == 0, x['precio_valor'])))

if __name__ == "__main__":
    app.run(debug=True, port=5000)