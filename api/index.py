import re
import time
import random
import requests
import json
from difflib import SequenceMatcher
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import lru_cache

app = Flask(__name__)
CORS(app)

IVA = 1.19
SERPER_API_KEY = "2a1e02a687f2b1e29d461b6d8acce180b707942e"

cache_resultados = {}
CACHE_TTL = 300  # 5 minutos

HEADERS_BROWSER = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "es-CL,es;q=0.9",
}

# ─── Tiendas VTEX Chile (complementan a Google Shopping) ────────────────────
VTEX_STORES = [
    {"dominio": "www.easy.cl",        "nombre": "Easy",        "prioridad": 10},
    {"dominio": "www.construmart.cl", "nombre": "Construmart", "prioridad": 10},
    {"dominio": "www.imperial.cl",    "nombre": "Imperial",    "prioridad": 9},
    {"dominio": "www.chilemat.cl",    "nombre": "Chilemat",    "prioridad": 9},
]

DOMINIOS_CHILE = {
    "sodimac":    {"dominio": "sodimac.cl",          "prioridad": 10},
    "easy":       {"dominio": "easy.cl",              "prioridad": 10},
    "construmart":{"dominio": "construmart.cl",       "prioridad": 10},
    "imperial":   {"dominio": "imperial.cl",          "prioridad": 9},
    "chilemat":   {"dominio": "chilemat.cl",          "prioridad": 9},
    "cic":        {"dominio": "cic.cl",               "prioridad": 9},
    "aceroscmpc": {"dominio": "aceroscmpc.cl",        "prioridad": 9},
    "mvm":        {"dominio": "mvm.cl",               "prioridad": 8},
    "cintac":     {"dominio": "cintac.cl",            "prioridad": 8},
    "sherwin":    {"dominio": "sherwin-williams.cl",  "prioridad": 8},
    "sipa":       {"dominio": "sipa.cl",              "prioridad": 8},
    "seton":      {"dominio": "seton.cl",             "prioridad": 8},
    "prevenco":   {"dominio": "prevenco.cl",          "prioridad": 8},
    "mercadolibre":{"dominio": "mercadolibre.cl",     "prioridad": 6},
    "falabella":  {"dominio": "falabella.com",        "prioridad": 5},
    "paris":      {"dominio": "paris.cl",             "prioridad": 5},
    "ripley":     {"dominio": "ripley.cl",            "prioridad": 5},
}

INDICADORES_EXTRANJEROS = [
    "amazon.com", "ebay.com", "aliexpress", "wish.com",
    "walmart.com", "homedepot.com", "lowes.com",
    ".com.ar", ".com.mx", ".com.pe", ".com.co",
    "mercadolibre.com.ar", "mercadolibre.com.mx",
]

MONEDAS_EXTRANJERAS = re.compile(r'\b(USD|EUR|ARS|PEN|COP|MXN)\b', re.IGNORECASE)

CATEGORIAS_PRODUCTOS = {
    "madera": {
        "palabras_clave": ["madera", "pino", "mdf", "osb", "terciado", "plywood", "listón", "tablón", "tabla", "eucalipto"],
        "tiendas_prioritarias": ["construmart", "sodimac", "easy", "placacentro"],
        "queries_extra": ["madera {producto} Chile precio", "{producto} maderas precio CLP"],
        "unidades_relevantes": ["metro", "mt", "m2", "tabla", "unidad"],
    },
    "metal_acero": {
        "palabras_clave": ["fierro", "acero", "tubo", "tubular", "barra", "pletina", "pilar", "viga", "placa acero", "ángulo", "canal", "perfil"],
        "tiendas_prioritarias": ["aceroscmpc", "mvm", "cintac"],
        "queries_extra": ["{producto} acero Chile precio", "{producto} metalúrgica Chile"],
        "unidades_relevantes": ["kg", "metro", "barra", "mt"],
    },
    "cemento_hormigon": {
        "palabras_clave": ["cemento", "cal", "arena", "grava", "estabilizado", "hormigón", "concreto", "mortero"],
        "tiendas_prioritarias": ["chilemat", "construmart", "cic"],
        "queries_extra": ["{producto} precio Chile kg", "{producto} saco Chile ferretería"],
        "unidades_relevantes": ["saco", "kg", "m3", "bolsa"],
    },
    "ferreteria_general": {
        "palabras_clave": ["clavo", "tornillo", "perno", "malla", "soldadura", "alambre", "desmoldante", "tuerca", "remache"],
        "tiendas_prioritarias": ["sodimac", "easy", "imperial", "construmart"],
        "queries_extra": ["{producto} ferretería Chile precio", "{producto} precio Chile"],
        "unidades_relevantes": ["caja", "kg", "unidad", "paquete"],
    },
    "pintura_recubrimiento": {
        "palabras_clave": ["pintura", "anticorrosivo", "esmalte", "látex", "barniz", "semibrillo", "microesferas", "imprimante", "sellador"],
        "tiendas_prioritarias": ["sherwin", "sipa", "sodimac", "easy"],
        "queries_extra": ["{producto} pintura Chile litro precio", "{producto} Chile galón precio"],
        "unidades_relevantes": ["litro", "galón", "lt", "gl", "cuñete"],
    },
    "senaletica": {
        "palabras_clave": ["letrero", "señal", "tránsito", "paso cebra", "señalética", "delineador", "tachas", "tineta", "fastrack"],
        "tiendas_prioritarias": ["seton", "prevenco"],
        "queries_extra": ["{producto} señalética Chile precio", "{producto} tránsito Chile comprar"],
        "unidades_relevantes": ["unidad", "metro", "m2", "kit"],
    },
    "herramienta_medicion": {
        "palabras_clave": ["lienza", "rollo", "plomada", "nivel", "cinta", "metro"],
        "tiendas_prioritarias": ["sodimac", "easy", "imperial"],
        "queries_extra": ["{producto} Chile precio", "{producto} ferretería Chile"],
        "unidades_relevantes": ["unidad", "metro"],
    },
}


