import requests
import json
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from concurrent.futures import ThreadPoolExecutor

app = Flask(__name__)
CORS(app)

# CONFIGURACIÓN MAESTRA
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

# LISTADO TOTAL: Construcción, Herramientas, Asfalto, Clavos y Fijaciones
PROVEEDORES_CHILE = [
    "trentini.cl", "hela.cl", "sodimac.cl", "easy.cl", "imperial.cl", 
    "construmart.cl", "yolito.cl", "chilemat.com", "mts.cl", "dabed.cl", 
    "weitzler.cl", "ferreteriaohiggins.cl", "makita.cl", "bosch-professional.com", 
    "dewalt.cl", "milwaukeetool.cl", "indura.cl", "arauco.cl", "madepa.cl", 
    "pernoschile.cl", "asfaltoschile.cl", "bitumix.cl", "dynal.cl", "sika.com", 
    "texsa.cl", "ferreteriasindustrial.cl", "amanecer.cl", "fijaciones.cl",
    "mamut.cl", "pizarreño.cl", "volcan.cl", "sipesa.cl"
]

def limpiar_nombre_producto(nombre):
    if not nombre: return ""
    patrones = [r"(?i)despacho\s?a\s?domicilio", r"(?i)retiro\s?en\s?tienda", r"(?i)stock\s?disponible", r"\|", r"-"]
    for p in patrones:
        nombre = re.sub(p, "", nombre)
    return re.sub(r'\s+', ' ', nombre).strip()

def extraer_precio(texto):
    if not texto: return 0
    # Busca montos con puntos o sin puntos después del $
    match = re.search(r'\$\s?([\d\.]+)', texto)
    if match:
        try:
            val = int(re.sub(r'[^\d]', '', match.group(1)))
            if 100 < val < 20000000: return val
        except: pass
    return 0

def fetch_serper_data(query, search_type="search"):
    url = f"https://google.serper.dev/{search_type}"
    payload = json.dumps({"q": query, "gl": "cl", "hl": "es", "num": 40})
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    try:
        response = requests.post(url, headers=headers, data=payload, timeout=9)
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
    
    # Dividimos la búsqueda en 3 estrategias para evitar bloqueos de Google
    query_vip = f'"{producto}" site:{" OR site:".join(PROVEEDORES_CHILE[:12])}'
    query_especialistas = f'"{producto}" (site:asfaltoschile.cl OR site:bitumix.cl OR site:pernoschile.cl OR site:hela.cl)'
    query_general = f'"{producto}" precio chile ferreteria'
    
    final_data = []
    vistos = set()

    with ThreadPoolExecutor(max_workers=6) as executor:
        f_vip = executor.submit(fetch_serper_data, query_vip, "search")
        f_esp = executor.submit(fetch_serper_data, query_especialistas, "search")
        f_gen = executor.submit(fetch_serper_data, query_general, "search")
        f_shop = executor.submit(fetch_serper_data, producto, "shopping")
        
        results = [f_vip.result(), f_esp.result(), f_gen.result(), f_shop.result()]

    for data in results:
        items = data.get('shopping', []) + data.get('organic', []) + data.get('places', [])
        for item in items:
            link = item.get('link') or item.get('website', '')
            if not link or link in vistos: continue
            if any(x in link.lower() for x in ['facebook', 'instagram', 'youtube', 'wikipedia']): continue

            title = item.get('title', 'Tienda')
            snippet = item.get('snippet', '')
            
            raw_price = 0
            if 'price' in item:
                try: raw_price = int(re.sub(r'[^\d]', '', str(item['price'])))
                except: raw_price = 0
            
            if raw_price == 0:
                raw_price = extraer_precio(title + " " + snippet)

            tienda = item.get('source') or item.get('store')
            if not tienda:
                try: tienda = link.split('/')[2].replace('www.', '').split('.')[0].upper()
                except: tienda = "WEB"

            final_data.append({
                "tienda": tienda.upper(),
                "nombre": limpiar_nombre_producto(title),
                "precio_valor": raw_price,
                "precio_formateado": f"${raw_price:,}".replace(",", ".") if raw_price > 0 else "Consultar",
                "link": link,
                "canal": "MOTOR_CONSTRUCCION",
                "busqueda_original": origen_excel or producto
            })
            vistos.add(link)

    # Ordenar: Precios reales primero, luego los más baratos
    resultados_finales = sorted(final_data, key=lambda x: (x['precio_valor'] == 0, x['precio_valor']))

    return jsonify(resultados_finales[:50])

app = app