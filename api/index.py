import requests
import json
import re
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from concurrent.futures import ThreadPoolExecutor

app = Flask(__name__)
CORS(app)

# CONFIGURACIÓN MAESTRA
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

# Listado masivo de proveedores estratégicos en Chile
PROVEEDORES_CHILE = [
    "trentini.cl", "hela.cl", "sodimac.cl", "easy.cl", "imperial.cl", 
    "construmart.cl", "yolito.cl", "weitzler.cl", "ferreteriaohiggins.cl",
    "chilemat.com", "mts.cl", "dabed.cl", "elaguila.cl", "pizarreño.cl",
    "ferreteriasindustrial.cl", "amanecer.cl", "pernoschile.cl", "indura.cl",
    "boest.cl", "ferreteriasuma.cl", "duro.cl", "proyectacolor.cl", "sherwin.cl",
    "vicsa.cl", "steelpro.cl", "3mchile.cl", "bosch-professional.com", "makita.cl",
    "dewalt.cl", "stanleytools.com", "bahco.com", "irwin.cl", "truper.com"
]

def limpiar_nombre_producto(nombre):
    """Elimina basura común de los títulos de e-commerce"""
    if not nombre: return ""
    basura = [
        "Despacho a domicilio", "Retiro en tienda", "Stock disponible", 
        "Precio normal", "Oferta", "Cuotas", "Sin interés", "Sodimac Chile", "Easy Chile"
    ]
    for b in basura:
        nombre = re.sub(rf"(?i){b}", "", nombre)
    return re.sub(r'\s+', ' ', nombre).strip()

def extraer_precio(texto):
    """Busca precios con formatos $1.000, $ 1000, 1.000 CLP, etc."""
    if not texto: return 0
    # Busca el patrón de signo peso seguido de números y puntos
    match = re.search(r'\$\s?([\d\.]+)', texto)
    if match:
        try:
            val = int(re.sub(r'[^\d]', '', match.group(1)))
            # Filtro de seguridad: precios menores a 100 o mayores a 10M suelen ser errores de scraping
            if 100 < val < 10000000: return val
        except: pass
    return 0

def fetch_serper_data(query, search_type="search"):
    url = f"https://google.serper.dev/{search_type}"
    payload = json.dumps({
        "q": query,
        "gl": "cl",
        "hl": "es",
        "num": 50 # Máximo provecho de la API
    })
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    try:
        response = requests.post(url, headers=headers, data=payload, timeout=12)
        return response.json()
    except:
        return {}

@app.route("/python/index", methods=["GET"])
@app.route("/api/index", methods=["GET"])
def scrape_prices():
    producto_raw = request.args.get("producto")
    origen_excel = request.args.get("origen") 
    
    if not producto_raw: 
        return jsonify([])

    producto = producto_raw.strip()
    
    # ESTRATEGIA DE BÚSQUEDA TRIPLE
    # 1. Búsqueda directa en proveedores VIP
    query_vip = f'"{producto}" (site:{" OR site:".join(PROVEEDORES_CHILE[:15])})'
    # 2. Búsqueda técnica (precios y stock)
    query_tecnica = f'"{producto}" precio stock ferreteria chile'
    
    final_data = []
    vistos = set()

    with ThreadPoolExecutor(max_workers=8) as executor:
        # Lanzamos hilos para no bloquear la ejecución
        future_vip = executor.submit(fetch_serper_data, query_vip, "search")
        future_tec = executor.submit(fetch_serper_data, query_tecnica, "search")
        future_shop = executor.submit(fetch_serper_data, producto, "shopping")
        
        results_list = [
            future_vip.result(), 
            future_tec.result(), 
            future_shop.result()
        ]

    # PROCESAR RESULTADOS
    for data in results_list:
        # Combinar Shopping + Organic + Places
        items = data.get('shopping', []) + data.get('organic', []) + data.get('places', [])
        
        for item in items:
            link = item.get('link') or item.get('website', '')
            if not link or link in vistos: continue

            # Filtro de Redes Sociales y Basura
            if any(x in link.lower() for x in ['facebook', 'instagram', 'youtube', 'wikipedia', 'mercadolibre']):
                continue

            title = item.get('title', item.get('source', 'Tienda'))
            snippet = item.get('snippet', '')
            
            # Extraer precio (prioriza el campo 'price' de shopping, sino busca en el texto)
            raw_price = 0
            if 'price' in item:
                try: raw_price = int(re.sub(r'[^\d]', '', str(item['price'])))
                except: raw_price = 0
            
            if raw_price == 0:
                raw_price = extraer_precio(title + " " + snippet)

            # Identificación inteligente de Tienda
            tienda = item.get('source') or item.get('store')
            if not tienda:
                try:
                    tienda = link.split('/')[2].replace('www.', '').split('.')[0].upper()
                except:
                    tienda = "WEB"

            final_data.append({
                "tienda": tienda.upper(),
                "nombre": limpiar_nombre_producto(title),
                "precio_valor": raw_price,
                "precio_formateado": f"${raw_price:,}".replace(",", ".") if raw_price > 0 else "Consultar",
                "link": link,
                "canal": "GOOGLE_INDEX",
                "busqueda_original": origen_excel or producto
            })
            vistos.add(link)

    # ORDENAMIENTO INTELIGENTE
    # 1. Los que tienen precio real primero
    # 2. Ordenados de menor a mayor precio
    # 3. Los "Consultar" al final
    resultados_finales = sorted(
        final_data, 
        key=lambda x: (x['precio_valor'] == 0, x['precio_valor'])
    )

    return jsonify(resultados_finales[:40])

# Exponer la app para Vercel
app = app

if __name__ == "__main__":
    app.run(debug=True, port=5000)