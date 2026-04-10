import requests
import json
import re
from flask import Flask, request, jsonify
from urllib.parse import quote_plus

app = Flask(__name__)

# Tu API Key de Serper.dev
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

def identificar_canal(url, titulo):
    """Clasifica el tipo de competidor para inteligencia de mercado"""
    url_lower = url.lower()
    titulo_lower = titulo.lower()
    
    # Cadenas de Retail
    if any(x in url_lower for x in ['sodimac', 'easy', 'falabella', 'ripley', 'paris']):
        return "GRAN RETAIL"
    # Especialistas y Cadenas Ferreteras
    if any(x in url_lower for x in ['imperial', 'construmart', 'mts', 'chilemat', 'yolito', 'ferreteria']):
        return "CADENA FERRETERA"
    # Mayoristas y Distribuidores
    if any(x in url_lower or x in titulo_lower for x in ['mayorista', 'distribuidora', 'bodega', 'importadora', 'patio']):
        return "MAYORISTA / DIST."
    # Marketplaces
    if 'mercadolibre' in url_lower:
        return "MARKETPLACE"
    
    return "FERRETERÍA LOCAL"

@app.route("/api/index", methods=["GET"])
def scrape_prices():
    producto = request.args.get("producto")
    if not producto: return jsonify([])
    
    if producto.lower() == "test":
        return jsonify([{"tienda": "SISTEMA", "nombre": "Radar Masivo OK", "precio_formateado": "$1.000", "precio_valor": 1000, "link": "#", "canal": "TEST"}])

    url = "https://google.serper.dev/search"
    
    # QUERY ULTRA-ABARCATIVA:
    # Buscamos en todos los niveles de la cadena de suministro
    search_query = f"{producto} precio (sodimac OR imperial OR mayorista OR distribuidora OR ferreteria) chile .cl"
    
    payload = json.dumps({
        "q": search_query,
        "gl": "cl",
        "hl": "es",
        "num": 100, # El máximo permitido para no dejar nada fuera
        "autocorrect": True
    })
    
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}

    try:
        response = requests.post(url, headers=headers, data=payload, timeout=25)
        data = response.json()
        
        resultados_brutos = []
        vistos = set()

        # 1. PROCESAR MAPAS (Ferreterías de Barrio y Patios Físicos)
        if 'places' in data:
            for place in data.get('places', []):
                nombre_local = place.get('title', '').upper()
                resultados_brutos.append({
                    "tienda": nombre_local,
                    "nombre": f"LOCAL FÍSICO: {place.get('address', 'Dirección no disponible')}",
                    "precio_formateado": "COTIZAR",
                    "precio_valor": 0,
                    "link": f"https://www.google.com/maps/search/{quote_plus(nombre_local)}",
                    "canal": "LOCAL MAPS"
                })

        # 2. PROCESAR RESULTADOS ORGÁNICOS (Webs, B2B, Mayoristas)
        for item in data.get('organic', []):
            link = item.get('link', '')
            title = item.get('title', '')
            snippet = item.get('snippet', '')

            # Regex para capturar precios en formato chileno ($ 10.000 o $10000)
            price_match = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
            
            if price_match:
                try:
                    raw_val = int(re.sub(r'[^\d]', '', price_match.group(0)))
                    
                    # Filtros de exclusión (basura)
                    if any(x in link.lower() for x in ['facebook', 'instagram', 'youtube', 'wikipedia', 'pdf', 'noticias']):
                        continue

                    if ".cl" in link and raw_val > 300 and link not in vistos:
                        canal = identificar_canal(link, title)
                        
                        resultados_brutos.append({
                            "tienda": link.split('/')[2].replace('www.', '').split('.')[0].upper(),
                            "nombre": title[:90],
                            "precio_formateado": f"${raw_val:,}".replace(",", "."),
                            "precio_valor": raw_val,
                            "link": link,
                            "canal": canal
                        })
                        vistos.add(link)
                except: continue

        # ORDENAMIENTO DE INTELIGENCIA:
        # Los que tienen precio de más barato a más caro, luego los locales de mapas
        con_precio = sorted([r for r in resultados_brutos if r['precio_valor'] > 0], key=lambda x: x['precio_valor'])
        sin_precio = [r for r in resultados_brutos if r['precio_valor'] == 0]
        
        return jsonify(con_precio + sin_precio)

    except Exception as e:
        print(f"Error Radar: {e}")
        return jsonify([])