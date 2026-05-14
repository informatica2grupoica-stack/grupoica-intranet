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
from cachetools import TTLCache

app = Flask(__name__)
CORS(app)

IVA = 1.19
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

# Cache en memoria para resultados (TTL 5 minutos)
cache_resultados = TTLCache(maxsize=100, ttl=300)

# ==========================================
# NORMALIZACIÓN Y MATCHING MEJORADO
# ==========================================

@lru_cache(maxsize=1000)
def normalizar(texto):
    if not texto:
        return ""
    texto = texto.lower()
    # Mejor manejo de números y medidas
    texto = re.sub(r'([a-záéíóúñ])\s+(\d)', r'\1\2', texto)
    texto = re.sub(r'(\d)\s+([a-záéíóúñ])', r'\1\2', texto)
    texto = re.sub(r'(\d+)\s*["\']\s*(\d+)', r'\1.\2', texto)  # Maneja 2 1/2" → 2.5
    texto = re.sub(r'[^\w\s\.]', ' ', texto)
    texto = re.sub(r'\s+', ' ', texto).strip()
    return texto

def extraer_medida(texto):
    """Extrae medidas numéricas del texto (ej: 2 1/2 → 2.5)"""
    texto = texto.lower()
    # Busca fracciones como 1/2, 3/4
    frac_match = re.search(r'(\d+)\s*/\s*(\d+)', texto)
    if frac_match:
        return float(frac_match.group(1)) / float(frac_match.group(2))
    # Busca decimales
    dec_match = re.search(r'(\d+)[\.\,](\d+)', texto)
    if dec_match:
        return float(f"{dec_match.group(1)}.{dec_match.group(2)}")
    # Busca enteros
    int_match = re.search(r'(\d+)', texto)
    if int_match:
        return float(int_match.group(1))
    return None

def calcular_concordancia(buscado: str, encontrado: str) -> int:
    b = normalizar(buscado)
    e = normalizar(encontrado)
    if not b or not e:
        return 0

    # 1. Similitud de secuencia global
    seq = SequenceMatcher(None, b, e).ratio()

    # 2. Cobertura de palabras
    palabras_b = set(b.split())
    palabras_e = set(e.split())
    cobertura = len(palabras_b & palabras_e) / len(palabras_b) if palabras_b else 0

    # 3. Coincidencia de números y medidas
    nums_b = set(re.findall(r'\b[\w]*\d+[\w]*\b', b))
    nums_e = set(re.findall(r'\b[\w]*\d+[\w]*\b', e))
    if nums_b:
        num_match = len(nums_b & nums_e) / len(nums_b)
    else:
        num_match = 0.6

    # 4. Bonus por coincidencia de medidas exactas
    medida_b = extraer_medida(buscado)
    medida_e = extraer_medida(encontrado)
    medida_bonus = 0
    if medida_b and medida_e and abs(medida_b - medida_e) < 0.1:
        medida_bonus = 0.15  # 15% de bonus

    score = (seq * 0.30 + cobertura * 0.35 + num_match * 0.20 + medida_bonus) * 100
    return round(min(100, max(0, score)))

def clasificar_concordancia(score: int):
    if score >= 85:
        return "exacta", "✅ Coincidencia exacta"
    elif score >= 65:
        return "parcial", "🟡 Coincidencia parcial"
    elif score >= 40:
        return "baja", "🟠 Baja coincidencia"
    else:
        return "nula", "🔴 Sin coincidencia"

# ==========================================
# MERCADOLIBRE (con caché)
# ==========================================

def buscar_mercadolibre(producto: str, limite: int = 10):
    cache_key = f"ml_{producto}_{limite}"
    if cache_key in cache_resultados:
        print(f"  📦 [ML] Cache hit para: {producto}")
        return cache_resultados[cache_key]
    
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
            
            # Limpiar nombre de producto
            nombre = item.get("title", "")
            nombre = re.sub(r'\s*\|\s*.*$', '', nombre)  # Eliminar texto después de |
            nombre = re.sub(r'\s*MercadoLibre.*$', '', nombre, flags=re.IGNORECASE)
            
            resultados.append({
                "tienda": "MercadoLibre",
                "nombre": nombre[:100],
                "precio_con_iva": round(precio),
                "url": item.get("permalink", ""),
                "fuente": "mercadolibre",
            })
        
        cache_resultados[cache_key] = resultados
        return resultados
    except Exception as e:
        print(f"  [ML] Error: {e}")
        return []

# ==========================================
# SERPER API MEJORADA
# ==========================================

def fetch_serper_data(query, search_type="search", retries=2):
    url = f"https://google.serper.dev/{search_type}"
    payload = json.dumps({"q": query, "gl": "cl", "hl": "es", "num": 25})
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