def get_cache_key(producto, limite):
    return f"{producto}_{limite}"


def limpiar_cache_expirado():
    ahora = time.time()
    for k in [k for k, v in cache_resultados.items() if ahora - v['timestamp'] > CACHE_TTL]:
        del cache_resultados[k]


def clasificar_producto(nombre: str) -> str:
    nombre_lower = nombre.lower()
    for categoria, datos in CATEGORIAS_PRODUCTOS.items():
        for palabra in datos["palabras_clave"]:
            if palabra in nombre_lower:
                return categoria
    return "ferreteria_general"


@lru_cache(maxsize=2000)
def normalizar(texto):
    if not texto:
        return ""
    texto = texto.lower()
    for orig, rep in {'á':'a','é':'e','í':'i','ó':'o','ú':'u','ñ':'n'}.items():
        texto = texto.replace(orig, rep)
    texto = re.sub(r'(\d+)\s*[xX×]\s*(\d+)', r'\1 x \2', texto)
    texto = re.sub(r'(\d+)\s*["\']\s*[xX×]\s*(\d+)\s*["\']', r'\1 x \2', texto)
    texto = re.sub(r'(\d+)\s*["\'](?![xX×])', r'\1 pulgadas', texto)
    texto = re.sub(r'(\d+)\s*[\']', r'\1 pies', texto)
    texto = re.sub(r'([a-z])\s+(\d)', r'\1\2', texto)
    texto = re.sub(r'(\d)\s+([a-z])', r'\1\2', texto)
    texto = re.sub(r'(\d+)\s+(\d+)\/(\d+)',
                   lambda m: str(float(m.group(1)) + float(m.group(2))/float(m.group(3))), texto)
    texto = re.sub(r'(\d+)\/(\d+)',
                   lambda m: str(float(m.group(1))/float(m.group(2))), texto)
    texto = re.sub(r'[^\w\s\/\-]', ' ', texto)
    return re.sub(r'\s+', ' ', texto).strip()


def extraer_medidas(texto: str) -> dict:
    medidas = {}
    t = texto.lower()
    dim3 = re.findall(r'(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)', t)
    if dim3: medidas['dim3'] = [float(d) for d in dim3[0]]
    dim2 = re.findall(r'(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)', t)
    if dim2: medidas['dim2'] = [float(d) for d in dim2[0]]
    frac = re.findall(r'(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)', t)
    for f in frac:
        medidas['fraccion'] = float(f[0]) + float(f[1])/float(f[2]) if f[0] else float(f[3])/float(f[4])
    pulg = re.findall(r'(\d+(?:\.\d+)?)\s*(?:"|pulgadas?|pulg\b|inch)', t)
    if pulg: medidas['pulgadas'] = float(pulg[0])
    mm = re.findall(r'(\d+(?:\.\d+)?)\s*mm', t)
    if mm: medidas['mm'] = [float(m) for m in mm]
    kg = re.findall(r'(\d+(?:\.\d+)?)\s*kg', t)
    if kg: medidas['kg'] = float(kg[0])
    lts = re.findall(r'(\d+(?:\.\d+)?)\s*(?:lt|lts|litros?|l\b)', t)
    if lts: medidas['litros'] = float(lts[0])
    mts = re.findall(r'(\d+(?:\.\d+)?)\s*(?:mt|mts|metros?|m\b)', t)
    if mts: medidas['metros'] = float(mts[0])
    return medidas


def medidas_a_texto(medidas: dict) -> str:
    partes = []
    if 'dim3' in medidas:
        v = medidas['dim3']; partes.append(f"{v[0]}x{v[1]}x{v[2]}")
    if 'dim2' in medidas:
        v = medidas['dim2']; partes.append(f"{v[0]}x{v[1]}")
    if 'fraccion' in medidas: partes.append(f"{medidas['fraccion']:.2f}\"")
    if 'pulgadas' in medidas: partes.append(f"{medidas['pulgadas']}\"")
    if 'mm' in medidas:
        mm = medidas['mm']; partes.append(f"{mm[0] if isinstance(mm, list) else mm}mm")
    if 'kg' in medidas: partes.append(f"{medidas['kg']}kg")
    if 'litros' in medidas: partes.append(f"{medidas['litros']}lt")
    if 'metros' in medidas: partes.append(f"{medidas['metros']}m")
    return ", ".join(partes) if partes else "sin medidas"


