import re
import time
import random
import requests
import json
from difflib import SequenceMatcher
from flask import Flask, request, jsonify
from flask_cors import CORS
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
from urllib.parse import quote

app = Flask(__name__)
CORS(app)

IVA = 1.19
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

# ==========================================
# CACHÉ EN MEMORIA
# ==========================================
cache_resultados = {}
CACHE_TTL = 300  # 5 minutos

def get_cache_key(producto, limite):
    return f"{producto}_{limite}"

def limpiar_cache_expirado():
    ahora = time.time()
    expirados = [k for k, v in cache_resultados.items() if ahora - v['timestamp'] > CACHE_TTL]
    for k in expirados:
        del cache_resultados[k]

# ==========================================
# SITIOS CHILENOS POR CATEGORÍA
# ==========================================

# Sitios principales (siempre buscar)
SITIOS_PRINCIPALES = [
    "sodimac.cl", "easy.cl", "imperial.cl", "construmart.cl",
    "trentini.cl", "hela.cl", "yolito.cl", "chilemat.com",
    "makita.cl", "dewalt.cl", "bosch-professional.com", "indura.cl",
    "ferreteriaohiggins.cl", "mts.cl", "dabed.cl", "weitzler.cl"
]

# Sitios de construcción y materiales
SITIOS_CONSTRUCCION = [
    "arauco.cl", "volcan.cl", "pizarreño.cl", "sipesa.cl",
    "cintac.cl", "kupfer.cl", "prodalam.cl", "madepa.cl",
    "pernoschile.cl", "fijaciones.cl", "mamut.cl", "asfaltoschile.cl",
    "bitumix.cl", "dynal.cl", "sika.com", "texsa.cl",
    "ferreteriasindustrial.cl", "amanecer.cl"
]

# Sitios de maquinaria pesada y agrícola
SITIOS_MAQUINARIA = [
    "dercomaq.cl", "maqsa.cl", "tractochile.cl", "agrocenter.cl",
    "ferritotal.cl", "importadoraagro.cl", "sky.cl", "caserones.cl",
    "agrozzi.cl", "agroaldia.cl", "maquinariaagricola.cl", "tractoreschile.cl"
]

# Sitios de herramientas eléctricas
SITIOS_HERRAMIENTAS = [
    "ferremax.cl", "ferreteria.cl", "ferreteriaonline.cl",
    "ferreteriaindustrial.cl", "ferreteriacasablanca.cl", "ferreteriasantiago.cl"
]

# Unificar todos los sitios chilenos
SITIOS_CHILE = list(set(SITIOS_PRINCIPALES + SITIOS_CONSTRUCCION + SITIOS_MAQUINARIA + SITIOS_HERRAMIENTAS))

# Palabras clave para filtrar resultados de eBay y sitios extranjeros
DOMINIOS_EXTRANJEROS = [
    'ebay.com', 'ebay.', 'amazon.com', 'amazon.', 'aliexpress', 'walmart',
    'homedepot', 'lowes', 'wish.com', 'temu.com', 'mercado.com', 'etsy.com'
]

def es_sitio_chileno(url: str) -> bool:
    """Verifica si la URL es de un sitio chileno (dominio .cl o en lista blanca)"""
    if not url:
        return False
    url_lower = url.lower()
    # Permitir solo dominios .cl o sitios chilenos conocidos
    if '.cl' in url_lower:
        return True
    for sitio in SITIOS_CHILE:
        if sitio in url_lower:
            return True
    return False

def filtrar_resultados_chilenos(resultados: list) -> list:
    """Filtra resultados para mantener solo sitios chilenos"""
    filtrados = []
    for r in resultados:
        url = r.get('url', '').lower()
        tienda = r.get('tienda', '').lower()
        
        # Verificar si es un dominio extranjero
        es_extranjero = False
        for dominio in DOMINIOS_EXTRANJEROS:
            if dominio in url or dominio in tienda:
                es_extranjero = True
                break
        
        if not es_extranjero and ('.cl' in url or es_sitio_chileno(url)):
            filtrados.append(r)
        else:
            print(f"  🔴 Filtrado resultado extranjero: {tienda} - {url[:50]}")
    
    return filtrados

