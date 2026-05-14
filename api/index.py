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
        print(f"  📡 [ML] Llamando a MercadoLibre...")
        r = requests.get(url, params=params, timeout=10)
        print(f"  📡 [ML] Status code: {r.status_code}")
        
        if r.status_code != 200:
            print(f"  ❌ [ML] Error: Status {r.status_code}")
            return []

        data = r.json()
        items = data.get("results", [])
        print(f"  📦 [ML] Items encontrados: {len(items)}")
        
        resultados = []
        for item in items[:limite]:
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
        print(f"  ✅ [ML] Resultados procesados: {len(resultados)}")
        return resultados
    except Exception as e:
        print(f"  ❌ [ML] Excepción: {e}")
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
        
        print(f"  📡 [GS] Llamando a Google Shopping...")
        r = requests.get(url, headers=headers, timeout=15)
        print(f"  📡 [GS] Status code: {r.status_code}")
        
        if r.status_code != 200:
            print(f"  ❌ [GS] Error: Status {r.status_code}")
            return []

        soup = BeautifulSoup(r.text, "html.parser")
        resultados = []

        # Probar diferentes selectores
        contenedores = soup.select(".sh-dgr__grid-result") or soup.select("[data-docid]") or soup.select(".sh-pr__product-results")
        print(f"  📦 [GS] Contenedores encontrados: {len(contenedores)}")

        for item in contenedores[:limite]:
            nombre_el = item.select_one("h3") or item.select_one(".Xjkr3b") or item.select_one(".tAxDx")
            precio_el = item.select_one(".a8Pemb") or item.select_one(".YYPO0c") or item.select_one(".kHxwFf")
            tienda_el = item.select_one(".aULzUe") or item.select_one(".E5ocAb") or item.select_one(".C9p3Ve")
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
            if precio <= 500 or precio > 200_000_000:
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

        print(f"  ✅ [GS] Resultados procesados: {len(resultados)}")
        return resultados
    except ImportError:
        print("  ❌ [GS] BeautifulSoup no instalado")
        return []
    except Exception as e:
        print(f"  ❌ [GS] Excepción: {e}")
        return []

# ==========================================
# FUNCIÓN PRINCIPAL DE BÚSQUEDA
# ==========================================

def realizar_busqueda(producto: str, minimo: int = 9):
    resultados = []
    
    print(f"\n  🔍 Iniciando búsqueda para: {producto}")
    
    # 1. MercadoLibre
    print(f"  📡 Fuente 1/2: MercadoLibre")
    ml_resultados = buscar_mercadolibre(producto, minimo * 2)
    resultados.extend(ml_resultados)
    print(f"  📊 Total después de ML: {len(resultados)}")
    
    # 2. Google Shopping si hay pocos resultados
    if len(resultados) < minimo:
        print(f"  📡 Fuente 2/2: Google Shopping (pocos resultados, expandiendo)")
        time.sleep(random.uniform(0.5, 1.2))
        gs_resultados = buscar_google_shopping(producto, minimo)
        resultados.extend(gs_resultados)
        print(f"  📊 Total después de GS: {len(resultados)}")
    else:
        print(f"  ✅ Suficientes resultados de ML, omitiendo Google Shopping")
    
    if not resultados:
        print(f"  ❌ No se encontraron resultados para: {producto}")
        return []
    
    # Calcular concordancia
    print(f"  🧮 Calculando concordancia para {len(resultados)} resultados...")
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
    
    print(f"  ✅ Mejor resultado: {resultados[0]['nombre'][:50]} - {resultados[0]['precio_formateado']} (score: {resultados[0]['score']}%)")
    
    return resultados

# ==========================================
# ENDPOINT LEGACY (compatible con frontend)
# ==========================================

@app.route("/python/busqueda-robusta", methods=["GET"])
def busqueda_robusta():
    producto = request.args.get("producto", "").strip()
    numero_item = request.args.get("numero", "")
    minimo_requerido = int(request.args.get("minimo", 9))
    
    print("\n" + "=" * 60)
    print(f"📥 NUEVA CONSULTA")
    print("=" * 60)
    print(f"📌 Item: {numero_item}")
    print(f"🔍 Producto: {producto}")
    print(f"🎯 Mínimo requerido: {minimo_requerido}")
    
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
            "busqueda_original": producto,
            "score": r.get("score", 0),
            "nivel_concordancia": r.get("nivel_concordancia", ""),
            "etiqueta_concordancia": r.get("etiqueta_concordancia", "")
        })
    
    print("\n" + "=" * 60)
    print(f"📤 RESPUESTA")
    print("=" * 60)
    print(f"📌 Item: {numero_item}")
    print(f"📊 Total encontrados: {len(resultados_legacy)}")
    print(f"✅ Suficiente: {len(resultados_legacy) >= minimo_requerido}")
    print("=" * 60 + "\n")
    
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
    print("✅ Logs detallados para depuración")
    print("=" * 60)
    print("📍 Servidor corriendo en: http://localhost:5000")
    print("📍 Endpoint principal: /python/busqueda-robusta")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)