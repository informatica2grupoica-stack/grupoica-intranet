import requests
import json
import re
from flask import Flask, request, jsonify
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote_plus

app = Flask(__name__)

# CONFIGURACIÓN CRÍTICA
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

def fetch_serper_data(query, search_type="search"):
    """
    Motor de búsqueda masiva con Serper.dev
    """
    url = f"https://google.serper.dev/{search_type}"
    # Pedimos 100 resultados para maximizar la cantidad de datos
    payload = json.dumps({
        "q": query,
        "gl": "cl",
        "hl": "es",
        "num": 100 
    })
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    try:
        response = requests.post(url, headers=headers, data=payload, timeout=30)
        return response.json()
    except:
        return {}

@app.route("/api/index", methods=["GET"])
def scrape_prices():
    producto_raw = request.args.get("producto")
    origen_excel = request.args.get("origen") 
    
    if not producto_raw: return jsonify([])

    # Mantenemos el producto tal cual para precisión quirúrgica (medidas, marcas)
    producto = producto_raw.strip()

    # --- ESTRATEGIA DE BÚSQUEDA TRIPLE ---
    # 1. Búsqueda comercial (Filtro de precios)
    # 2. Búsqueda técnica (Para encontrar ferreterías industriales)
    # 3. Búsqueda de Shopping (Retail masivo)
    queries = [
        f'"{producto}" precio chile ferreteria',
        f'"{producto}" comprar online chile',
        f'"{producto}" stock disponible chile'
    ]
    
    final_data = []
    vistos = set()

    # Ejecución paralela de alta velocidad
    with ThreadPoolExecutor(max_workers=5) as executor:
        # Lanzamos todas las variantes de búsqueda web
        futures_web = [executor.submit(fetch_serper_data, q, "search") for q in queries]
        # Lanzamos la búsqueda de Shopping
        future_shopping = executor.submit(fetch_serper_data, producto, "shopping")
        
        # Recolectamos Shopping
        data_shop = future_shopping.result()
        # Recolectamos Web
        results_web = [f.result() for f in futures_web]

    # --- 1. PROCESAR GOOGLE SHOPPING (Sodimac, Easy, etc.) ---
    for item in data_shop.get('shopping', []):
        link = item.get('link', '')
        if link not in vistos:
            try:
                # Limpieza de precio para que sea un número real
                raw_val = int(re.sub(r'[^\d]', '', str(item.get('price', '0'))))
            except: raw_val = 0
            
            final_data.append({
                "tienda": item.get('source', 'RETAIL').upper(),
                "nombre": item.get('title', ''),
                "precio_valor": raw_val,
                "precio_formateado": f"${raw_val:,}".replace(",", ".") if raw_val > 0 else "N/A",
                "link": link,
                "canal": "SHOPPING",
                "busqueda_original": origen_excel if origen_excel else producto_raw,
                "score_ia": 0 # Espacio reservado para el análisis posterior de la IA
            })
            vistos.add(link)

    # --- 2. PROCESAR WEB Y MAPAS (Ferreterías Locales y de Barrio) ---
    for data_org in results_web:
        # Combinamos resultados orgánicos y lugares (Maps)
        organic_results = data_org.get('organic', []) + data_org.get('places', [])
        
        for item in organic_results:
            link = item.get('link') or item.get('website')
            if not link or link in vistos: continue

            # Filtro estricto de ruido (No queremos redes sociales ni noticias)
            if any(x in link.lower() for x in ['facebook', 'instagram', 'youtube', 'wikipedia', 'twitter', 'noticias', 'mercadolibre']):
                continue

            title = item.get('title', '')
            snippet = item.get('snippet', '') or item.get('address', '')

            # Extractor inteligente de precios en el snippet
            price_match = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
            raw_val = 0
            if price_match:
                try:
                    raw_val = int(re.sub(r'[^\d]', '', price_match.group(0)))
                except: pass

            # Identificar tienda por el dominio
            try:
                tienda_label = link.split('/')[2].replace('www.', '').split('.')[0].upper()
            except:
                tienda_label = "WEB"
            
            final_data.append({
                "tienda": tienda_label,
                "nombre": title,
                "precio_valor": raw_val,
                "precio_formateado": f"${raw_val:,}".replace(",", ".") if raw_val > 0 else "COTIZAR",
                "link": link,
                "canal": "WEB/LOCAL",
                "busqueda_original": origen_excel if origen_excel else producto_raw,
                "score_ia": 0
            })
            vistos.add(link)

    # --- 3. PREPARACIÓN PARA DEEPSEEK (INTEGRACIÓN IA) ---
    # Ordenamos: primero los que tienen precio, luego los de cotizar
    return jsonify(sorted(final_data, key=lambda x: (x['precio_valor'] == 0, x['precio_valor'])))

if __name__ == "__main__":
    # Ejecución en puerto 5000
    app.run(debug=True, port=5000)