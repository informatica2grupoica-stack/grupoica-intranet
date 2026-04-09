import requests
import json
import re
from flask import Flask, request, jsonify
from urllib.parse import quote_plus

app = Flask(__name__)

# Tu API Key de Serper.dev
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

def clean_store_name(url, source_title=None):
    """Extrae el nombre de la tienda o usa el título del mapa"""
    if source_title:
        return source_title.upper()
    try:
        domain = url.split('/')[2].replace('www.', '')
        return domain.split('.')[0].upper()
    except:
        return "FERRETERÍA LOCAL"

@app.route("/api/index", methods=["GET"])
def scrape_prices():
    producto = request.args.get("producto")
    if not producto:
        return jsonify([])
    
    # Modo Test
    if producto.lower() == "test":
        return jsonify([{"tienda": "SISTEMA", "nombre": "Radar Total Activado", "precio_formateado": "$1.000", "precio_valor": 1000, "link": "#"}])

    url = "https://google.serper.dev/search"
    
    # QUERY POTENCIADA: Buscamos en retail, patios constructores y ferreterías locales
    # Usamos términos que disparan resultados de construcción profesional
    main_query = f"{producto} precio chile (ferreteria OR 'patio constructor' OR 'materiales construccion' OR 'venta empresa') .cl"
    
    payload = json.dumps({
        "q": main_query,
        "gl": "cl",
        "hl": "es",
        "num": 100,
        "page": 1,
        "type": "search" # Esto abarca web, shopping y lugares cercanos
    })
    
    headers = {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
    }

    try:
        response = requests.post(url, headers=headers, data=payload, timeout=25)
        data = response.json()
        
        resultados_brutos = []
        vistos = set()

        # 1. CAPTURAMOS RESULTADOS DE MAPAS (Ferreterías de barrio / locales físicos)
        if 'places' in data:
            for place in data.get('places', []):
                # Los lugares de mapas a veces no tienen precio directo, 
                # pero los incluimos si el sistema detecta uno en su descripción
                title = place.get('title', '')
                address = place.get('address', '')
                link = place.get('website', f"https://www.google.com/maps/search/{quote_plus(title)}")
                
                # Para mapas, si no hay precio, ponemos 0 para que el front lo maneje o lo mande al final
                resultados_brutos.append({
                    "tienda": clean_store_name("", title),
                    "nombre": f"Local: {title} - {address[:50]}",
                    "precio_formateado": "Ver en Local",
                    "precio_valor": 0, # Se irá al final por precio
                    "link": link
                })

        # 2. CAPTURAMOS RESULTADOS ORGÁNICOS (Webs, Patios, Constructoras)
        for item in data.get('organic', []):
            link = item.get('link', '')
            title = item.get('title', '')
            snippet = item.get('snippet', '')

            # Buscamos precio con regex flexible
            price_match = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
            
            if price_match:
                try:
                    raw_val = int(re.sub(r'[^\d]', '', price_match.group(0)))
                    
                    if ".cl" in link and raw_val > 500 and link not in vistos:
                        tienda = clean_store_name(link)
                        
                        # Filtro de ruido
                        if any(x in tienda for x in ["YOUTUBE", "FACEBOOK", "WIKIPEDIA"]): continue

                        resultados_brutos.append({
                            "tienda": tienda,
                            "nombre": title[:90],
                            "precio_formateado": f"${raw_val:,}".replace(",", "."),
                            "precio_valor": raw_val,
                            "link": link
                        })
                        vistos.add(link)
                except: continue

        # 3. ORDENAMIENTO INTELIGENTE
        # Primero los que tienen precio (de más barato a más caro)
        # Al final los locales de mapas que no publican precio online
        con_precio = sorted([r for r in resultados_brutos if r['precio_valor'] > 0], key=lambda x: x['precio_valor'])
        sin_precio = [r for r in resultados_brutos if r['precio_valor'] == 0]
        
        return jsonify(con_precio + sin_precio)

    except Exception as e:
        print(f"Error Radar: {e}")
        return jsonify([])