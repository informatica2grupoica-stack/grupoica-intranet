import requests
import json
import re
from flask import Flask, request, jsonify

app = Flask(__name__)

# Tu API Key de Serper.dev
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

def format_chile_price(value):
    if value > 0:
        return f"${value:,}".replace(",", ".")
    return "Ver sitio"

@app.route("/api/index", methods=["GET"])
def scrape_prices():
    producto = request.args.get("producto")
    if not producto:
        return jsonify([])
    
    # Modo Test
    if producto.lower() == "test":
        return jsonify([{"tienda": "PRUEBA", "nombre": "API Conectada", "precio_formateado": "$9.990", "precio_valor": 9990, "link": "#"}])

    url = "https://google.serper.dev/search"
    
    # AUMENTAMOS 'num' a 40 para capturar la mayor cantidad de páginas posibles
    payload = json.dumps({
        "q": f"{producto} precio chile ferreteria", # Quitamos el .cl de aquí para que Google sea más abierto
        "gl": "cl",
        "hl": "es",
        "num": 40 # Pedimos 40 resultados para filtrar los mejores
    })
    
    headers = {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
    }

    try:
        response = requests.request("POST", url, headers=headers, data=payload)
        data = response.json()
        resultados = []
        vistos = set() # Para evitar duplicados de la misma tienda y mismo precio

        # Procesamos los resultados orgánicos
        for item in data.get('organic', []):
            link = item.get('link', '')
            title = item.get('title', '')
            snippet = item.get('snippet', '')

            # Buscamos el precio ($ XXX.XXX)
            price_match = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
            
            if price_match:
                raw_val = int(re.sub(r'[^\d]', '', price_match.group(0)))
                
                # FILTROS DE CALIDAD PARA MAYORISTA CONSTRUCTOR:
                # 1. Que el dominio sea chileno (.cl)
                # 2. Que el precio sea realista (ej: mayor a $1.000 para cemento/ferretería)
                # 3. Que no hayamos agregado este link exacto ya
                if ".cl" in link and raw_val > 1000 and link not in vistos:
                    try:
                        # Extraer nombre limpio de la tienda
                        tienda = link.split('/')[2].replace('www.', '').split('.')[0].upper()
                        
                        # Lista negra de sitios que no son tiendas (opcional)
                        if tienda in ["CHILEATIENDE", "WIKIPEDIA", "FACEBOOK", "INSTAGRAM"]:
                            continue

                        resultados.append({
                            "tienda": tienda,
                            "nombre": title[:85],
                            "precio_formateado": format_chile_price(raw_val),
                            "precio_valor": raw_val,
                            "link": link
                        })
                        vistos.add(link)
                    except:
                        continue

        # Ordenamos por precio para que veas quién es el más barato de todos
        resultados_ordenados = sorted(resultados, key=lambda x: x['precio_valor'])
        
        # Devolvemos los mejores 20 resultados (puedes subir este número si quieres)
        return jsonify(resultados_ordenados[:20])

    except Exception as e:
        print(f"Error: {e}")
        return jsonify([])