def comparar_medidas(medidas_b: dict, medidas_e: dict) -> float:
    if not medidas_b: return 0.5
    if not medidas_e: return 0.0
    coincidencias = total = 0
    for key, val_b in medidas_b.items():
        total += 1
        val_e = medidas_e.get(key)
        if val_e is None: continue
        if isinstance(val_b, list) and isinstance(val_e, list):
            if len(val_b) == len(val_e) and all(abs(a-b) < 0.5 for a, b in zip(sorted(val_b), sorted(val_e))):
                coincidencias += 1
        elif isinstance(val_b, (int, float)) and isinstance(val_e, (int, float)):
            if abs(val_b - val_e) <= max(0.1, val_b * 0.1): coincidencias += 1
        elif isinstance(val_b, list) and isinstance(val_e, (int, float)):
            if len(val_b) == 1 and abs(val_b[0] - val_e) < 0.5: coincidencias += 1
        elif isinstance(val_e, list) and isinstance(val_b, (int, float)):
            if len(val_e) == 1 and abs(val_b - val_e[0]) < 0.5: coincidencias += 1
    return coincidencias / total if total > 0 else 0.5


def extraer_especificaciones(texto: str) -> set:
    specs = set()
    t = normalizar(texto)
    for m in ['acero','hierro','fierro','pino','madera','cemento','cal','arena']:
        if m in t: specs.add(m)
    for tp in ['estriado','liso','bruto','estructural','tubular','cuadrado','rectangular',
               'redondo','galvanizado','cepillado','anticorrosivo','semibrillo']:
        if tp in t: specs.add(tp)
    if 'bruto' in t or 'sin cepillar' in t: specs.add('bruto')
    specs.update(re.findall(r'\b[a-z]+\d+\b', t))
    return specs


def calcular_concordancia(buscado: str, encontrado: str) -> int:
    b_norm = normalizar(buscado)
    e_norm = normalizar(encontrado)
    if not b_norm or not e_norm: return 0
    seq_ratio = SequenceMatcher(None, b_norm, e_norm).ratio()
    palabras_b = set(b_norm.split())
    palabras_e = set(e_norm.split())
    palabras_b_f = {p for p in palabras_b if len(p) > 2}
    jaccard = len(palabras_b_f & palabras_e) / len(palabras_b_f) if palabras_b_f else 0.5
    equiv = {'bruto':'sin cepillar','fierro':'acero','acero':'fierro',
             'anticorrosivo':'antioxidante','pino':'pino radiata','pino radiata':'pino'}
    b_eq, e_eq = b_norm, e_norm
    for orig, rep in equiv.items():
        b_eq = b_eq.replace(orig, rep)
        e_eq = e_eq.replace(orig, rep)
    seq_eq = SequenceMatcher(None, b_eq, e_eq).ratio()
    medidas_b = extraer_medidas(buscado)
    medidas_e = extraer_medidas(encontrado)
    med_score = comparar_medidas(medidas_b, medidas_e)
    bono = 0
    if medidas_b and medidas_e:
        bono = 15 if med_score >= 0.95 else (8 if med_score >= 0.7 else 0)
    specs_b = extraer_especificaciones(buscado)
    specs_e = extraer_especificaciones(encontrado)
    spec_match = len(specs_b & specs_e) / len(specs_b) if specs_b else 0.5
    score = (seq_ratio*0.15 + jaccard*0.30 + seq_eq*0.15 + med_score*0.25 + spec_match*0.15) * 100 + bono
    imp = {p for p in palabras_b_f if p in ['pino','madera','acero','fierro','cemento','pintura']}
    if imp: score -= len(imp - palabras_e) * 8
    if medidas_b and not medidas_e: score -= 15
    if len(palabras_b_f - palabras_e) > 3: score -= 10
    return round(min(100, max(0, score)))


def clasificar_concordancia(score: int):
    if score >= 90: return "exacta", "✅ Coincidencia exacta"
    if score >= 75: return "alta", "🟢 Alta coincidencia"
    if score >= 60: return "parcial", "🟡 Coincidencia parcial"
    if score >= 40: return "baja", "🟠 Baja coincidencia"
    return "nula", "🔴 Sin coincidencia"


def inferir_tipo_producto(nombre: str) -> dict:
    n = nombre.lower()
    return {
        "maquinaria_pesada": any(p in n for p in ["retroexcavadora","minicargador","grúa","compactador","pavimentadora"]),
        "herramienta_electrica": any(p in n for p in ["taladro","amoladora","sierra","esmeril","compresor","soldadora"]),
        "material_construccion": any(p in n for p in ["cemento","hormigón","arena","grava","madera","fierro","acero","tubo","placa","tabla","barra"]),
        "articulo_pequeno": any(p in n for p in ["clavo","tornillo","perno","tuerca","remache","tarugos"]),
        "pintura_quimico": any(p in n for p in ["pintura","anticorrosivo","barniz","esmalte","sellador","impermeabilizante"]),
        "senaletica_vial": any(p in n for p in ["letrero","señal","tránsito","paso cebra","tachas","delineador"]),
    }


