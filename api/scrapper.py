from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup
import re

app = Flask(__name__)

def get_raw_number(text):
    # Extrae solo los dígitos de un texto como "$14.990" -> 14990
    nums = re.sub(r'[^\d]', '', text)
    return int(nums) if nums else 0

def format_chile_price(value):
    # Convierte 14990 en "$14.990"
    if value > 0:
        return f"${value:,}".replace(",", ".")
    return "Ver sitio"

@app.route("/api/scrapper", methods=["GET"])
def scrape_prices():
    producto = request.args.get("producto")
    if not producto:
        return jsonify([])

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    url = f"https://www.google.com/search?q={producto}+precio+chile+ferreteria"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        resultados = []

        for g in soup.find_all('div', class_='tF2Cxc'):
            anchors = g.find_all('a')
            if not anchors: continue
            
            link = anchors[0]['href']
            title = g.find('h3').text if g.find('h3') else ""
            snippet = g.find('div', class_='VwiC3b').text if g.find('div', class_='VwiC3b') else ""
            
            # Buscar el patrón de precio ($ + números)
            price_match = re.search(r'\$\s?([\d\.]+)', title + " " + snippet)
            
            raw_val = 0
            if price_match:
                raw_val = get_raw_number(price_match.group(0))

            if ".cl" in link:
                resultados.append({
                    "tienda": link.split('/')[2].replace('www.', ''),
                    "nombre": title,
                    "precio_formateado": format_chile_price(raw_val),
                    "precio_valor": raw_val, # Importante para el cálculo del %
                    "link": link
                })

        return jsonify(resultados[:12])
    except Exception as e:
        print(f"Error: {e}")
        return jsonify([])