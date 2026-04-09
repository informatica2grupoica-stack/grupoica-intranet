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

    # MODO DE PRUEBA: Si buscas 'test', verificamos que la API responda
    if producto.lower() == "test":
        return jsonify([{
            "tienda": "Prueba",
            "nombre": "Conexión Exitosa con Python",
            "precio_formateado": "$9.990",
            "precio_valor": 9990,
            "link": "https://google.cl"
        }])

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    # Buscamos de forma más amplia
    url = f"https://www.google.com/search?q={quote_plus(producto + ' precio ferreteria chile')}"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        resultados = []

        # Selector principal de Google
        for g in soup.find_all('div', class_='tF2Cxc'):
            title = g.find('h3').text if g.find('h3') else ""
            link = g.find('a')['href'] if g.find('a') else ""
            
            # Buscamos el precio en cualquier parte del texto
            full_text = g.get_text()
            price_match = re.search(r'\$\s?([\d\.]+)', full_text)
            
            if price_match:
                price_str = price_match.group(0)
                # Limpiar el número para la lógica de Mayorista Constructor
                raw_val = int(re.sub(r'[^\d]', '', price_str))
                
                # Solo tiendas chilenas para ICA
                if ".cl" in link:
                    tienda = link.split('/')[2].replace('www.', '').split('.')[0].capitalize()
                    resultados.append({
                        "tienda": tienda,
                        "nombre": title,
                        "precio_formateado": f"${raw_val:,}".replace(",", "."),
                        "precio_valor": raw_val,
                        "link": link
                    })

        return jsonify(resultados[:12])
    except Exception as e:
        return jsonify([{"error": str(e)}])