def analizar_producto_buscado(nombre: str) -> dict:
    categoria = clasificar_producto(nombre)
    medidas = extraer_medidas(nombre)
    specs = list(extraer_especificaciones(nombre))
    nombre_norm = normalizar(nombre)
    palabras = [p for p in nombre_norm.split() if len(p) > 2]
    marcas = ["sherwin","sipa","gerdau","cintac","arauco","masisa","melon","stanley","bosch","dewalt","makita","hilti","sika"]
    return {
        "nombre_original": nombre,
        "nombre_normalizado": nombre_norm,
        "categoria": categoria,
        "palabras_clave": palabras,
        "medidas": {"tiene_medidas": bool(medidas), "detalle": medidas, "texto_legible": medidas_a_texto(medidas)},
        "especificaciones_tecnicas": specs,
        "unidades_relevantes": CATEGORIAS_PRODUCTOS.get(categoria, {}).get("unidades_relevantes", []),
        "es_accesorio": any(p in nombre.lower() for p in ["repuesto","accesorio","disco","carbón","estuche","funda"]),
        "marca_detectada": next((m for m in marcas if m in nombre.lower()), None),
        "tipo_producto": inferir_tipo_producto(nombre),
    }


def analizar_resultado_encontrado(resultado: dict, analisis_buscado: dict) -> dict:
    nombre = resultado.get("nombre", "")
    medidas_e = extraer_medidas(nombre)
    score = calcular_concordancia(analisis_buscado["nombre_original"], nombre)
    medidas_b = analisis_buscado["medidas"]["detalle"]
    conflicto = bool(medidas_b and medidas_e and comparar_medidas(medidas_b, medidas_e) < 0.5)
    palabras_b = set(analisis_buscado["palabras_clave"])
    palabras_e = set(normalizar(nombre).split())
    return {
        "medidas_encontradas": medidas_a_texto(medidas_e),
        "specs_encontradas": list(extraer_especificaciones(nombre)),
        "score_python": score,
        "nivel_python": clasificar_concordancia(score)[0],
        "palabras_comunes": list(palabras_b & palabras_e),
        "palabras_faltantes": list(palabras_b - palabras_e),
        "conflicto_medidas": conflicto,
    }


def limpiar_nombre(nombre: str) -> str:
    nombre = re.sub(r'\s*[\|–—]\s*.*$', '', nombre)
    nombre = re.sub(r'\s*MercadoLibre.*$', '', nombre, flags=re.IGNORECASE)
    nombre = re.sub(r'\s*Envío\s*(gratis|internacional|express).*$', '', nombre, flags=re.IGNORECASE)
    nombre = re.sub(r'\s*✓.*$', '', nombre)
    nombre = re.sub(r'\s*\(.*?\)$', '', nombre)
    return re.sub(r'\s+', ' ', nombre).strip()


def limpiar_precio(raw_price) -> int | None:
    precio_str = re.sub(r'[^\d]', '', str(raw_price))
    if not precio_str: return None
    precio = int(precio_str)
    return precio if 500 <= precio <= 500_000_000 else None


def es_resultado_chileno(item: dict) -> bool:
    url = item.get('url', item.get('link', '')).lower()
    tienda = item.get('tienda', item.get('source', '')).lower()
    for ind in INDICADORES_EXTRANJEROS:
        if ind in url or ind in tienda: return False
    if MONEDAS_EXTRANJERAS.search(str(item.get('price', item.get('precio_con_iva', '')))):
        return False
    if '.cl' in url: return True
    if any(v['dominio'] in url for v in DOMINIOS_CHILE.values()): return True
    if 'mercadolibre' in url and '/mlc' in url.lower(): return True
    return item.get('fuente', '') in ('mercadolibre_cl', 'vtex_direct', 'sodimac_direct')


def prioridad_tienda(url: str, tienda: str) -> int:
    url_l = url.lower(); tienda_l = tienda.lower()
    for nombre, datos in DOMINIOS_CHILE.items():
        if datos['dominio'] in url_l or nombre in tienda_l:
            return datos['prioridad']
    return 3


# ─── MercadoLibre Chile ───────────────────────────────────────────────────────

def buscar_mercadolibre(producto: str, limite: int = 15):
    cache_key = get_cache_key(f"ml_{producto}", limite)
    if cache_key in cache_resultados:
        return cache_resultados[cache_key]['data']
    try:
        r = requests.get(
            "https://api.mercadolibre.com/sites/MLC/search",
            params={"q": producto, "limit": limite, "condition": "new"},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=8
        )
        if r.status_code != 200:
            print(f"  [ML] HTTP {r.status_code}")
            return []
        resultados = []
        for item in r.json().get("results", []):
            precio = item.get("price", 0)
            if precio <= 0: continue
            nombre = limpiar_nombre(item.get("title", ""))
            if len(nombre) < 4: continue
            permalink = item.get("permalink", "")
            if "mercadolibre.cl" not in permalink and "/MLC" not in permalink: continue
            resultados.append({
                "tienda": "MercadoLibre Chile",
                "nombre": nombre[:150],
                "precio_con_iva": round(precio),
                "url": permalink,
                "fuente": "mercadolibre_cl",
                "pais": "CL",
            })
        if resultados:
            cache_resultados[cache_key] = {'data': resultados, 'timestamp': time.time()}
        return resultados
    except Exception as e:
        print(f"  [ML] Error: {e}")
        return []


