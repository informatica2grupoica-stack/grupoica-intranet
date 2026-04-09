from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import quote_plus

app = Flask(__name__)

@app.route("/api/index", methods=["GET"])
def scrape_prices():
    producto = request.args.get("producto")
    if not producto:
        return jsonify([])

    # Mantenemos el test para verificar salud del sistema
    if producto.lower() == "test":
        return jsonify([{
            "tienda": "Prueba",
            "nombre": "Conexión Exitosa con Python",
            "precio_formateado": "$9.990",
            "precio_valor": 9990,
            "link": "https://google.cl"
        }])

    # Simulamos un navegador real de forma más completa
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "es-CL,es;q=0.9",
        "Referer": "https://www.google.cl/"
    }
    
    # Optimizamos la búsqueda para e-commerce chilenos
    query = f"{producto} precio chile site:.cl"
    url = f"https://www.google.cl/search?q={quote_plus(query)}&num=15"
    
    try:
        # Usamos un timeout más largo por si Google está lento
        response = requests.get(url, headers=headers, timeout=15)
        
        # Si Google nos bloquea temporalmente (Error 429)
        if response.status_code == 429:
            return jsonify([{"tienda": "Aviso", "nombre": "Google limitó la búsqueda momentáneamente. Reintenta en 1 min.", "precio_formateado": "$0", "precio_valor": 0, "link": "#"}])

        soup = BeautifulSoup(response.text, "html.parser")
        resultados = []

        # Buscamos en los contenedores de resultados
        for g in soup.select('.tF2Cxc'):
            title_element = g.select_one('h3')
            link_element = g.select_one('a')
            snippet_element = g.select_one('.VwiC3b')
            
            if not title_element or not link_element:
                continue

            title = title_element.text
            link = link_element['href']
            snippet = snippet_element.text if snippet_element else ""

            # Intentamos cazar el precio con un regex más flexible
            # Busca formatos como $ 10.000, $10000, 10.000 CLP, etc.
            price_search = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
            
            if price_search:
                price_str = price_search.group(0)
                raw_val = int(re.sub(r'[^\d]', '', price_str))
                
                # Filtramos para que solo salgan tiendas y no blogs o noticias
                # Agregamos los más conocidos para dar prioridad
                tiendas_clave = ['sodimac', 'easy', 'imperial', 'construmart', 'mercadolibre', 'falabella', 'yalitech', 'ferreteria']
                es_tienda = any(t in link.lower() for t in tiendas_clave) or raw_val > 500

                if es_tienda and ".cl" in link:
                    # Limpiamos el nombre de la tienda
                    try:
                        domain = link.split('/')[2].replace('www.', '')
                        tienda_display = domain.split('.')[0].upper()
                    except:
                        tienda_display = "TIENDA CL"

                    resultados.append({
                        "tienda": tienda_display,
                        "nombre": title,
                        "precio_formateado": f"${raw_val:,}".replace(",", "."),
                        "precio_valor": raw_val,
                        "link": link
                    })

        # Ordenamos de más barato a más caro
        resultados = sorted(resultados, key=lambda x: x['precio_valor'])
        
        return jsonify(resultados[:12])

    except Exception as e:
        print(f"Error: {e}")
        return jsonify([])