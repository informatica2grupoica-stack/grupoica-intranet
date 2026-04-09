import requests
import json
import re
from flask import Flask, request, jsonify
from urllib.parse import quote_plus

app = Flask(__name__)

# Tu API Key de Serper.dev
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

def clean_store_name(url):
    """Extrae el nombre de la tienda del dominio de forma limpia"""
    try:
        domain = url.split('/')[2].replace('www.', '')
        name = domain.split('.')[0].upper()
        return name
    except:
        return "TIENDA CL"

@app.route("/api/index", methods=["GET"])
def scrape_prices():
    producto = request.args.get("producto")
    if not producto:
        return jsonify([])
    
    # Modo Test para verificar conexión
    if producto.lower() == "test":
        return jsonify([{"tienda": "SISTEMA", "nombre": "Modo Masivo Activado", "precio_formateado": "$1.000", "precio_valor": 1000, "link": "#"}])

    url = "https://google.serper.dev/search"
    
    # CONFIGURACIÓN MASIVA:
    # 1. 'num': 100 -> Pedimos los 100 mejores resultados de Google de una vez (abarca varias páginas)
    # 2. 'q': Quitamos restricciones para que traiga caras, baratas, grandes y pequeñas
    payload = json.dumps({
        "q": f"{producto} precio ferreteria chile",
        "gl": "cl",
        "hl": "es",
        "num": 100 
    })
    
    headers = {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
    }

    try:
        response = requests.post(url, headers=headers, data=payload, timeout=20)
        data = response.json()
        
        resultados_brutos = []
        vistos = set() # Para no repetir el mismo producto de la misma tienda

        # 1. Recolección de resultados orgánicos
        fuentes = data.get('organic', [])
        
        # 2. Recolección de resultados de "Shopping" si Google los muestra en la búsqueda
        if 'shopping' in data:
            fuentes.extend(data.get('shopping', []))

        for item in fuentes:
            link = item.get('link', '')
            title = item.get('title', '')
            snippet = item.get('snippet', '') or item.get('source', '')

            # Buscamos el precio con un regex que aguanta cualquier formato chileno
            price_match = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
            
            if price_match:
                try:
                    # Limpiamos el precio a número entero
                    raw_val = int(re.sub(r'[^\d]', '', price_match.group(0)))
                    
                    # FILTROS DE ROBUSTEZ MASIVA
                    # - Solo dominios de Chile (.cl)
                    # - Precios mayores a $500 (para evitar errores de 'desde' o miniaturas)
                    # - Evitar duplicados exactos de URL
                    if ".cl" in link and raw_val > 500 and link not in vistos:
                        tienda = clean_store_name(link)
                        
                        # Lista negra de sitios que NO son tiendas
                        if tienda in ["CHILEATIENDE", "YOUTUBE", "WIKIPEDIA", "FACEBOOK", "INSTAGRAM", "PINTEREST"]:
                            continue

                        resultados_brutos.append({
                            "tienda": tienda,
                            "nombre": title[:90],
                            "precio_formateado": f"${raw_val:,}".replace(",", "."),
                            "precio_valor": raw_val,
                            "link": link
                        })
                        vistos.add(link)
                except:
                    continue

        # ORDENAMIENTO CRÍTICO: De más barato a más caro
        # Esto pone las ofertas de Mayorista Constructor contra el mundo
        resultados_finales = sorted(resultados_brutos, key=lambda x: x['precio_valor'])
        
        return jsonify(resultados_finales)

    except Exception as e:
        print(f"Error Masivo: {e}")
        return jsonify([])