# ─── Google Shopping via Serper (fuente principal de la web) ─────────────────

SERPER_QUOTA_AGOTADA = False  # Flag global para evitar llamadas inútiles


def fetch_serper(query: str, search_type: str = "shopping", retries: int = 2) -> dict:
    global SERPER_QUOTA_AGOTADA
    if SERPER_QUOTA_AGOTADA:
        print("  [Serper] ⛔ Cuota agotada — omitiendo llamada")
        return {}
    url = f"https://google.serper.dev/{search_type}"
    payload = json.dumps({"q": query, "gl": "cl", "hl": "es", "num": 20, "location": "Chile"})
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    for intento in range(retries):
        try:
            r = requests.post(url, headers=headers, data=payload, timeout=10)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (402, 429):
                SERPER_QUOTA_AGOTADA = True
                print(f"  [Serper] ⛔ CUOTA AGOTADA (HTTP {r.status_code}) — se desactiva Serper para esta sesión")
                return {}
            print(f"  [Serper] HTTP {r.status_code} en intento {intento+1}")
            time.sleep(0.3)
        except Exception as e:
            print(f"  [Serper] Intento {intento+1}: {e}")
            time.sleep(0.3)
    return {}


# ─── Sodimac Chile (Oracle Commerce Cloud) ───────────────────────────────────

def buscar_sodimac(query: str, limite: int = 12):
    cache_key = get_cache_key(f"sodimac_{query}", limite)
    if cache_key in cache_resultados:
        return cache_resultados[cache_key]['data']
    try:
        r = requests.get(
            "https://www.sodimac.cl/s/search/resources/v2/summary",
            params={"Ntt": query, "Nrpp": limite, "No": 0, "lang": "es-cl",
                    "Ns": "product.sortPrice|0", "country": "CL"},
            headers=HEADERS_BROWSER,
            timeout=8
        )
        if r.status_code != 200:
            print(f"  [Sodimac] HTTP {r.status_code}")
            return []
        data = r.json()
        records = (
            data.get("resultList", {}).get("Record", [])
            or (data.get("mainContent") or [{}])[0].get("contents", [{}])[0].get("records", [])
            or []
        )
        resultados = []
        for rec in records[:limite]:
            attrs = rec.get("attributes", {})
            nombre_raw = attrs.get("product.displayName", [""])
            nombre = limpiar_nombre(str(nombre_raw[0] if isinstance(nombre_raw, list) else nombre_raw))
            if len(nombre) < 4: continue
            precio_raw = attrs.get("product.salePrice", attrs.get("product.listPrice", ["0"]))
            if isinstance(precio_raw, list): precio_raw = precio_raw[0]
            precio = limpiar_precio(str(precio_raw).replace(".", "").replace(",", ""))
            if not precio: continue
            url_raw = attrs.get("product.productUrl", [""])
            url_raw = url_raw[0] if isinstance(url_raw, list) else url_raw
            url_prod = f"https://www.sodimac.cl{url_raw}" if url_raw and not url_raw.startswith("http") else url_raw
            resultados.append({
                "tienda": "Sodimac",
                "nombre": nombre[:150],
                "precio_con_iva": precio,
                "url": url_prod,
                "fuente": "sodimac_direct",
                "pais": "CL",
            })
        if resultados:
            cache_resultados[cache_key] = {'data': resultados, 'timestamp': time.time()}
        print(f"  [Sodimac] {len(resultados)} productos")
        return resultados
    except Exception as e:
        print(f"  [Sodimac] Error: {e}")
        return []


def buscar_google_shopping(producto: str, limite: int = 20):
    cache_key = get_cache_key(f"gs_{producto}", limite)
    if cache_key in cache_resultados:
        return cache_resultados[cache_key]['data']
    query = f"{producto} precio Chile"
    data = fetch_serper(query, "shopping")
    items = data.get('shopping', [])
    resultados = []
    for item in items[:limite * 2]:
        precio = limpiar_precio(item.get('price', ''))
        if precio is None: continue
        nombre = limpiar_nombre(item.get('title', ''))
        if len(nombre) < 4: continue
        url_item = item.get('link', '')
        tienda = item.get('source', 'Tienda Chile')
        # Serper ya filtra por Chile (gl=cl, location=Chile) — no aplicamos filtro extra
        # Solo excluimos dominios claramente extranjeros
        skip = False
        for ind in INDICADORES_EXTRANJEROS:
            if ind in url_item.lower() or ind in tienda.lower():
                skip = True; break
        if skip: continue
        resultados.append({
            "tienda": tienda[:40],
            "nombre": nombre[:150],
            "precio_con_iva": precio,
            "url": url_item,
            "fuente": "google_shopping_cl",
            "pais": "CL",
        })
    if resultados:
        cache_resultados[cache_key] = {'data': resultados, 'timestamp': time.time()}
    return resultados