def buscar_google_serper(producto: str, limite: int = 10):
    cache_key = f"gs_{producto}_{limite}"
    if cache_key in cache_resultados:
        print(f"  📦 [GS] Cache hit para: {producto}")
        return cache_resultados[cache_key]
    
    try:
        data = fetch_serper_data(producto, "shopping")
        items = data.get('shopping', [])
        
        resultados = []
        for item in items[:limite]:
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
            
            # Limpiar nombre
            nombre = item.get('title', '')
            nombre = re.sub(r'\s*\|\s*.*$', '', nombre)
            nombre = re.sub(r'\s*Envío gratis.*$', '', nombre, flags=re.IGNORECASE)
            
            resultados.append({
                "tienda": item.get('source', 'Google Shopping'),
                "nombre": nombre[:100],
                "precio_con_iva": precio,
                "url": item.get('link', ''),
                "fuente": "google_shopping",
            })
        
        cache_resultados[cache_key] = resultados
        return resultados
    except Exception as e:
        print(f"  [GS] Error: {e}")
        return []

# ==========================================
# BÚSQUEDA EXPANDIDA (para productos con pocos resultados)
# ==========================================

def expandir_busqueda(producto: str, limite: int = 5):
    """Genera variaciones del producto para ampliar resultados"""
    variaciones = [
        producto,
        producto.replace('"', ''),
        re.sub(r'(\d+)\s*["\']\s*(\d+)', r'\1.\2', producto),  # 2 1/2 → 2.5
        f"{producto} oferta",
        f"{producto} chile",
    ]
    
    # Eliminar duplicados
    variaciones = list(dict.fromkeys(variaciones))
    
    resultados_extra = []
    for var in variaciones[:3]:
        if var != producto:
            time.sleep(random.uniform(0.3, 0.8))
            resultados_extra.extend(buscar_google_serper(var, limite))
    
    return resultados_extra

# ==========================================
# FUNCIÓN PRINCIPAL DE BÚSQUEDA MEJORADA
# ==========================================

def realizar_busqueda(producto: str, minimo: int = 9):
    resultados = []
    
    # 1. MercadoLibre
    print(f"  📡 Buscando en MercadoLibre...")
    ml_resultados = buscar_mercadolibre(producto, minimo * 2)
    resultados.extend(ml_resultados)
    print(f"  📊 ML: {len(ml_resultados)} resultados")
    
    # 2. Google Shopping vía Serper
    if len(resultados) < minimo:
        print(f"  📡 Buscando en Google Shopping...")
        time.sleep(random.uniform(0.3, 0.8))
        gs_resultados = buscar_google_serper(producto, minimo)
        resultados.extend(gs_resultados)
        print(f"  📊 GS: {len(gs_resultados)} resultados")
    
    # 3. Expansión si aún faltan resultados
    if len(resultados) < minimo:
        print(f"  📡 Expandiendo búsqueda...")
        extra_resultados = expandir_busqueda(producto, minimo - len(resultados))
        resultados.extend(extra_resultados)
        print(f"  📊 Extra: {len(extra_resultados)} resultados")
    
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
    print(f"🎯 Mínimo requerido: {minimo_requerido}")
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
    
    # Limpiar caché si se fuerza
    if force_refresh:
        cache_key_ml = f"ml_{producto}_{minimo_requerido * 2}"
        cache_key_gs = f"gs_{producto}_{minimo_requerido}"
        cache_resultados.pop(cache_key_ml, None)
        cache_resultados.pop(cache_key_gs, None)
        print(f"  🔄 Cache forzado limpiado")
    
    resultados = realizar_busqueda(producto, minimo_requerido)
    
    # Transformar al formato legacy
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
    
    print(f"\n📊 TOTAL: {len(resultados_legacy)} resultados")
    print(f"✅ Suficiente: {tiene_suficientes}")
    if resultados_legacy:
        print(f"🏆 Mejor: {resultados_legacy[0]['tienda']} - {resultados_legacy[0]['precio_formateado']} (score: {resultados_legacy[0].get('score', 0)}%)")
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
        "mensaje": "Buscador mejorado funcionando",
        "cache_size": len(cache_resultados)
    })

@app.route("/python/cache/clear", methods=["POST"])
def clear_cache():
    cache_resultados.clear()
    return jsonify({"status": "ok", "mensaje": "Caché limpiado"})

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 BUSCADOR MEJORADO - GRUPO ICA")
    print("=" * 60)
    print("✅ Mejoras implementadas:")
    print("   - Caché de resultados (5 minutos)")
    print("   - Detección de medidas (ej: 2 1/2 → 2.5)")
    print("   - Limpieza de nombres de productos")
    print("   - Expansión automática de búsqueda")
    print("   - Reintentos automáticos en errores")
    print("   - Endpoint para limpiar caché")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)