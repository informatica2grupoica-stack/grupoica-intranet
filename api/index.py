import requests
import json
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from concurrent.futures import ThreadPoolExecutor

app = Flask(__name__)
# Habilitamos CORS para que Next.js pueda consultar la API sin bloqueos
CORS(app)

SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

# Lista extendida de proveedores estratégicos
PROVEEDORES_CHILE = [
    "trentini.cl", "hela.cl", "sodimac.cl", "easy.cl", "imperial.cl", 
    "construmart.cl", "yolito.cl", "weitzler.cl", "ferreteriaohiggins.cl",
    "chilemat.com", "mts.cl", "dabed.cl", "elaguila.cl", "pizarreño.cl",
    "ferreteriasindustrial.cl", "amanecer.cl", "pernoschile.cl"
]

def limpiar_texto(texto):
    """Limpia caracteres extraños y excesos de espacios"""
    if not texto: return ""
    return re.sub(r'\s+', ' ', texto).strip()

def fetch_serper_data(query, search_type="search"):
    url = f"https://google.serper.dev/{search_type}"
    payload = json.dumps({
        "q": query,
        "gl": "cl",
        "hl": "es",
        "num": 40 
    })
    headers = {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
    }
    try:
        response = requests.post(url, headers=headers, data=payload, timeout=10)
        return response.json()
    except Exception as e:
        print(f"Error en Serper: {e}")
        return {}

@app.route("/api/index", methods=["GET"])
@app.route("/python/index", methods=["GET"]) # Doble ruta para flexibilidad
def scrape_prices():
    producto_raw = request.args.get("producto")
    origen_excel = request.args.get("origen") 
    
    if not producto_raw: 
        return jsonify({"error": "No se proporcionó producto"}), 400

    producto = limpiar_texto(producto_raw)

    # ESTRATEGIA: Búsqueda quirúrgica en sitios específicos + general
    query_proveedores = f'"{producto}" (site:{" OR site:".join(PROVEEDORES_CHILE)})'
    
    queries = [
        query_proveedores,
        f'"{producto}" precio chile',
        f'"{producto}" ferreteria industrial'
    ]
    
    final_data = []
    vistos = set()

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures_web = [executor.submit(fetch_serper_data, q, "search") for q in queries]
        future_shopping = executor.submit(fetch_serper_data, producto, "shopping")
        
        # Resultados de Shopping (Sodimac, etc.)
        data_shop = future_shopping.result()
        # Resultados Web
        results_web = [f.result() for f in futures_web]

    # 1. Procesar Shopping
    for item in data_shop.get('shopping', []):
        link = item.get('link', '')
        if link and link not in vistos:
            try:
                # Extraer solo números para el valor real
                raw_val = int(re.sub(r'[^\d]', '', str(item.get('price', '0'))))
            except: raw_val = 0
            
            final_data.append({
                "tienda": item.get('source', 'RETAIL').upper(),
                "nombre": limpiar_texto(item.get('title', '')),
                "precio_valor": raw_val,
                "precio_formateado": f"${raw_val:,}".replace(",", ".") if raw_val > 0 else "Ver en tienda",
                "link": link,
                "canal": "SHOPPING",
                "busqueda_original": origen_excel or producto
            })
            vistos.add(link)

    # 2. Procesar Web (Resultados de proveedores específicos y mapas)
    for data_org in results_web:
        results = data_org.get('organic', []) + data_org.get('places', [])
        for item in results:
            link = item.get('link') or item.get('website')
            if not link or link in vistos: continue

            # Filtro de exclusión de ruido
            if any(x in link.lower() for x in ['facebook', 'instagram', 'youtube', 'wikipedia', 'twitter', 'mercadolibre']):
                continue

            title = item.get('title', '')
            snippet = item.get('snippet', '')

            # Extracción inteligente de precio en el texto
            price_match = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
            raw_val = 0
            if price_match:
                try:
                    raw_val = int(re.sub(r'[^\d]', '', price_match.group(0)))
                except: pass

            # Etiquetar tienda por dominio
            try:
                tienda_label = link.split('/')[2].replace('www.', '').split('.')[0].upper()
            except: tienda_label = "WEB"
            
            final_data.append({
                "tienda": tienda_label,
                "nombre": limpiar_texto(title),
                "precio_valor": raw_val,
                "precio_formateado": f"${raw_val:,}".replace(",", ".") if raw_val > 0 else "COTIZAR",
                "link": link,
                "canal": "WEB/PROVEEDOR",
                "busqueda_original": origen_excel or producto
            })
            vistos.add(link)

    # Ordenar: mejores precios primero (pero enviando los ceros/cotizar al final)
    resultados_ordenados = sorted(
        final_data, 
        key=lambda x: (x['precio_valor'] == 0, x['precio_valor'])
    )
    
    return jsonify(resultados_ordenados[:40])

# Requisito para Vercel Serverless
app = app