# ==========================================
# NORMALIZACIÓN Y MATCHING MEJORADO
# ==========================================

@lru_cache(maxsize=1000)
def normalizar(texto):
    if not texto:
        return ""
    texto = texto.lower()
    texto = re.sub(r'([a-záéíóúñ])\s+(\d)', r'\1\2', texto)
    texto = re.sub(r'(\d)\s+([a-záéíóúñ])', r'\1\2', texto)
    texto = re.sub(r'(\d+)\s+(\d+)\/(\d+)', r'\1.\2/\3', texto)
    texto = re.sub(r'[^\w\s\/]', ' ', texto)
    texto = re.sub(r'\s+', ' ', texto).strip()
    return texto

def extraer_medida(texto):
    texto = texto.lower()
    frac = re.search(r'(\d+)\/(\d+)', texto)
    if frac:
        return float(frac.group(1)) / float(frac.group(2))
    entero = re.search(r'(\d+(?:\.\d+)?)\s*(?:"|pulg|inch|mm|cm|mt|m)', texto)
    if entero:
        return float(entero.group(1))
    simple = re.search(r'(\d+(?:\.\d+)?)', texto)
    if simple:
        return float(simple.group(1))
    return None

def calcular_concordancia(buscado: str, encontrado: str) -> int:
    b = normalizar(buscado)
    e = normalizar(encontrado)
    if not b or not e:
        return 0

    seq = SequenceMatcher(None, b, e).ratio()
    palabras_b = set(b.split())
    palabras_e = set(e.split())
    cobertura = len(palabras_b & palabras_e) / len(palabras_b) if palabras_b else 0

    nums_b = set(re.findall(r'\b[\w]*\d+(?:/\d+)?[\w]*\b', b))
    nums_e = set(re.findall(r'\b[\w]*\d+(?:/\d+)?[\w]*\b', e))
    num_match = len(nums_b & nums_e) / len(nums_b) if nums_b else 0.6

    medida_b = extraer_medida(buscado)
    medida_e = extraer_medida(encontrado)
    medida_bonus = 0.10 if (medida_b and medida_e and abs(medida_b - medida_e) < 0.1) else 0

    score = (seq * 0.30 + cobertura * 0.35 + num_match * 0.20 + medida_bonus) * 100
    return round(min(100, max(0, score)))

def clasificar_concordancia(score: int):
    if score >= 85: return "exacta", "✅ Coincidencia exacta"
    elif score >= 60: return "parcial", "🟡 Coincidencia parcial"
    elif score >= 35: return "baja", "🟠 Baja coincidencia"
    else: return "nula", "🔴 Sin coincidencia"

# ==========================================
# MERCADOLIBRE (solo Chile)
# ==========================================

def buscar_mercadolibre(producto: str, limite: int = 10):
    limpiar_cache_expirado()
    cache_key = get_cache_key(f"ml_{producto}", limite)
    
    if cache_key in cache_resultados:
        print(f"  📦 [ML] Cache hit: {producto}")
        return cache_resultados[cache_key]['data']
    
    try:
        url = "https://api.mercadolibre.com/sites/MLC/search"
        params = {"q": producto, "limit": limite, "condition": "new"}
        r = requests.get(url, params=params, timeout=10)
        if r.status_code != 200:
            return []

        resultados = []
        for item in r.json().get("results", []):
            precio = item.get("price", 0)
            if precio <= 0:
                continue
            
            nombre = item.get("title", "")
            nombre = re.sub(r'\s*\|\s*.*$', '', nombre)
            nombre = re.sub(r'\s*MercadoLibre.*$', '', nombre, flags=re.IGNORECASE)
            nombre = nombre.strip()
            
            if len(nombre) < 5:
                continue
                
            resultados.append({
                "tienda": "MercadoLibre",
                "nombre": nombre[:120],
                "precio_con_iva": round(precio),
                "url": item.get("permalink", ""),
                "fuente": "mercadolibre",
            })
        
        cache_resultados[cache_key] = {'data': resultados, 'timestamp': time.time()}
        return resultados
    except Exception as e:
        print(f"  [ML] Error: {e}")
        return []

# ==========================================
# SERPER API (solo sitios chilenos)
# ==========================================