def buscar_web_organica(producto: str, categoria: str, limite: int = 8):
    datos_cat = CATEGORIAS_PRODUCTOS.get(categoria, CATEGORIAS_PRODUCTOS["ferreteria_general"])
    queries_extra = datos_cat.get("queries_extra", [])
    resultados = []
    for query_template in queries_extra[:2]:
        query = query_template.format(producto=producto)
        data = fetch_serper(query, "search")
        for item in data.get('organic', [])[:5]:
            url_item = item.get('link', '')
            tienda = item.get('displayLink', item.get('source', ''))
            nombre = item.get('title', '')
            snippet = item.get('snippet', '')
            precio_m = re.search(r'\$\s*([\d\.,]+)', snippet)
            if not precio_m: continue
            precio = limpiar_precio(precio_m.group(1))
            if precio is None: continue
            # Excluir solo dominios claramente extranjeros
            skip = any(ind in url_item.lower() for ind in INDICADORES_EXTRANJEROS)
            if skip: continue
            resultados.append({
                "tienda": tienda[:40],
                "nombre": limpiar_nombre(nombre)[:150],
                "precio_con_iva": precio,
                "url": url_item,
                "fuente": "web_organica",
                "pais": "CL",
            })
        time.sleep(random.uniform(0.2, 0.4))
    return resultados


# ─── VTEX stores (Easy, Construmart, Imperial, Chilemat) ─────────────────────
# Fuente ADICIONAL — no reemplaza Google Shopping

def buscar_vtex(store: dict, query: str, limite: int = 8):
    cache_key = get_cache_key(f"vtex_{store['nombre']}_{query}", limite)
    if cache_key in cache_resultados:
        return cache_resultados[cache_key]['data']
    try:
        r = requests.get(
            f"https://{store['dominio']}/api/catalog_system/pub/products/search",
            params={"ft": query, "_from": 0, "_to": limite - 1},
            headers=HEADERS_BROWSER,
            timeout=8
        )
        if r.status_code != 200: return []
        resultados = []
        for prod in r.json():
            nombre = limpiar_nombre(prod.get("productName", ""))
            if len(nombre) < 4: continue
            precio = None
            link = prod.get("link", "")
            for item in prod.get("items", []):
                for seller in item.get("sellers", []):
                    offer = seller.get("commertialOffer", {})
                    if offer.get("AvailableQuantity", 0) > 0:
                        precio = offer.get("Price", 0)
                        break
                if precio: break
            if not precio or precio < 500: continue
            if not link.startswith("http"):
                link = f"https://{store['dominio']}{link}"
            resultados.append({
                "tienda": store["nombre"],
                "nombre": nombre[:150],
                "precio_con_iva": round(precio),
                "url": link,
                "fuente": "vtex_direct",
                "pais": "CL",
            })
        cache_resultados[cache_key] = {'data': resultados, 'timestamp': time.time()}
        print(f"  [{store['nombre']} VTEX] {len(resultados)} productos")
        return resultados
    except Exception as e:
        print(f"  [{store['nombre']} VTEX] Error: {e}")
        return []


# ─── Generador de queries ─────────────────────────────────────────────────────

def generar_queries(producto: str, categoria: str) -> list:
    queries = [f"{producto} Chile precio"]
    prod_norm = re.sub(r'(\d+)\s*"', r'\1 pulgadas', producto)
    prod_norm = re.sub(r'(\d+)\s*\'', r'\1 pies', prod_norm)
    if prod_norm != producto: queries.append(f"{prod_norm} precio Chile")
    def expandir(txt):
        return re.sub(r'(\d+)\s+(\d+)\/(\d+)',
            lambda m: str(float(m.group(1)) + float(m.group(2))/float(m.group(3))), txt)
    prod_frac = expandir(producto)
    if prod_frac != producto: queries.append(f"{prod_frac} Chile")
    terminos_extra = {
        "madera": ["maderera Chile", "tablón Chile"],
        "metal_acero": ["acero Chile CLP", "metalúrgica Chile"],
        "cemento_hormigon": ["saco Chile CLP"],
        "senaletica": ["señalética tránsito Chile"],
        "pintura_recubrimiento": ["galón Chile", "litro Chile CLP"],
    }
    for termino in terminos_extra.get(categoria, []):
        queries.append(f"{producto} {termino}")
    return list(dict.fromkeys(queries))[:4]


# ─── BÚSQUEDA PRINCIPAL ───────────────────────────────────────────────────────

