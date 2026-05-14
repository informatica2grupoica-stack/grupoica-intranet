import re
import time
import random
import requests
import json
from difflib import SequenceMatcher
from flask import Flask, request, jsonify
from flask_cors import CORS
from concurrent.futures import ThreadPoolExecutor, as_completed

app = Flask(__name__)
CORS(app)

IVA = 1.19
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

# ==========================================
# NORMALIZACIÓN Y MATCHING
# ==========================================

def normalizar(texto):
    if not texto:
        return ""
    texto = texto.lower()
    texto = re.sub(r'([a-záéíóúñ])\s+(\d)', r'\1\2', texto)
    texto = re.sub(r'(\d)\s+([a-záéíóúñ])', r'\1\2', texto)
    texto = re.sub(r'[^\w\s]', ' ', texto)
    texto = re.sub(r'\s+', ' ', texto).strip()
    return texto

def calcular_concordancia(buscado: str, encontrado: str) -> int:
    b = normalizar(buscado)
    e = normalizar(encontrado)
    if not b or not e:
        return 0

    seq = SequenceMatcher(None, b, e).ratio()
    palabras_b = set(b.split())
    palabras_e = set(e.split())
    cobertura = len(palabras_b & palabras_e) / len(palabras_b) if palabras_b else 0

    nums_b = set(re.findall(r'\b[\w]*\d+[\w]*\b', b))
    nums_e = set(re.findall(r'\b[\w]*\d+[\w]*\b', e))
    if nums_b:
        num_match = len(nums_b & nums_e) / len(nums_b)
    else:
        num_match = 0.6

    score = (seq * 0.35 + cobertura * 0.40 + num_match * 0.25) * 100
    return round(min(100, max(0, score)))

def clasificar_concordancia(score: int):
    if score >= 85:
        return "exacta", "✅ Coincidencia exacta"
    elif score >= 60:
        return "parcial", "🟡 Coincidencia parcial"
    else:
        return "bajo", "🔴 Baja coincidencia"

# ==========================================
# MERCADOLIBRE (API pública)
# ==========================================

def buscar_mercadolibre(producto: str, limite: int = 10):
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
            resultados.append({
                "tienda": "MercadoLibre",
                "nombre": item.get("title", ""),
                "precio_con_iva": round(precio),
                "url": item.get("permalink", ""),
                "fuente": "mercadolibre",
            })
        return resultados
    except Exception as e:
        print(f"  [ML] Error: {e}")
        return []

# ==========================================
# SERPER API (Google Shopping)
# ==========================================

def fetch_serper_data(query, search_type="shopping"):
    url = f"https://google.serper.dev/{search_type}"
    payload = json.dumps({"q": query, "gl": "cl", "hl": "es", "num": 30})
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    
    try:
        response = requests.post(url, headers=headers, data=payload, timeout=12)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"  [Serper] Error HTTP: {response.status_code}")
            return {}
    except Exception as e:
        print(f"  [Serper] Error: {e}")
        return {}

def buscar_google_serper(producto: str, limite: int = 15):
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
            
            resultados.append({
                "tienda": item.get('source', 'Google Shopping'),
                "nombre": item.get('title', ''),
                "precio_con_iva": precio,
                "url": item.get('link', ''),
                "fuente": "google_shopping",
            })
        return resultados
    except Exception as e:
        print(f"  [Serper] Error: {e}")
        return []

# ==========================================
# FUNCIÓN PRINCIPAL DE BÚSQUEDA
# ==========================================

def realizar_busqueda(producto: str, minimo: int = 9):
    resultados = []
    
    print(f"  📡 Buscando en MercadoLibre...")
    resultados.extend(buscar_mercadolibre(producto, minimo))
    
    if len(resultados) < minimo:
        print(f"  📡 Buscando en Google Shopping (Serper)...")
        time.sleep(random.uniform(0.5, 1))
        resultados.extend(buscar_google_serper(producto, minimo))
    
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
    
    # Ordenar por score descendente
    resultados.sort(key=lambda x: (-x["score"], x["precio_con_iva"]))
    
    return resultados

# ==========================================
# ENDPOINTS
# ==========================================

@app.route("/python/busqueda-robusta", methods=["GET"])
def busqueda_robusta():
    producto = request.args.get("producto", "").strip()
    numero_item = request.args.get("numero", "")
    minimo_requerido = int(request.args.get("minimo", 9))
    
    print("\n" + "=" * 60)
    print(f"🔍 [{numero_item}] {producto}")
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
    
    resultados = realizar_busqueda(producto, minimo_requerido)
    
    # Transformar al formato legacy (compatible con frontend)
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
    
    print(f"📊 Total: {len(resultados_legacy)} resultados")
    print(f"✅ Suficiente: {tiene_suficientes}")
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
    if hasattr(resultado, 'get_json'):
        data = resultado.get_json()
        return jsonify(data.get("resultados", []))
    return jsonify([])

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "mensaje": "Backend funcionando con Serper + MercadoLibre"})

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 BUSCADOR MEJORADO - GRUPO ICA")
    print("=" * 60)
    print("✅ Fuentes de datos:")
    print("   - MercadoLibre API (gratis)")
    print("   - Google Shopping (vía Serper)")
    print("✅ Matching inteligente con score 0-100%")
    print("✅ Colores: 🟢 Exacto (85%+) | 🟡 Parcial (60-84%) | 🔴 Bajo (<60%)")
    print("=" * 60)
    print("📍 Servidor: http://localhost:5000")
    print("📍 Endpoint: /python/busqueda-robusta")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)