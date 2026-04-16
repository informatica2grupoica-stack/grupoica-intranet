import requests
import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from concurrent.futures import ThreadPoolExecutor

# CONFIGURACIÓN
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"
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
        "num": 40
    })
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    try:
        response = requests.post(url, headers=headers, data=payload, timeout=10)
        return response.json()
    except:
        return {}

def handler(request):
    """
    Función principal que Vercel ejecutará
    """
    # 1. Obtener parámetros de la URL
    parsed_url = urlparse(request.url)
    params = parse_qs(parsed_url.query)
    
    producto_raw = params.get("producto", [None])[0]
    origen_excel = params.get("origen", [None])[0]
    
    if not producto_raw:
        return {"statusCode": 400, "body": json.dumps([])}

    producto = producto_raw.strip()
    query_proveedores = f'"{producto}" (site:{" OR site:".join(PROVEEDORES_CHILE)})'
    
    queries = [query_proveedores, f'"{producto}" precio chile']
    
    final_data = []
    vistos = set()

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures_web = [executor.submit(fetch_serper_data, q, "search") for q in queries]
        future_shopping = executor.submit(fetch_serper_data, producto, "shopping")
        
        data_shop = future_shopping.result()
        results_web = [f.result() for f in futures_web]

    # Procesar Shopping
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

    # Procesar Web
    for data_org in results_web:
        organic_results = data_org.get('organic', []) + data_org.get('places', [])
        for item in organic_results:
            link = item.get('link') or item.get('website')
            if not link or link in vistos: continue
            if any(x in link.lower() for x in ['facebook', 'instagram', 'youtube', 'wikipedia']): continue

            title = item.get('title', '')
            snippet = item.get('snippet', '')
            price_match = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
            raw_val = 0
            if price_match:
                try:
                    raw_val = int(re.sub(r'[^\d]', '', price_match.group(0)))
                except: pass

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

    resultados = sorted(final_data, key=lambda x: (x['precio_valor'] == 0, x['precio_valor']))
    
    # Respuesta para Vercel
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(resultados[:25])
    }

# ESTA LÍNEA ES VITAL PARA VERCEL
# Si usas Flask, Vercel espera un objeto llamado 'app'
from flask import Flask, request as flask_request, jsonify
app = Flask(__name__)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    # Convertimos la petición de Flask al formato que entiende nuestro handler
    return Response(
        handler(flask_request)["body"],
        status=200,
        mimetype='application/json'
    )

# Para local
if __name__ == "__main__":
    app.run(debug=True, port=5000)