def realizar_busqueda(producto: str, limite: int = 15):
    print(f"\n  🔍 Producto: {producto}")
    categoria = clasificar_producto(producto)
    print(f"  📂 Categoría: {categoria}")
    limpiar_cache_expirado()

    resultados = []
    urls_vistas = set()

    def agregar(nuevos):
        for r in nuevos:
            url = r.get('url', '')
            clave = url or normalizar(r.get('nombre', ''))
            if clave and clave not in urls_vistas:
                urls_vistas.add(clave)
                resultados.append(r)

    # ── Fase 1: Todas las fuentes libres + Google Shopping en paralelo ──────────
    print(f"  📡 Fase 1: MercadoLibre + Sodimac + Google Shopping + VTEX...")
    with ThreadPoolExecutor(max_workers=7) as ex:
        futures = {
            ex.submit(buscar_mercadolibre, producto, limite): "MercadoLibre",
            ex.submit(buscar_sodimac, producto, 10): "Sodimac",
            ex.submit(buscar_google_shopping, producto, limite): "Google Shopping",
        }
        for store in VTEX_STORES:
            futures[ex.submit(buscar_vtex, store, producto, 6)] = store["nombre"]

        for future in as_completed(futures, timeout=12):
            nombre_f = futures[future]
            try:
                nuevos = future.result()
                agregar(nuevos)
                print(f"  ✅ {nombre_f}: {len(nuevos)} | Total: {len(resultados)}")
            except Exception as e:
                print(f"  ❌ {nombre_f}: {e}")

    # ── Fase 2: Queries adicionales si hay pocos resultados ───────────────────
    if len(resultados) < 9:
        queries = generar_queries(producto, categoria)
        for query in queries[1:3]:
            if len(resultados) >= 9: break
            print(f"  📡 Variación Serper: '{query[:50]}'...")
            time.sleep(random.uniform(0.2, 0.3))
            agregar(buscar_google_shopping(query, 8))

    # ── Fase 3: Web orgánica si sigue habiendo muy pocos resultados ───────────
    if len(resultados) < 5:
        print(f"  📡 Búsqueda web orgánica especializada...")
        agregar(buscar_web_organica(producto, categoria))

    if not resultados:
        return [], {}

    # ── Scoring y ranking ─────────────────────────────────────────────────────
    analisis_buscado = analizar_producto_buscado(producto)
    for r in resultados:
        ar = analizar_resultado_encontrado(r, analisis_buscado)
        score = ar["score_python"]
        nivel, etiqueta = clasificar_concordancia(score)
        r.update({
            "score": score,
            "nivel_concordancia": nivel,
            "etiqueta_concordancia": etiqueta,
            "prioridad_tienda": prioridad_tienda(r.get("url", ""), r.get("tienda", "")),
            "categoria": categoria,
            "precio_neto": round(r["precio_con_iva"] / IVA),
            "precio_formateado": f"${r['precio_con_iva']:,.0f}".replace(",", "."),
            "_analisis": ar,
        })

    resultados.sort(key=lambda x: (-x["score"], -x["prioridad_tienda"], x["precio_con_iva"]))
    filtrados = [r for r in resultados if r["score"] >= 10] or resultados
    return filtrados[:limite], analisis_buscado


# ─── ENDPOINT ─────────────────────────────────────────────────────────────────

@app.route("/python/busqueda-robusta", methods=["GET"])
def busqueda_robusta():
    producto = request.args.get("producto", "").strip()
    numero_item = request.args.get("numero", "")
    minimo_requerido = int(request.args.get("minimo", 15))
    force_refresh = request.args.get("force", "").lower() == "true"

    print(f"\n{'='*60}\n🔍 [{numero_item}] {producto}\n{'='*60}")

    if not producto:
        return jsonify({"numero_item": numero_item, "producto": producto, "resultados": [],
                        "total_encontrados": 0, "suficientes": False, "deficit": minimo_requerido,
                        "categoria": "desconocida", "analisis_producto": {}})

    if force_refresh:
        for k in [k for k in cache_resultados if producto.lower() in k.lower()]:
            del cache_resultados[k]
        print(f"  🔄 Cache limpiado para: {producto}")

    resultados, analisis_buscado = realizar_busqueda(producto, minimo_requerido * 2)

    resultados_formateados = []
    for r in resultados:
        ar = r.pop("_analisis", {})
        resultados_formateados.append({
            "tienda": r.get("tienda", ""),
            "nombre": r.get("nombre", ""),
            "precio_valor": r.get("precio_con_iva", 0),
            "precio_neto": r.get("precio_neto", 0),
            "precio_formateado": r.get("precio_formateado", "Consultar"),
            "link": r.get("url", ""),
            "canal": r.get("fuente", "web"),
            "pais": "CL",
            "busqueda_original": producto,
            "score": r.get("score", 0),
            "nivel_concordancia": r.get("nivel_concordancia", ""),
            "etiqueta_concordancia": r.get("etiqueta_concordancia", ""),
            "categoria": r.get("categoria", ""),
            "prioridad_tienda": r.get("prioridad_tienda", 3),
            "medidas_encontradas": ar.get("medidas_encontradas", ""),
            "specs_encontradas": ar.get("specs_encontradas", []),
            "palabras_comunes": ar.get("palabras_comunes", []),
            "palabras_faltantes": ar.get("palabras_faltantes", []),
            "conflicto_medidas": ar.get("conflicto_medidas", False),
        })

    tiene_suficientes = len(resultados_formateados) >= minimo_requerido
    mejor = resultados_formateados[0] if resultados_formateados else None

    print(f"\n📊 TOTAL: {len(resultados_formateados)} resultados chilenos")
    print(f"✅ Suficientes: {tiene_suficientes}")
    if mejor:
        print(f"🏆 Mejor: {mejor['tienda']} → ${mejor['precio_valor']:,} ({mejor['score']}%)")
    print("=" * 60)

    return jsonify({
        "numero_item": numero_item,
        "producto": producto,
        "categoria": clasificar_producto(producto),
        "resultados": resultados_formateados,
        "total_encontrados": len(resultados_formateados),
        "suficientes": tiene_suficientes,
        "deficit": max(0, minimo_requerido - len(resultados_formateados)),
        "pais_busqueda": "CL",
        "analisis_producto": analisis_buscado,
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "pais": "Chile 🇨🇱",
        "cache_size": len(cache_resultados),
        "serper_activo": not SERPER_QUOTA_AGOTADA,
        "fuentes": ["Google Shopping (Serper)", "MercadoLibre Chile"] + [s["nombre"] for s in VTEX_STORES],
        "version": "4.1"
    })


