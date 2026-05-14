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

def fetch_serper_data(query, search_type="search"):
    url = f"https://google.serper.dev/{search_type}"
    payload = json.dumps({"q": query, "gl": "cl", "hl": "es", "num": 20})
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    try:
        response = requests.post(url, headers=headers, data=payload, timeout=10)
        return response.json()
    except:
        return {}

def buscar_google_serper(producto: str, limite: int = 10):
    try:
        data = fetch_serper_data(producto, "shopping")
        items = data.get('shopping', [])
        
        resultados = []
        for item in items[:limite]:
            precio = item.get('price', '')
            precio_num = re.sub(r'[^\d]', '', str(precio))
            if not precio_num:
                continue
            
            resultados.append({
                "tienda": item.get('source', 'Google Shopping'),
                "nombre": item.get('title', ''),
                "precio_con_iva": int(precio_num),
                "url": item.get('link', ''),
                "fuente": "google_shopping",
            })
        return resultados
    except Exception as e:
        print(f"  [GS] Error: {e}")
        return []

# ==========================================
# FUNCIÓN PRINCIPAL DE BÚSQUEDA
# ==========================================

def realizar_busqueda(producto: str, limite: int = 15):
    resultados = []
    
    # 1. MercadoLibre
    resultados.extend(buscar_mercadolibre(producto, limite))
    
    # 2. Google Shopping vía Serper
    if len(resultados) < 5:
        time.sleep(random.uniform(0.5, 1))
        resultados.extend(buscar_google_serper(producto, limite))
    
    if not resultados:
        return []
    
    for r in resultados:
        score = calcular_concordancia(producto, r["nombre"])
        nivel, etiqueta = clasificar_concordancia(score)
        r["score"] = score
        r["nivel_concordancia"] = nivel
        r["etiqueta_concordancia"] = etiqueta
        r["precio_neto"] = round(r["precio_con_iva"] / IVA)
        r["precio_formateado"] = f"${r['precio_con_iva']:,.0f}".replace(",", ".")
    
    resultados.sort(key=lambda x: (-x["score"], x["precio_con_iva"]))
    
    return resultados[:limite]

# ==========================================
# ENDPOINTS
# ==========================================

@app.route("/python/busqueda-robusta", methods=["GET"])
def busqueda_robusta():
    producto = request.args.get("producto", "").strip()
    numero_item = request.args.get("numero", "")
    minimo_requerido = int(request.args.get("minimo", 9))
    
    if not producto:
        return jsonify({
            "numero_item": numero_item,
            "producto": producto,
            "resultados": [],
            "total_encontrados": 0,
            "suficientes": False,
            "deficit": minimo_requerido
        })
    
    resultados = realizar_busqueda(producto, minimo_requerido * 2)
    
    resultados_legacy = []
    for r in resultados:
        resultados_legacy.append({
            "tienda": r.get("tienda", ""),
            "nombre": r.get("nombre", ""),
            "precio_valor": r.get("precio_con_iva", 0),
            "precio_formateado": r.get("precio_formateado", "Consultar"),
            "link": r.get("url", ""),
            "canal": r.get("fuente", "web"),
            "busqueda_original": producto
        })
    
    return jsonify({
        "numero_item": numero_item,
        "producto": producto,
        "resultados": resultados_legacy,
        "total_encontrados": len(resultados_legacy),
        "suficientes": len(resultados_legacy) >= minimo_requerido,
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
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    print("=" * 50)
    print("🚀 BUSCADOR - GRUPO ICA")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=True)