def fetch_serper_data(query, search_type="search", retries=2):
    url = f"https://google.serper.dev/{search_type}"
    payload = json.dumps({"q": query, "gl": "cl", "hl": "es", "num": 30})
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    
    for intento in range(retries):
        try:
            response = requests.post(url, headers=headers, data=payload, timeout=12)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"  [Serper] Intento {intento+1}: status {response.status_code}")
                time.sleep(1)
        except Exception as e:
            print(f"  [Serper] Intento {intento+1}: {e}")
            time.sleep(1)
    return {}

def buscar_google_serper(producto: str, limite: int = 15):
    limpiar_cache_expirado()
    cache_key = get_cache_key(f"gs_{producto}", limite)
    
    if cache_key in cache_resultados:
        print(f"  📦 [GS] Cache hit: {producto}")
        return cache_resultados[cache_key]['data']
    
    resultados = []
    
    # 1. Buscar en shopping de Google (limitado a Chile)
    data_shopping = fetch_serper_data(f"{producto} Chile", "shopping")
    items = data_shopping.get('shopping', [])
    
    for item in items[:limite]:
        url = item.get('link', '')
        if not es_sitio_chileno(url):
            continue
            
        raw_price = item.get('price', '')
        if not raw_price:
            continue
        
        precio_num = re.sub(r'[^\d]', '', str(raw_price))
        if not precio_num:
            continue
        
        try:
            precio = int(precio_num)
            if precio <= 500 or precio > 200_000_000:
                continue
        except:
            continue
        
        nombre = item.get('title', '')
        nombre = re.sub(r'\s*\|\s*.*$', '', nombre)
        nombre = re.sub(r'\s*Envío gratis.*$', '', nombre, flags=re.IGNORECASE)
        nombre = nombre.strip()
        
        if len(nombre) < 5:
            continue
        
        tienda = item.get('source', '')
        if not tienda:
            try:
                tienda = url.split('/')[2].replace('www.', '').split('.')[0].upper()
            except:
                tienda = "TIENDA"
        
        resultados.append({
            "tienda": tienda[:30],
            "nombre": nombre[:120],
            "precio_con_iva": precio,
            "url": url,
            "fuente": "google_shopping",
        })
    
    # 2. Si hay pocos resultados, buscar en sitios específicos
    if len(resultados) < 5:
        for sitio in SITIOS_CHILE[:10]:
            query_sitio = f"site:{sitio} {producto} precio"
            data_sitio = fetch_serper_data(query_sitio, "search")
            
            for item in data_sitio.get('organic', [])[:3]:
                url = item.get('link', '')
                if not url or not es_sitio_chileno(url):
                    continue
                
                precio = extraer_precio_texto(item.get('snippet', '') + " " + item.get('title', ''))
                if precio == 0:
                    continue
                
                nombre = item.get('title', '')[:120]
                tienda = sitio.replace('.cl', '').upper()
                
                resultados.append({
                    "tienda": tienda[:30],
                    "nombre": nombre,
                    "precio_con_iva": precio,
                    "url": url,
                    "fuente": "google_search",
                })
            
            time.sleep(0.3)
    
    # Eliminar duplicados por URL
    resultados_unicos = []
    urls_vistas = set()
    for r in resultados:
        if r['url'] not in urls_vistas:
            resultados_unicos.append(r)
            urls_vistas.add(r['url'])
    
    cache_resultados[cache_key] = {'data': resultados_unicos, 'timestamp': time.time()}
    return resultados_unicos[:limite]

def extraer_precio_texto(texto):
    """Extrae precio de un texto usando regex"""
    if not texto:
        return 0
    match = re.search(r'\$\s?([\d\.]+)', texto)
    if match:
        try:
            val = int(re.sub(r'[^\d]', '', match.group(1)))
            if 500 < val < 200_000_000:
                return val
        except:
            pass
    return 0

# ==========================================
# EXPANSIÓN DE BÚSQUEDA CON SINÓNIMOS
# ==========================================