@app.route("/python/diagnostico", methods=["GET"])
def diagnostico():
    """Prueba cada fuente y reporta estado detallado. Útil para depurar en producción."""
    resultado = {}

    # Test MercadoLibre
    try:
        r = requests.get(
            "https://api.mercadolibre.com/sites/MLC/search",
            params={"q": "tornillo", "limit": 3, "condition": "new"},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=8
        )
        items = r.json().get("results", []) if r.status_code == 200 else []
        resultado["mercadolibre"] = {
            "ok": len(items) > 0, "http": r.status_code,
            "resultados": len(items),
            "muestra": items[0].get("title", "") if items else ""
        }
    except Exception as e:
        resultado["mercadolibre"] = {"ok": False, "error": str(e)}

    # Test Serper
    try:
        data = fetch_serper("tornillo Chile", "shopping")
        items = data.get("shopping", [])
        resultado["serper"] = {
            "ok": len(items) > 0, "cuota_agotada": SERPER_QUOTA_AGOTADA,
            "resultados": len(items),
            "muestra": items[0].get("title", "") if items else ""
        }
    except Exception as e:
        resultado["serper"] = {"ok": False, "error": str(e)}

    # Test Sodimac
    try:
        r = requests.get(
            "https://www.sodimac.cl/s/search/resources/v2/summary",
            params={"Ntt": "tornillo", "Nrpp": 3, "No": 0, "lang": "es-cl"},
            headers=HEADERS_BROWSER, timeout=8
        )
        resultado["sodimac"] = {"ok": r.status_code == 200, "http": r.status_code,
                                "bytes": len(r.content) if r.status_code == 200 else 0}
    except Exception as e:
        resultado["sodimac"] = {"ok": False, "error": str(e)}

    # Test VTEX Easy
    try:
        r = requests.get(
            "https://www.easy.cl/api/catalog_system/pub/products/search",
            params={"ft": "tornillo", "_from": 0, "_to": 2},
            headers=HEADERS_BROWSER, timeout=6
        )
        items = r.json() if r.status_code == 200 else []
        resultado["vtex_easy"] = {"ok": len(items) > 0, "http": r.status_code, "resultados": len(items)}
    except Exception as e:
        resultado["vtex_easy"] = {"ok": False, "error": str(e)}

    alguna_ok = any(v.get("ok") for v in resultado.values())
    recomendacion = []
    if not resultado.get("mercadolibre", {}).get("ok"):
        recomendacion.append("⚠️ MercadoLibre no responde desde este servidor")
    if not resultado.get("serper", {}).get("ok"):
        recomendacion.append("⚠️ Serper sin resultados — verifica créditos en serper.dev")
    if not resultado.get("vtex_easy", {}).get("ok"):
        recomendacion.append("⚠️ VTEX Easy bloqueado desde este servidor (posible restricción geo)")

    return jsonify({
        "estado_general": "operativo" if alguna_ok else "todas_las_fuentes_fallan",
        "fuentes": resultado,
        "recomendaciones": recomendacion,
        "server_ip_hint": request.environ.get("HTTP_X_FORWARDED_FOR", request.remote_addr),
    })


@app.route("/python/cache/clear", methods=["POST"])
def clear_cache():
    cache_resultados.clear()
    return jsonify({"status": "ok", "mensaje": "Caché limpiado"})


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 BUSCADOR CHILE — GRUPO ICA v4.1")
    print("   FUENTES PRIMARIAS:")
    print("   • Google Shopping Chile (Serper) ← principal")
    print("   • MercadoLibre Chile (API oficial)")
    print("   FUENTES ADICIONALES (gratis):")
    print("   • Easy, Construmart, Imperial, Chilemat (VTEX directo)")
    print("   FALLBACK:")
    print("   • Web orgánica Serper (solo si < 5 resultados)")
    print("   ARQUITECTURA: ThreadPoolExecutor (paralelo)")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)
