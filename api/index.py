from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup
import re
import random

app = Flask(__name__)

# Lista de User-Agents para evitar que Google nos bloquee por ser un robot
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
]

def get_raw_number(text):
    """Extrae solo los números de un string de precio (ej: '$14.990' -> 14990)"""
    nums = re.sub(r'[^\d]', '', text)
    return int(nums) if nums else 0

def format_chile_price(value):
    """Formatea un número al estilo moneda chilena (ej: 14990 -> $14.990)"""
    if value > 0:
        return f"${value:,}".replace(",", ".")
    return "Ver sitio"

@app.route("/api/index", methods=["GET"])
def scrape_prices():
    producto = request.args.get("producto")
    if not producto:
        return jsonify([])

    # Construimos la búsqueda enfocada en e-commerce de ferretería en Chile
    # El parámetro 'hl=es' y 'gl=cl' le dice a Google que estamos en Chile
    query = f"{producto} precio chile ferreteria"
    url = f"https://www.google.com/search?q={quote_plus(query)}&hl=es&gl=cl"
    
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept-Language": "es-CL,es;q=0.9,en;q=0.8"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            return jsonify([])

        soup = BeautifulSoup(response.text, "html.parser")
        resultados = []

        # 'tF2Cxc' es el contenedor estándar de resultados de Google
        for g in soup.find_all('div', class_='tF2Cxc'):
            anchors = g.find_all('a')
            if not anchors: continue
            
            link = anchors[0]['href']
            title = g.find('h3').text if g.find('h3') else ""
            snippet = g.find('div', class_='VwiC3b').text if g.find('div', class_='VwiC3b') else ""
            
            # Buscamos el precio en el título o en la descripción (snippet)
            # Buscamos el formato $XX.XXX
            price_match = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
            
            raw_val = 0
            if price_match:
                raw_val = get_raw_number(price_match.group(0))

            # Solo agregamos si es una tienda chilena y pudimos detectar un precio
            if ".cl" in link and raw_val > 0:
                # Extraemos el nombre de la tienda del dominio
                tienda_nombre = link.split('/')[2].replace('www.', '').split('.')[0].capitalize()
                
                resultados.append({
                    "tienda": tienda_nombre,
                    "nombre": title[:80] + "...", # Acortamos títulos muy largos
                    "precio_formateado": format_chile_price(raw_val),
                    "precio_valor": raw_val,
                    "link": link
                })

        # Ordenar por precio de menor a mayor (opcional, muy útil para el B2B)
        resultados_ordenados = sorted(resultados, key=lambda x: x['precio_valor'])

        return jsonify(resultados_ordenados[:12])
    
    except Exception as e:
        print(f"Error en Scraper: {e}")
        return jsonify([])

# Necesario para importar quote_plus
from urllib.parse import quote_plus