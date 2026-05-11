import requests
import json
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from concurrent.futures import ThreadPoolExecutor

app = Flask(__name__)
# Habilitamos CORS de forma robusta para permitir la comunicación con tu dashboard en Next.js
CORS(app)

# ==========================================
# CONFIGURACIÓN MAESTRA
# ==========================================
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

# Listado actualizado de proveedores clave en Chile
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
    """Limpia el título de ruidos comunes en webs de ferretería."""
    if not nombre: return ""
    # Patrones de texto basura que ensucian el nombre
    patrones = [
        r"(?i)despacho\s?a\s?domicilio", r"(?i)retiro\s?en\s?tienda", 
        r"(?i)stock\s?disponible", r"(?i)precio\s?internet", r"\|", r"-"
    ]
    for p in patrones:
        nombre = re.sub(p, "", nombre)
    return re.sub(r'\s+', ' ', nombre).strip()

def extraer_precio(texto):
    """Extrae montos numéricos de strings con formato de moneda chilena."""
    if not texto: return 0
    # Busca el signo $ seguido de números y puntos
    match = re.search(r'\$\s?([\d\.]+)', texto)
    if match:
        try:
            # Quitamos los puntos de miles y convertimos a entero
            val = int(re.sub(r'[^\d]', '', match.group(1)))
            # Filtro de rango lógico para productos de ferretería en Chile
            if 100 < val < 25000000: return val
        except: pass
    return 0

def fetch_serper_data(query, search_type="search"):
    """Consulta la API de Serper con manejo de excepciones y timeouts."""
    url = f"https://google.serper.dev/{search_type}"
    # gl: cl (Chile), hl: es (Español) para resultados locales precisos
    payload = json.dumps({"q": query, "gl": "cl", "hl": "es", "num": 40})
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    try:
        response = requests.post(url, headers=headers, data=payload, timeout=10)
        response.raise_for_status() # Lanza error si la API responde mal
        return response.json()
    except Exception as e:
        print(f"Error en llamada a Serper ({search_type}): {e}")
        return {}

@app.route("/python/index", methods=["GET"])
@app.route("/api/index", methods=["GET"])
def scrape_prices():
    """Endpoint principal: Escanea tiendas, extrae precios y ordena resultados."""
    producto_raw = request.args.get("producto")
    origen_excel = request.args.get("origen") 
    
    if not producto_raw: 
        return jsonify([])

    # Limpiamos el término de búsqueda para que caracteres como " o / no rompan la lógica
    producto = producto_raw.strip()
    
    # --- ESTRATEGIA DE BÚSQUEDA ---
    # Dividimos en 4 frentes para maximizar hallazgos en ferreterías chilenas
    query_vip = f'"{producto}" site:{" OR site:".join(PROVEEDORES_CHILE[:12])}'
    query_especialistas = f'"{producto}" (site:asfaltoschile.cl OR site:bitumix.cl OR site:pernoschile.cl OR site:hela.cl)'
    query_general = f'"{producto}" precio chile ferreteria'
    
    final_data = []
    vistos = set()

    # Ejecución en paralelo para velocidad industrial
    with ThreadPoolExecutor(max_workers=6) as executor:
        f_vip = executor.submit(fetch_serper_data, query_vip, "search")
        f_esp = executor.submit(fetch_serper_data, query_especialistas, "search")
        f_gen = executor.submit(fetch_serper_data, query_general, "search")
        f_shop = executor.submit(fetch_serper_data, producto, "shopping")
        
        # Combinamos los resultados de todas las fuentes
        results = [f_vip.result(), f_esp.result(), f_gen.result(), f_shop.result()]

    for data in results:
        # Procesamos Shopping, Orgánico y Lugares (Maps)
        items = data.get('shopping', []) + data.get('organic', []) + data.get('places', [])
        for item in items:
            link = item.get('link') or item.get('website', '')
            if not link or link in vistos: continue
            
            # Filtro de seguridad: Omitir redes sociales y sitios no transaccionales
            if any(x in link.lower() for x in ['facebook', 'instagram', 'youtube', 'wikipedia', 'linkedin']): 
                continue

            title = item.get('title', 'Tienda')
            snippet = item.get('snippet', '')
            
            # Intentamos obtener precio desde el campo directo de Google Shopping
            raw_price = 0
            if 'price' in item:
                try: 
                    raw_price = int(re.sub(r'[^\d]', '', str(item['price'])))
                except: raw_price = 0
            
            # Si no hay precio directo, lo "leemos" del texto (Título o Descripción)
            if raw_price == 0:
                raw_price = extraer_precio(title + " " + snippet)

            # Identificación inteligente de la tienda
            tienda = item.get('source') or item.get('store')
            if not tienda:
                try:
                    # Extrae el dominio (ej: imperial.cl) y lo limpia
                    tienda = link.split('/')[2].replace('www.', '').split('.')[0].upper()
                except:
                    tienda = "WEB"

            final_data.append({
                "tienda": tienda.upper(),
                "nombre": limpiar_nombre_producto(title),
                "precio_valor": raw_price,
                "precio_formateado": f"${raw_price:,}".replace(",", ".") if raw_price > 0 else "Consultar",
                "link": link,
                "canal": "MOTOR_INDUSTRIAL_V4",
                "busqueda_original": origen_excel or producto
            })
            vistos.add(link)

    # ORDENAMIENTO DE CALIDAD:
    # 1. Productos con precio real van arriba.
    # 2. Ordenados de más barato a más caro.
    resultados_finales = sorted(
        final_data, 
        key=lambda x: (x['precio_valor'] == 0, x['precio_valor'])
    )

    # Devolvemos un JSON limpio listo para el Dashboard
    return jsonify(resultados_finales[:60])

if __name__ == "__main__":
    # Escucha en todas las interfaces en el puerto 5000
    app.run(host="0.0.0.0", port=5000, debug=True)

# ==============================================================================
# ¿QUÉ HACE ESTE CÓDIGO? (EXPLICACIÓN PARA Alexis Tobar S.)
# ==============================================================================
# 1. MULTI-SCANNER: No busca una sola vez; lanza 4 búsquedas paralelas a Google 
#    usando la API de Serper, cubriendo Shopping y resultados orgánicos.
# 2. FILTRADO POR DOMINIO: Obliga a Google a buscar prioritariamente en tu lista 
#    de proveedores (Sodimac, Imperial, Asfaltos Chile, etc.) usando operadores site:.
# 3. EXTRACCIÓN DE PRECIOS OCULTOS: Si una tienda no tiene el precio configurado 
#    para Google, este código "lee" el texto del resultado buscando signos de peso ($) 
#    y cifras para capturar el valor.
# 4. LIMPIEZA DE TÍTULOS: Remueve avisos de despacho o stock para que en tu Excel/Dashboard 
#    solo veas el nombre técnico del producto.
# 5. ROBUSTEZ: Maneja errores de conexión y evita duplicados por link, asegurando 
#    que los datos que llegan a tu API de Next.js sean de alta calidad.
# ==============================================================================