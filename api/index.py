import requests
import json
import re
from flask import Flask, request, jsonify
from urllib.parse import quote_plus

app = Flask(__name__)

SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

def clean_store_name(url):
    """Extrae y embellece el nombre de la tienda"""
    try:
        domain = url.split('/')[2].replace('www.', '')
        name = domain.split('.')[0].upper()
        # Mapeo manual para los grandes
        mapping = {
            "SAPC": "SODIMAC",
            "MERCADOLIBRE": "M. LIBRE",
            "CONSTRUMART": "CONSTRUMART",
            "FERRETERIA": "FERRETERIA CL"
        }
        return mapping.get(name, name)
    except:
        return "TIENDA"

@app.route("/api/index", methods=["GET"])
def scrape_prices():
    producto = request.args.get("producto")
    if not producto: return jsonify([])
    
    if producto.lower() == "test":
        return jsonify([{"tienda": "PRO", "nombre": "Sistema Robusto OK", "precio_formateado": "$1.234", "precio_valor": 1234, "link": "#"}])

    url = "https://google.serper.dev/search"
    # Aumentamos a 50 resultados para filtrar con mucha fuerza
    payload = json.dumps({
        "q": f"{producto} chile comprar precio -filetype:pdf",
        "gl": "cl",
        "hl": "es",
        "num": 50 
    })
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}

    try:
        response = requests.post(url, headers=headers, data=payload, timeout=15)
        data = response.json()
        resultados = []
        vistos = set()

        for item in data.get('organic', []):
            link = item.get('link', '')
            title = item.get('title', '')
            snippet = item.get('snippet', '')
            
            # Regex mejorado: Busca $ con puntos o comas
            price_match = re.search(r'\$\s?([\d\.,]+)', title + " " + snippet)
            
            if price_match:
                raw_str = price_match.group(1).replace('.', '').replace(',', '')
                try:
                    raw_val = int(raw_str)
                except: continue

                # Filtros de Robustez:
                # 1. No repetir links
                # 2. Solo dominios .cl
                # 3. Precio coherente (evitamos errores de $1 o precios de despacho)
                if link not in vistos and ".cl" in link and raw_val > 500:
                    tienda = clean_store_name(link)
                    
                    # Excluir sitios que no venden (blogs, noticias)
                    blacklist = ["TRANSBANK", "BIOBIOCHILE", "YOUTUBE", "WIKIPEDIA", "FACEBOOK"]
                    if any(b in tienda for b in blacklist): continue

                    resultados.append({
                        "tienda": tienda,
                        "nombre": title[:80],
                        "precio_formateado": f"${raw_val:,}".replace(",", "."),
                        "precio_valor": raw_val,
                        "link": link
                    })
                    vistos.add(link)

        # Ordenar por precio ascendente
        return jsonify(sorted(resultados, key=lambda x: x['precio_valor']))

    except Exception as e:
        print(f"Error: {e}")
        return jsonify([])