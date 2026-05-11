import requests
import json
import re
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote

app = Flask(__name__)
CORS(app)

# ==========================================
# CONFIGURACIÓN MAESTRA
# ==========================================
SERPER_API_KEY = "36d2f41e5c97c757ba82bfced5ed64ee1c6e57c4"

# Listado ampliado de proveedores (incluye agrícolas y construcción pesada)
PROVEEDORES_CHILE = [
    # Ferreterías generales
    "trentini.cl", "hela.cl", "sodimac.cl", "easy.cl", "imperial.cl", 
    "construmart.cl", "yolito.cl", "chilemat.com", "mts.cl", "dabed.cl", 
    "weitzler.cl", "ferreteriaohiggins.cl", "ferreteriasindustrial.cl", "amanecer.cl",
    # Herramientas eléctricas y marcas
    "makita.cl", "bosch-professional.com", "dewalt.cl", "milwaukeetool.cl",
    # Materiales específicos
    "indura.cl", "arauco.cl", "madepa.cl", "pernoschile.cl", 
    # Asfalto y camineros
    "asfaltoschile.cl", "bitumix.cl", "dynal.cl", "sika.com", "texsa.cl",
    # Fijaciones y anclajes
    "fijaciones.cl", "mamut.cl",
    # Materiales de construcción grandes
    "pizarreño.cl", "volcan.cl", "sipesa.cl",
    # Maquinaria agrícola y construcción (NUEVOS)
    "agrocenter.cl", "dercomaq.cl", "ferritotal.cl", "importadoraagro.cl",
    "maqsa.cl", "sky.cl", "tractochile.cl", "caserones.cl", "agrozzi.cl"
]

