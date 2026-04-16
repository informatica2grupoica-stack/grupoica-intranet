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

# LISTADO EXPANDIDO: Construcción, Herramientas, Asfalto y Clavos
PROVEEDORES_CHILE = [
    # Grandes Retailers y Ferreterías
    "sodimac.cl", "easy.cl", "imperial.cl", "construmart.cl", "yolito.cl", 
    "chilemat.com", "mts.cl", "dabed.cl", "weitzler.cl", "ferreteriaohiggins.cl",
    # Especialistas en Herramientas y Maquinaria
    "trentini.cl", "hela.cl", "makita.cl", "bosch-professional.com", "dewalt.cl",
    "milwaukeetool.cl", "stanleytools.com", "bahco.com", "irwin.cl", "truper.com",
    "vicsa.cl", "steelpro.cl", "3mchile.cl", "indura.cl", "boest.cl",
    # Maderas, Clavos y Fijaciones
    "arauco.cl", "corma.cl", "madepa.cl", "pernoschile.cl", "mamut.cl", 
    "fijaciones.cl", "api-sa.cl", "pizarreño.cl", "volcan.cl",
    # Asfaltos, Emulsiones y Químicos
    "asfaltoschile.cl", "bitumix.cl", "dynal.cl", "sika.com", "cave.cl", 
    "sipesa.cl", "quimicadalton.cl", "texsa.cl",
    # Distribuidores Industriales y Otros
    "ferreteriasindustrial.cl", "amanecer.cl", "ferreteriasuma.cl", "duro.cl",
    "proyectacolor.cl", "sherwin.cl", "krause.cl", "famae.cl", "disensa.cl"
]

def limpiar_nombre_producto(nombre):
    """Limpia el título de ruidos de e-commerce"""
    if not nombre: return ""
    # Eliminamos marcas de agua de texto comunes
    patrones = [
        r"(?i)despacho\s?a\s?domicilio", r"(?i)retiro\s?en\s?tienda", 
        r"(?i)stock\s?disponible", r"(?i)precio\s?normal", r"(?i)oferta",
        r"(?i)sodimac\s?chile", r"(?i)easy\s?chile", r"\|", r"-"
    ]
    for p in patrones:
        nombre = re.sub(p, "", nombre)
    return re.sub(r'\s+', ' ', nombre).strip()

def extraer_precio(texto):
    """Extrae montos numéricos de strings con formato moneda"""
    if not texto: return 0
    match = re.search(r'\$\s?([\d\.]+)', texto)
    if match:
        try:
            val = int(re.sub(r'[^\d]', '', match.group(1)))
            if 100 < val < 15000000: return val
        except: pass
    return 0

def fetch_serper_data(query, search_type="search"):
    url = f"https://google.serper.dev/{search_type}"
    payload = json.dumps({
        "q": query,
        "gl": "cl",
        "hl": "es",
        "num": 50 
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
    
    # MEJORA DE QUERY: Forzamos la búsqueda en los dominios de la lista
    # Usamos bloques de 10 proveedores para no saturar la query de Google
    query_vip = f'"{producto}" site:{ " OR site:".join(PROVEEDORES_CHILE[:10]) }'
    query_general = f'"{producto}" comprar precio chile ferreteria'
    
    final_data = []
    vistos = set()

    with ThreadPoolExecutor(max_workers=10) as executor:
        # Buscamos en 3 frentes simultáneos
        f_vip = executor.submit(fetch_serper_data, query_vip, "search")
        f_gen = executor.submit(fetch_serper_data, query_general, "search")
        f_shop = executor.submit(fetch_serper_data, producto, "shopping")
        
        results_list = [f_vip.result(), f_gen.result(), f_shop.result()]

    for data in results_list:
        # Consolidamos Shopping, Resultados Orgánicos y Mapas (Places)
        items = data.get('shopping', []) + data.get('organic', []) + data.get('places', [])
        
        for item in items:
            link = item.get('link') or item.get('website', '')
            if not link or link in vistos: continue

            # Filtro de seguridad para no traer basura
            if any(x in link.lower() for x in ['facebook', 'instagram', 'youtube', 'wikipedia']):
                continue

            title = item.get('title', 'Tienda')
            snippet = item.get('snippet', '')
            
            # Obtención de precio
            raw_price = 0
            if 'price' in item:
                try: raw_price = int(re.sub(r'[^\d]', '', str(item['price'])))
                except: raw_price = 0
            
            if raw_price == 0:
                raw_price = extraer_precio(title + " " + snippet)

            # Identificar la tienda
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
                "canal": "BUSCADOR_SISTEMA",
                "busqueda_original": origen_excel or producto
            })
            vistos.add(link)

    # Orden: Precios válidos de menor a mayor, luego los "Consultar"
    resultados_finales = sorted(
        final_data, 
        key=lambda x: (x['precio_valor'] == 0, x['precio_valor'])
    )

    return jsonify(resultados_finales[:50])

app = app

if __name__ == "__main__":
    app.run(debug=True, port=5000)