def expandir_busqueda(producto: str, limite: int = 5):
    """Genera variaciones y sinónimos para productos"""
    
    # Diccionario de sinónimos para construcción/ferretería
    sinonimos = {
        'clavo': ['clavos', 'clavo acero', 'clavo galvanizado'],
        'tornillo': ['tornillos', 'tornillo autoperforante', 'tornillo volcanita'],
        'madera': ['pino', 'madera pino', 'terciado', 'tabla'],
        'cemento': ['cemento saco', 'cemento 25kg', 'cemento blanco'],
        'arena': ['arena gruesa', 'arena fina', 'arena construcción'],
        'grava': ['gravilla', 'piedra', 'ripio'],
        'pintura': ['esmalte', 'latex', 'pintura muro', 'anticorrosivo'],
        'martillo': ['martillo carpintero', 'martillo demoledor', 'combo'],
        'taladro': ['taladro percutor', 'taladro inalámbrico', 'rotomartillo'],
        'sierra': ['sierra circular', 'sierra caladora', 'sierra eléctrica'],
        'fierro': ['fierro estriado', 'varilla', 'acero'],
        'perno': ['perno de anclaje', 'perno expansivo', 'bulon'],
    }
    
    # Buscar sinónimos si aplica
    palabras = producto.lower().split()
    variaciones = [producto]
    
    for palabra in palabras:
        if palabra in sinonimos:
            for sin in sinonimos[palabra]:
                nueva_var = producto.lower().replace(palabra, sin)
                if nueva_var != producto.lower():
                    variaciones.append(nueva_var)
    
    # Agregar variaciones de medida
    variaciones.append(f"{producto} chile")
    variaciones.append(f"comprar {producto}")
    
    # Eliminar duplicados
    variaciones = list(dict.fromkeys([v for v in variaciones if v and len(v) > 5]))
    
    resultados_extra = []
    for var in variaciones[:5]:
        print(f"  📡 Variación: {var[:50]}...")
        time.sleep(random.uniform(0.3, 0.6))
        resultados_extra.extend(buscar_google_serper(var, limite))
    
    return resultados_extra

# ==========================================
# FUNCIÓN PRINCIPAL DE BÚSQUEDA
# ==========================================

def realizar_busqueda(producto: str, minimo: int = 9):
    resultados = []
    
    print(f"  📡 Buscando en MercadoLibre Chile...")
    ml_resultados = buscar_mercadolibre(producto, minimo)
    resultados.extend(ml_resultados)
    print(f"  📊 ML: {len(ml_resultados)} resultados")
    
    if len(resultados) < 5:
        print(f"  📡 Buscando en sitios chilenos...")
        time.sleep(random.uniform(0.3, 0.6))
        gs_resultados = buscar_google_serper(producto, minimo)
        # Filtrar solo sitios chilenos
        gs_resultados = [r for r in gs_resultados if es_sitio_chileno(r.get('url', ''))]
        resultados.extend(gs_resultados)
        print(f"  📊 Google: {len(gs_resultados)} resultados chilenos")
    
    # Expansión si hay menos de 9 resultados
    if len(resultados) < minimo:
        print(f"  📡 Expandiendo búsqueda con variaciones...")
        extra_resultados = expandir_busqueda(producto, minimo - len(resultados))
        urls_existentes = {r.get('url', '') for r in resultados}
        for r in extra_resultados:
            if r.get('url') not in urls_existentes and es_sitio_chileno(r.get('url', '')):
                resultados.append(r)
                urls_existentes.add(r.get('url'))
        print(f"  📊 Extra: {len([r for r in extra_resultados if es_sitio_chileno(r.get('url', ''))])} nuevos")
    
    if not resultados:
        return []
    
    # Calcular concordancia
    for r in resultados:
        score = calcular_concordancia(producto, r["nombre"])
        nivel, etiqueta = clasificar_concordancia(score)
        r["score"] = score
        r["nivel_concordancia"] = nivel
        r["etiqueta_concordancia"] = etiqueta
        r["precio_neto"] = round(r["precio_con_iva"] / IVA)
        r["precio_formateado"] = f"${r['precio_con_iva']:,.0f}".replace(",", ".")
    
    # Ordenar por score y precio
    resultados.sort(key=lambda x: (-x["score"], x["precio_con_iva"]))
    
    return resultados[:minimo * 2]

