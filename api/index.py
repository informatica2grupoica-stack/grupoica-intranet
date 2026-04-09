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
    
    # Mantenemos el test para verificar salud del sistema
    if producto.lower() == "test":
        return jsonify([{
            "tienda": "PRUEBA",
            "nombre": "API Serper Conectada Correctamente",
            "precio_formateado": "$9.990",
            "precio_valor": 9990,
            "link": "#"
        }])

    url = "https://google.serper.dev/search"
    
    # Forzamos la búsqueda en Chile (gl: cl) y en español (hl: es)
    payload = json.dumps({
        "q": f"{producto} precio chile ferreteria .cl",
        "gl": "cl",
        "hl": "es",
        "num": 10
    })
    
    headers = {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
    }

    try:
        response = requests.request("POST", url, headers=headers, data=payload)
        data = response.json()
        resultados = []

        # Serper devuelve los resultados en la lista 'organic'
        for item in data.get('organic', []):
            link = item.get('link', '')
            title = item.get('title', '')
            snippet = item.get('snippet', '')

            # Buscamos el patrón de precio ($ 10.000) en el título y la descripción
            price_match = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
            
            if price_match:
                # Extraemos el número puro
                raw_val = int(re.sub(r'[^\d]', '', price_match.group(0)))
                
                # Filtramos para asegurar que sean tiendas reales de Chile
                if ".cl" in link and raw_val > 400:
                    # Limpiamos el nombre de la tienda para que se vea bien en la tarjeta
                    try:
                        tienda = link.split('/')[2].replace('www.', '').split('.')[0].upper()
                    except:
                        tienda = "TIENDA CL"

                    resultados.append({
                        "tienda": tienda,
                        "nombre": title[:70],
                        "precio_formateado": format_chile_price(raw_val),
                        "precio_valor": raw_val,
                        "link": link
                    })

        # Ordenamos por el más barato siempre para que ICA destaque
        resultados_ordenados = sorted(resultados, key=lambda x: x['precio_valor'])
        
        return jsonify(resultados_ordenados)

    except Exception as e:
        print(f"Error en API Serper: {e}")
        return jsonify([])