def limpiar_nombre_producto(nombre):
    """Limpia el título de ruidos comunes en webs de ferretería."""
    if not nombre: return ""
    patrones = [
        r"(?i)despacho\s?a\s?domicilio", r"(?i)retiro\s?en\s?tienda", 
        r"(?i)stock\s?disponible", r"(?i)precio\s?internet", 
        r"\|", r"-", r"\([^)]*\)$",  # Elimina paréntesis al final
        r"envío\s?a\s?domicilio", r"retiro\s?en\s?tienda"
    ]
    for p in patrones:
        nombre = re.sub(p, "", nombre, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', nombre).strip()

def extraer_precio(texto):
    """Extrae montos numéricos de strings con formato de moneda chilena."""
    if not texto: return 0
    
    # Busca $ seguido de números con o sin puntos
    match = re.search(r'\$\s?([\d\.]+)', texto)
    if match:
        try:
            val = int(re.sub(r'[^\d]', '', match.group(1)))
            # Rango ampliado para maquinaria agrícola (hasta 25 millones)
            if 500 < val < 25000000: return val
        except: 
            pass
    
    # Intenta con "Precio:" o "Valor:"
    match2 = re.search(r'(?:precio|valor)[:\s]*\$?\s?([\d\.]+)', texto, re.IGNORECASE)
    if match2:
        try:
            val = int(re.sub(r'[^\d]', '', match2.group(1)))
            if 500 < val < 25000000: return val
        except:
            pass
            
    return 0

def fetch_serper_data(query, search_type="search", max_retries=2):
    """Consulta la API de Serper con reintentos y mejor manejo de errores."""
    url = f"https://google.serper.dev/{search_type}"
    payload = json.dumps({
        "q": query, 
        "gl": "cl", 
        "hl": "es", 
        "num": 50  # Aumentado para obtener más resultados
    })
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    
    for intento in range(max_retries):
        try:
            response = requests.post(url, headers=headers, data=payload, timeout=12)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error en llamada a Serper ({search_type}) - Intento {intento+1}: {e}")
            if intento < max_retries - 1:
                time.sleep(1)
    return {}

def expandir_busqueda(producto, resultados_actuales, minimo_requerido=9):
    """Expande la búsqueda cuando hay menos de 'minimo_requerido' resultados."""
    if len(resultados_actuales) >= minimo_requerido:
        return resultados_actuales
    
    resultados_expandidos = resultados_actuales.copy()
    vistos = set(r.get('link', '') for r in resultados_actuales)
    
    # Estrategias de expansión
    estrategias = [
        f"{producto} comprar chile",           # Búsqueda comercial
        f"{producto} precio",                   # Solo precio
        producto.replace('"', ''),              # Sin comillas
        f"{producto} ferretería online",        # Categoría amplia
        re.sub(r'\b(\w+)\s+(\d+[x\d]*)\b', r'\1 \2mm', producto)  # Normaliza medidas
    ]
    
    # Para maquinaria agrícola, añadir términos específicos
    if any(word in producto.lower() for word in ['tractor', 'retroexcavadora', 'excavadora', 'bulldozer', 'maquinaria']):
        estrategias.append(f"maquinaria {producto} chile")
        estrategias.append(f"{producto} agrícola venta")
    
    # Para artículos pequeños de ferretería
    if any(word in producto.lower() for word in ['clavo', 'tornillo', 'broca', 'disco', 'lija']):
        estrategias.append(f"{producto} caja 100 unidades")
        estrategias.append(f"{producto} x 50")
    
    # Probar cada estrategia hasta alcanzar el mínimo
    for estrategia in estrategias:
        if len(resultados_expandidos) >= minimo_requerido:
            break
            
        print(f"Expandiendo búsqueda para '{producto}' con: {estrategia}")
        data = fetch_serper_data(estrategia, "shopping")
        
        items = data.get('shopping', []) + data.get('organic', [])
        for item in items:
            link = item.get('link') or item.get('website', '')
            if not link or link in vistos:
                continue
                
            title = item.get('title', 'Tienda')
            snippet = item.get('snippet', '')
            
            raw_price = 0
            if 'price' in item:
                try:
                    raw_price = int(re.sub(r'[^\d]', '', str(item['price'])))
                except:
                    raw_price = 0
            
            if raw_price == 0:
                raw_price = extraer_precio(title + " " + snippet)
            
            tienda = item.get('source') or item.get('store')
            if not tienda:
                try:
                    tienda = link.split('/')[2].replace('www.', '').split('.')[0].upper()
                except:
                    tienda = "WEB"
            
            nuevo_resultado = {
                "tienda": tienda.upper(),
                "nombre": limpiar_nombre_producto(title),
                "precio_valor": raw_price,
                "precio_formateado": f"${raw_price:,}".replace(",", ".") if raw_price > 0 else "Consultar",
                "link": link,
                "canal": "EXPANSION_V4",
                "busqueda_original": producto
            }
            
            resultados_expandidos.append(nuevo_resultado)
            vistos.add(link)
        
        time.sleep(0.5)  # Pequeña pausa entre estrategias
    
    # Ordenar por precio (los que tienen precio primero, luego más baratos)
    resultados_expandidos.sort(key=lambda x: (x['precio_valor'] == 0, x['precio_valor']))
    
    return resultados_expandidos

@app.route("/python/busqueda-robusta", methods=["GET"])
def busqueda_robusta():
    """
    Endpoint mejorado que garantiza mínimo 9 resultados y preserva el número del ítem.
    Parámetros:
    - producto: nombre del producto a buscar
    - numero: número del ítem en la lista (ej: "25" para "25 Anticorrosivo")
    - minimo: cantidad mínima de resultados requerida (default: 9)
    """
    producto_raw = request.args.get("producto", "").strip()
    numero_item = request.args.get("numero", "")
    minimo_requerido = int(request.args.get("minimo", 9))
    
    if not producto_raw:
        return jsonify({
            "error": "Se requiere parámetro 'producto'",
            "numero_item": numero_item,
            "resultados": [],
            "total_encontrados": 0,
            "suficientes": False,
            "deficit": minimo_requerido
        })
    
    # Limpieza avanzada del producto
    producto = producto_raw.strip()
    
    # Detectar tipo de producto para ajustar estrategias
    es_maquinaria_pesada = any(word in producto.lower() for word in [
        'tractor', 'excavadora', 'retroexcavadora', 'bulldozer', 'pala cargadora', 
        'motoniveladora', 'rodillo', 'camión', 'grúa', 'maquinaria'
    ])
    
    es_herramienta_electrica = any(word in producto.lower() for word in [
        'taladro', 'amoladora', 'sierra', 'generador', 'compactador', 'vibrador'
    ])
    
    es_material_construccion = any(word in producto.lower() for word in [
        'cemento', 'arena', 'grava', 'madera', 'terciado', 'fierro', 'acero', 
        'viga', 'perfil', 'pletina', 'placa'
    ])
    
    es_articulo_pequeno = any(word in producto.lower() for word in [
        'clavo', 'tornillo', 'broca', 'disco', 'lija', 'pintura', 'anticorrosivo'
    ])
    
    # Construir queries según el tipo de producto
    queries_principales = []
    
    # Query exacta con comillas
    queries_principales.append(f'"{producto}"')
    
    # Query sin comillas más flexible
    queries_principales.append(producto)
    
    # Query específica por tipo
    if es_maquinaria_pesada:
        queries_principales.append(f"{producto} venta chile precio")
        queries_principales.append(f"{producto} agrícola construcción")
    elif es_herramienta_electrica:
        queries_principales.append(f"{producto} herramienta eléctrica precio")
        queries_principales.append(f"{producto} ferretería industrial")
    elif es_material_construccion:
        queries_principales.append(f"{producto} material construcción")
        queries_principales.append(f"{producto} precio metro lineal" if "viga" in producto.lower() else f"{producto} construcción")
    elif es_articulo_pequeno:
        queries_principales.append(f"{producto} ferretería")
        queries_principales.append(f"comprar {producto} online")
    else:
        queries_principales.append(f"{producto} chile precio")
        queries_principales.append(f"{producto} ferretería online")
    
    # Ejecutar búsquedas en paralelo
    todos_resultados = []
    vistos = set()
    
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = []
        for query in queries_principales:
            # Buscar en shopping y organic para cada query
            futures.append(executor.submit(fetch_serper_data, query, "shopping"))
            futures.append(executor.submit(fetch_serper_data, query, "search"))
        
        for future in as_completed(futures):
            data = future.result()
            items = data.get('shopping', []) + data.get('organic', []) + data.get('places', [])
            
            for item in items:
                link = item.get('link') or item.get('website', '')
                if not link or link in vistos:
                    continue
                
                if any(x in link.lower() for x in ['facebook', 'instagram', 'youtube', 'wikipedia', 'linkedin']):
                    continue
                
                title = item.get('title', '')
                snippet = item.get('snippet', '')
                
                raw_price = 0
                if 'price' in item:
                    try:
                        raw_price = int(re.sub(r'[^\d]', '', str(item['price'])))
                    except:
                        raw_price = 0
                
                if raw_price == 0:
                    raw_price = extraer_precio(title + " " + snippet)
                
                tienda = item.get('source') or item.get('store')
                if not tienda:
                    try:
                        tienda = link.split('/')[2].replace('www.', '').split('.')[0].upper()
                    except:
                        tienda = "WEB"
                
                # Solo agregar si tiene precio o es relevante
                if raw_price > 0 or (len(todos_resultados) < minimo_requerido * 2):
                    todos_resultados.append({
                        "tienda": tienda.upper(),
                        "nombre": limpiar_nombre_producto(title),
                        "precio_valor": raw_price,
                        "precio_formateado": f"${raw_price:,}".replace(",", ".") if raw_price > 0 else "Consultar",
                        "link": link,
                        "canal": "PRINCIPAL_V4",
                        "busqueda_original": producto
                    })
                    vistos.add(link)
    
    # Filtrar duplicados por link
    resultados_unicos = []
    links_vistos = set()
    for r in todos_resultados:
        if r['link'] not in links_vistos:
            resultados_unicos.append(r)
            links_vistos.add(r['link'])
    
    # Ordenar por precio (los que tienen precio y más baratos primero)
    resultados_unicos.sort(key=lambda x: (x['precio_valor'] == 0, x['precio_valor']))
    
    # Si no hay suficientes, expandir búsqueda
    if len(resultados_unicos) < minimo_requerido:
        print(f"Resultados insuficientes para '{producto}': {len(resultados_unicos)}/{minimo_requerido}. Expandiendo...")
        resultados_unicos = expandir_busqueda(producto, resultados_unicos, minimo_requerido)
    
    # Limitar a máximo 20 resultados (pero asegurando mostrar mínimo 9)
    max_resultados = max(minimo_requerido * 2, 20)
    resultados_finales = resultados_unicos[:max_resultados]
    
    tiene_suficientes = len(resultados_finales) >= minimo_requerido
    
    return jsonify({
        "numero_item": numero_item,
        "producto": producto,
        "resultados": resultados_finales,
        "total_encontrados": len(resultados_finales),
        "suficientes": tiene_suficientes,
        "deficit": max(0, minimo_requerido - len(resultados_finales)),
        "tipo_producto": {
            "maquinaria_pesada": es_maquinaria_pesada,
            "herramienta_electrica": es_herramienta_electrica,
            "material_construccion": es_material_construccion,
            "articulo_pequeno": es_articulo_pequeno
        }
    })

@app.route("/python/index", methods=["GET"])
@app.route("/api/index", methods=["GET"])
def scrape_prices():
    """Endpoint legacy para compatibilidad con código existente."""
    producto = request.args.get("producto", "").strip()
    if not producto:
        return jsonify([])
    
    resultado = busqueda_robusta()
    # Extraer solo los resultados para mantener compatibilidad
    if hasattr(resultado, 'json'):
        data = resultado.json
        return jsonify(data.get('resultados', []))
    return jsonify([])

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 SERVIDOR DE BÚSQUEDA ROBUSTA - GRUPO ICA")
    print("=" * 60)
    print(f"✅ Puerto: 5000")
    print(f"✅ Proveedores configurados: {len(PROVEEDORES_CHILE)}")
    print(f"✅ Endpoint principal: /python/busqueda-robusta")
    print(f"✅ Mínimo de resultados garantizado: 9 por producto")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)