# ==========================================
# ENDPOINTS
# ==========================================

@app.route("/python/busqueda-robusta", methods=["GET"])
def busqueda_robusta():
    producto = request.args.get("producto", "").strip()
    numero_item = request.args.get("numero", "")
    minimo_requerido = int(request.args.get("minimo", 9))
    force_refresh = request.args.get("force", "").lower() == "true"
    
    print("\n" + "=" * 60)
    print(f"🔍 [{numero_item}] {producto}")
    print(f"🎯 Mínimo: {minimo_requerido}")
    print("=" * 60)
    
    if not producto:
        return jsonify({
            "numero_item": numero_item,
            "producto": producto,
            "resultados": [],
            "total_encontrados": 0,
            "suficientes": False,
            "deficit": minimo_requerido
        })
    
    if force_refresh:
        cache_keys = [k for k in cache_resultados.keys() if producto in k]
        for k in cache_keys:
            del cache_resultados[k]
        print(f"  🔄 Cache limpiado para: {producto}")
    
    resultados = realizar_busqueda(producto, minimo_requerido)
    
    resultados_legacy = []
    for r in resultados:
        resultados_legacy.append({
            "tienda": r.get("tienda", ""),
            "nombre": r.get("nombre", ""),
            "precio_valor": r.get("precio_con_iva", 0),
            "precio_formateado": r.get("precio_formateado", "Consultar"),
            "link": r.get("url", ""),
            "canal": r.get("fuente", "web"),
            "busqueda_original": producto,
            "score": r.get("score", 0),
            "nivel_concordancia": r.get("nivel_concordancia", ""),
            "etiqueta_concordancia": r.get("etiqueta_concordancia", "")
        })
    
    tiene_suficientes = len(resultados_legacy) >= minimo_requerido
    
    print(f"\n📊 TOTAL: {len(resultados_legacy)} resultados (solo sitios chilenos)")
    print(f"✅ Suficiente: {tiene_suficientes}")
    if resultados_legacy:
        print(f"🏆 Mejor: {resultados_legacy[0]['tienda']} - ${resultados_legacy[0]['precio_valor']:,} ({resultados_legacy[0].get('score', 0)}%)")
    print("=" * 60)
    
    return jsonify({
        "numero_item": numero_item,
        "producto": producto,
        "resultados": resultados_legacy,
        "total_encontrados": len(resultados_legacy),
        "suficientes": tiene_suficientes,
        "deficit": max(0, minimo_requerido - len(resultados_legacy)),
        "tipo_producto": {
            "maquinaria_pesada": False,
            "herramienta_electrica": False,
            "material_construccion": False,
            "articulo_pequeno": False
        }
    })

@app.route("/python/index", methods=["GET"])
def scrape_prices():
    producto = request.args.get("producto", "").strip()
    if not producto:
        return jsonify([])
    
    resultado = busqueda_robusta()
    return jsonify(resultado.get_json().get("resultados", []))

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "cache_size": len(cache_resultados),
        "sitios_chilenos_configurados": len(SITIOS_CHILE)
    })

@app.route("/python/cache/clear", methods=["POST"])
def clear_cache():
    cache_resultados.clear()
    return jsonify({"status": "ok", "mensaje": "Caché limpiado"})

if __name__ == "__main__":
    print("=" * 70)
    print("🚀 BUSCADOR ROBUSTO - SOLO SITIOS CHILENOS")
    print("=" * 70)
    print("✅ Sitios configurados:")
    print(f"   - Principales: {len(SITIOS_PRINCIPALES)}")
    print(f"   - Construcción: {len(SITIOS_CONSTRUCCION)}")
    print(f"   - Maquinaria: {len(SITIOS_MAQUINARIA)}")
    print(f"   - Total: {len(SITIOS_CHILE)} sitios chilenos")
    print("=" * 70)
    print("🔒 Filtros activos:")
    print("   - No se muestran resultados de eBay")
    print("   - No se muestran resultados de Amazon")
    print("   - No se muestran resultados de AliExpress")
    print("   - Solo dominios .cl y sitios chilenos conocidos")
    print("=" * 70)
    app.run(host="0.0.0.0", port=5000, debug=True)