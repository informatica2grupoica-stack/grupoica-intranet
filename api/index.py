import requests
import json
import re
from flask import Flask, request, jsonify
from concurrent.futures import ThreadPoolExecutor

app = Flask(__name__)

SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

def fetch_serper_page(query, page_num):
    """Función para traer una página específica de resultados"""
    url = "https://google.serper.dev/search"
    payload = json.dumps({
        "q": query,
        "gl": "cl",
        "hl": "es",
        "num": 100,      # Máximo por página
        "page": page_num # Saltamos a la siguiente página de Google
    })
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    try:
        response = requests.post(url, headers=headers, data=payload, timeout=30)
        return response.json()
    except:
        return {}

@app.route("/api/index", methods=["GET"])
def scrape_prices():
    producto = request.args.get("producto")
    if not producto: return jsonify([])

    # QUERY MAESTRA: Forzamos a Google a buscar en el ecosistema de construcción
    query_maestra = f'"{producto}" precio (ferreteria OR mayorista OR distribuidor OR "patio constructor") .cl'
    
    # SISTEMA DE RASTREO MULTIPÁGINA (Paginación interna)
    # Lanzamos hilos en paralelo para traer 300 resultados (3 páginas de 100)
    all_results = []
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(fetch_serper_page, query_maestra, p) for p in range(1, 4)]
        for f in futures:
            page_data = f.result()
            # Combinamos orgánicos y lugares (mapas)
            all_results.extend(page_data.get('organic', []))
            all_results.extend(page_data.get('places', []))

    final_data = []
    vistos = set()

    for item in all_results:
        # Extraer link y título dependiendo si es lugar o link orgánico
        link = item.get('link') or item.get('website') or f"https://www.google.com/search?q={quote_plus(item.get('title',''))}"
        title = item.get('title', '')
        snippet = item.get('snippet', '') or item.get('address', '')

        # Limpieza y Regex de Precio
        price_match = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
        
        if link not in vistos:
            raw_val = 0
            if price_match:
                try:
                    raw_val = int(re.sub(r'[^\d]', '', price_match.group(0)))
                except: pass

            # Filtrar basura (Redes sociales y noticias)
            if any(x in link.lower() for x in ['facebook', 'instagram', 'youtube', 'wikipedia', 'noticias']):
                continue

            tienda = link.split('/')[2].replace('www.', '').split('.')[0].upper() if "http" in link else "LOCAL"
            
            final_data.append({
                "tienda": tienda,
                "nombre": title[:100],
                "precio_valor": raw_val,
                "precio_formateado": f"${raw_val:,}".replace(",", ".") if raw_val > 0 else "COTIZAR",
                "link": link
            })
            vistos.add(link)

    # ORDENAMIENTO ROBUSTO: Baratos primero, luego los que no tienen precio (Locales)
    con_p = sorted([x for x in final_data if x['precio_valor'] > 0], key=lambda x: x['precio_valor'])
    sin_p = [x for x in final_data if x['precio_valor'] == 0]
    
    return jsonify(con_p + sin_p)