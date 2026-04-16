import requests
import json
import re
from flask import Flask, request, jsonify, Response
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote_plus

app = Flask(__name__)

# CONFIGURACIÓN
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

# Listado de proveedores estratégicos (puedes seguir sumando hasta 40)
PROVEEDORES_CHILE = [
    "trentini.cl", "hela.cl", "sodimac.cl", "easy.cl", "imperial.cl", 
    "construmart.cl", "yolito.cl", "weitzler.cl", "ferreteriaohiggins.cl",
    "chilemat.com", "mts.cl", "dabed.cl", "elaguila.cl", "pizarreño.cl"
]

def fetch_serper_data(query, search_type="search"):
    url = f"https://google.serper.dev/{search_type}"
    payload = json.dumps({
        "q": query,
        "gl": "cl",
        "hl": "es",
        "num": 40 # Bajamos a 40 para ganar velocidad de respuesta
    })
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    try:
        response = requests.post(url, headers=headers, data=payload, timeout=15)
        return response.json()
    except:
        return {}

@app.route("/api/index", methods=["GET"])
def scrape_prices():
    producto_raw = request.args.get("producto")
    origen_excel = request.args.get("origen") 
    
    if not producto_raw: return jsonify([])

    producto = producto_raw.strip()

    # --- NUEVA ESTRATEGIA: BÚSQUEDA DIRIGIDA ---
    # Creamos una query que obligue a buscar en tus proveedores
    query_proveedores = f'"{producto}" (site:{" OR site:".join(PROVEEDORES_CHILE)})'
    
    queries = [
        query_proveedores, # Prioridad 1: Tus tiendas
        f'"{producto}" precio chile ferreteria',
        f'"{producto}" comprar online'
    ]
    
    final_data = []
    vistos = set()

    with ThreadPoolExecutor(max_workers=6) as executor:
        # Buscamos en tiendas específicas, web general y shopping en paralelo
        futures_web = [executor.submit(fetch_serper_data, q, "search") for q in queries]
        future_shopping = executor.submit(fetch_serper_data, producto, "shopping")
        
        data_shop = future_shopping.result()
        results_web = [f.result() for f in futures_web]

    # --- PROCESAR SHOPPING ---
    for item in data_shop.get('shopping', []):
        link = item.get('link', '')
        if link not in vistos:
            try:
                raw_val = int(re.sub(r'[^\d]', '', str(item.get('price', '0'))))
            except: raw_val = 0
            
            final_data.append({
                "tienda": item.get('source', 'RETAIL').upper(),
                "nombre": item.get('title', ''),
                "precio_valor": raw_val,
                "link": link,
                "canal": "SHOPPING",
                "busqueda_original": origen_excel or producto
            })
            vistos.add(link)

    # --- PROCESAR WEB (CON FILTRO DE TRENTINI, HELA, ETC.) ---
    for data_org in results_web:
        # Combinamos resultados orgánicos y places
        organic_results = data_org.get('organic', []) + data_org.get('places', [])
        
        for item in organic_results:
            link = item.get('link') or item.get('website')
            if not link or link in vistos: continue

            # Excluir basura
            if any(x in link.lower() for x in ['facebook', 'instagram', 'youtube', 'wikipedia', 'noticia']):
                continue

            title = item.get('title', '')
            snippet = item.get('snippet', '')

            # Extractor de precio mejorado
            price_match = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
            raw_val = 0
            if price_match:
                try:
                    raw_val = int(re.sub(r'[^\d]', '', price_match.group(0)))
                except: pass

            # Identificar tienda
            try:
                tienda_label = link.split('/')[2].replace('www.', '').split('.')[0].upper()
            except: tienda_label = "WEB"
            
            final_data.append({
                "tienda": tienda_label,
                "nombre": title,
                "precio_valor": raw_val,
                "link": link,
                "canal": "WEB/PROVEEDOR",
                "busqueda_original": origen_excel or producto
            })
            vistos.add(link)

    # Ordenar por precio (los más baratos primero, pero ignorando ceros al principio)
    resultados = sorted(final_data, key=lambda x: (x['precio_valor'] == 0, x['precio_valor']))
    
    # Retornamos los top 20 resultados más relevantes y baratos
    return jsonify(resultados[:25])

if __name__ == "__main__":
    app.run(debug=True, port=5000)