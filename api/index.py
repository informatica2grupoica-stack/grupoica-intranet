import re
import time
import random
import requests
from difflib import SequenceMatcher
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

IVA = 1.19

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

def buscar_mercadolibre(producto: str, limite: int = 15):
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
# GOOGLE SHOPPING (scraping con BeautifulSoup)
# ==========================================

def buscar_google_shopping(producto: str, limite: int = 10):
    try:
        from bs4 import BeautifulSoup

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "es-CL,es;q=0.9",
        }

        query = f"{producto} Chile precio"
        url = f"https://www.google.cl/search?q={requests.utils.quote(query)}&tbm=shop&hl=es-CL&gl=cl&num={limite}"

        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code != 200:
            return []

        soup = BeautifulSoup(r.text, "html.parser")
        resultados = []

        contenedores = soup.select(".sh-dgr__grid-result") or soup.select("[data-docid]")

        for item in contenedores[:limite]:
            nombre_el = item.select_one("h3") or item.select_one(".Xjkr3b")
            precio_el = item.select_one(".a8Pemb") or item.select_one(".YYPO0c")
            tienda_el = item.select_one(".aULzUe") or item.select_one(".E5ocAb")
            link_el = item.select_one("a[href]")

            if not nombre_el or not precio_el:
                continue

            nombre = nombre_el.get_text(strip=True)
            precio_str = precio_el.get_text(strip=True)
            tienda = tienda_el.get_text(strip=True) if tienda_el else "Tienda online"

            precio_num = re.sub(r'[^\d]', '', precio_str)
            if not precio_num:
                continue
            precio = int(precio_num)
            if precio <= 100 or precio > 200_000_000:
                continue

            link = ""
            if link_el:
                href = link_el.get("href", "")
                if "/url?q=" in href:
                    link = href.split("/url?q=")[1].split("&")[0]
                elif href.startswith("http"):
                    link = href

            resultados.append({
                "tienda": tienda,
                "nombre": nombre,
                "precio_con_iva": precio,
                "url": link,
                "fuente": "google_shopping",
            })

        return resultados
    except ImportError:
        print("  [GS] BeautifulSoup no instalado")
        return []
    except Exception as e:
        print(f"  [GS] Error: {e}")
        return []

# ==========================================
# FUNCIÓN PRINCIPAL DE BÚSQUEDA
# ==========================================

def realizar_busqueda(producto: str, minimo: int = 9):
    resultados = []
    
    # 1. MercadoLibre
    resultados.extend(buscar_mercadolibre(producto, minimo * 2))
    
    # 2. Google Shopping si hay pocos resultados
    if len(resultados) < minimo:
        time.sleep(random.uniform(0.5, 1.2))
        resultados.extend(buscar_google_shopping(producto, minimo))
    
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
    
    # Ordenar por score
    resultados.sort(key=lambda x: (-x["score"], x["precio_con_iva"]))
    
    return resultados

# ==========================================
# ENDPOINT LEGACY (compatible con frontend)
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
    
    # Realizar búsqueda
    resultados = realizar_busqueda(producto, minimo_requerido)
    
    # Transformar al formato que espera el frontend
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
    # Obtener el JSON de la respuesta
    response_data = resultado.get_json()
    return jsonify(response_data.get("resultados", []))

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "mensaje": "Backend funcionando correctamente"})

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 BUSCADOR MEJORADO - GRUPO ICA")
    print("=" * 60)
    print("✅ Fuentes de datos:")
    print("   - MercadoLibre API (gratis)")
    print("   - Google Shopping (scraping)")
    print("✅ Matching inteligente con score 0-100%")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)