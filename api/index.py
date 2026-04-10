import requests
import json
import re
from flask import Flask, request, jsonify
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote_plus

app = Flask(__name__)

# REVISAR: Tu API KEY de Serper.dev
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

def fetch_serper_data(query, search_type="search"):
    """
    search_type puede ser "search" (Orgánico/Maps) o "shopping"
    """
    url = f"https://google.serper.dev/{search_type}"
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
    producto = request.args.get("producto")
    # Capturamos el nombre original del Excel si existe
    origen_excel = request.args.get("origen") 
    
    if not producto: return jsonify([])

    # MODO TEST: Para verificar conexión sin gastar créditos
    if producto.lower() == "test":
        return jsonify([{
            "tienda": "SISTEMA",
            "nombre": "BACKEND OPERATIVO - LISTO PARA EXCEL",
            "precio_valor": 0,
            "precio_formateado": "OK",
            "link": "#",
            "canal": "DEBUG",
            "busqueda_original": "TEST"
        }])

    # Query optimizada para el sector construcción
    query_maestra = f"{producto} chile"
    
    final_data = []
    vistos = set()

    # EJECUCIÓN EN PARALELO: Shopping + Orgánico + Maps
    with ThreadPoolExecutor(max_workers=2) as executor:
        future_organic = executor.submit(fetch_serper_data, query_maestra, "search")
        future_shopping = executor.submit(fetch_serper_data, query_maestra, "shopping")
        
        data_org = future_organic.result()
        data_shop = future_shopping.result()

    # --- 1. PROCESAR GOOGLE SHOPPING ---
    for item in data_shop.get('shopping', []):
        link = item.get('link', '')
        if link not in vistos:
            raw_val = int(re.sub(r'[^\d]', '', str(item.get('price', '0'))))
            tienda = item.get('source', 'RETAIL').upper()
            
            final_data.append({
                "tienda": tienda,
                "nombre": item.get('title', '')[:100],
                "precio_valor": raw_val,
                "precio_formateado": f"${raw_val:,}".replace(",", "."),
                "link": link,
                "canal": "SHOPPING",
                "busqueda_original": origen_excel if origen_excel else producto
            })
            vistos.add(link)

    # --- 2. PROCESAR ORGÁNICO Y MAPAS ---
    organic_results = data_org.get('organic', []) + data_org.get('places', [])
    for item in organic_results:
        link = item.get('link') or item.get('website') or f"https://www.google.com/search?q={quote_plus(item.get('title',''))}"
        title = item.get('title', '')
        snippet = item.get('snippet', '') or item.get('address', '')

        if link not in vistos:
            price_match = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
            raw_val = 0
            if price_match:
                try:
                    raw_val = int(re.sub(r'[^\d]', '', price_match.group(0)))
                except: pass

            if any(x in link.lower() for x in ['facebook', 'instagram', 'youtube', 'wikipedia']):
                continue

            tienda_label = link.split('/')[2].replace('www.', '').split('.')[0].upper() if "http" in link else "LOCAL"
            
            final_data.append({
                "tienda": tienda_label,
                "nombre": title[:100],
                "precio_valor": raw_val,
                "precio_formateado": f"${raw_val:,}".replace(",", ".") if raw_val > 0 else "COTIZAR",
                "link": link,
                "canal": "WEB/MAPS",
                "busqueda_original": origen_excel if origen_excel else producto
            })
            vistos.add(link)

    # Ordenar por precio (los que tienen precio primero, luego de menor a mayor)
    return jsonify(sorted(final_data, key=lambda x: (x['precio_valor'] == 0, x['precio_valor'])))

if __name__ == "__main__":
    app.run(debug=True, port=5000)