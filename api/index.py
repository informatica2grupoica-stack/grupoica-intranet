import re
import io
import urllib.parse
import time
import random
import requests
import json
from datetime import datetime
from difflib import SequenceMatcher
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from functools import lru_cache
try:
    from bs4 import BeautifulSoup
    BS4_DISPONIBLE = True
except ImportError:
    BS4_DISPONIBLE = False
try:
    import openpyxl
    OPENPYXL_DISPONIBLE = True
except ImportError:
    OPENPYXL_DISPONIBLE = False

app = Flask(__name__)
CORS(app)

IVA = 1.19

cache_resultados = {}
CACHE_TTL = 300  # 5 minutos

HEADERS_BROWSER = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "es-CL,es;q=0.9",
}

# ─── Tiendas VTEX Chile ───────────────────────────────────────────────────────
# Desde IP real (notebook) todas funcionan — en Vercel algunas bloqueaban
VTEX_STORES = [
    {"dominio": "www.easy.cl",        "nombre": "Easy",        "prioridad": 10},
    {"dominio": "www.construmart.cl", "nombre": "Construmart", "prioridad": 10},
    {"dominio": "www.imperial.cl",    "nombre": "Imperial",    "prioridad": 9},
    {"dominio": "www.chilemat.cl",    "nombre": "Chilemat",    "prioridad": 9},
    {"dominio": "www.placacentro.cl", "nombre": "Placacentro", "prioridad": 9},
]

DOMINIOS_CHILE = {
    "sodimac":     {"dominio": "sodimac.cl",         "prioridad": 10},
    "easy":        {"dominio": "easy.cl",             "prioridad": 10},
    "construmart": {"dominio": "construmart.cl",      "prioridad": 10},
    "imperial":    {"dominio": "imperial.cl",         "prioridad": 9},
    "chilemat":    {"dominio": "chilemat.cl",         "prioridad": 9},
    "placacentro": {"dominio": "placacentro.cl",      "prioridad": 9},
    "cic":         {"dominio": "cic.cl",              "prioridad": 9},
    "aceroscmpc":  {"dominio": "aceroscmpc.cl",       "prioridad": 9},
    "mvm":         {"dominio": "mvm.cl",              "prioridad": 8},
    "cintac":      {"dominio": "cintac.cl",           "prioridad": 8},
    "sherwin":     {"dominio": "sherwin-williams.cl", "prioridad": 8},
    "sipa":        {"dominio": "sipa.cl",             "prioridad": 8},
    "seton":       {"dominio": "seton.cl",            "prioridad": 8},
    "prevenco":    {"dominio": "prevenco.cl",         "prioridad": 8},
    "mercadolibre":{"dominio": "mercadolibre.cl",     "prioridad": 6},
    "falabella":   {"dominio": "falabella.com",       "prioridad": 5},
    "paris":       {"dominio": "paris.cl",            "prioridad": 5},
    "ripley":      {"dominio": "ripley.cl",           "prioridad": 5},
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


# ─── Google Shopping scraper ──────────────────────────────────────────────────
# Replica lo que hacía Serper: retorna tarjetas Shopping con precio + tienda.
# Funciona desde IP real (notebook/oficina) sin CAPTCHA ni API key.

def buscar_google_shopping(producto: str, limite: int = 15):
    cache_key = get_cache_key(f"gshop_{producto}", limite)
    if cache_key in cache_resultados:
        return cache_resultados[cache_key]['data']
    if not BS4_DISPONIBLE:
        return []
    try:
        r = requests.get(
            "https://www.google.cl/search",
            params={"q": producto, "tbm": "shop", "hl": "es", "gl": "cl", "num": 30},
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,*/*",
                "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Referer": "https://www.google.cl/",
                "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124"',
                "sec-ch-ua-platform": '"Windows"',
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "navigate",
            },
            timeout=(5, 10)
        )
        if r.status_code != 200:
            print(f"  [GShop] HTTP {r.status_code}")
            return []

        soup = BeautifulSoup(r.text, "lxml")
        resultados = []

        # ── Estrategia 1: tarjetas Shopping clásicas ──────────────────────────
        cards = (soup.select("div.sh-dgr__content")
                 or soup.select("div.KZmu8e")
                 or soup.select("li.sh-dlr__list-result"))

        for card in cards:
            name_el = card.select_one("h3, div.EI11Pd, [role='heading'], .translate-content, .tAxDx")
            if not name_el:
                continue
            nombre = limpiar_nombre(name_el.get_text(strip=True))
            if len(nombre) < 4:
                continue

            precio = None
            for price_sel in ["span.a8Pemb", "div.e10twf", "span.kHxwFf", "b", "strong"]:
                pel = card.select_one(price_sel)
                if not pel:
                    continue
                txt = pel.get("aria-label", "") or pel.get_text(strip=True)
                pm = re.search(r'\$\s*([\d\.,]+)', txt)
                if pm:
                    precio = limpiar_precio(re.sub(r'[^\d]', '', pm.group(1)))
                    if precio:
                        break
            if not precio:
                pm = re.search(r'\$\s*([\d\.]{3,})', card.get_text())
                if pm:
                    precio = limpiar_precio(re.sub(r'[^\d]', '', pm.group(1)))
            if not precio:
                continue

            store_el = card.select_one("div.aULzUe, div.IuHnof, div.LbUacb, span.E5ocAb, .qIEPib")
            tienda = store_el.get_text(strip=True)[:40] if store_el else "Tienda Chile"

            link_el = card.select_one("a[href]")
            url_prod = link_el.get("href", "") if link_el else ""
            if url_prod.startswith("/"):
                url_prod = "https://www.google.cl" + url_prod

            if any(ind in tienda.lower() or ind in url_prod.lower() for ind in INDICADORES_EXTRANJEROS):
                continue

            resultados.append({
                "tienda": tienda,
                "nombre": nombre[:150],
                "precio_con_iva": precio,
                "url": url_prod,
                "fuente": "google_shopping",
                "pais": "CL",
            })
            if len(resultados) >= limite:
                break

        # ── Estrategia 2: JSON incrustado en <script> ─────────────────────────
        if not resultados:
            for script in soup.select("script"):
                txt = script.string or ""
                if '"Price"' not in txt and '"price"' not in txt:
                    continue
                pairs = re.findall(
                    r'"(?:title|name)"\s*:\s*"([^"]{5,})"[^}]{0,200}"[Pp]rice"\s*:\s*"?\$?\s*([\d\.,]+)',
                    txt
                )
                for nombre_raw, precio_raw in pairs[:limite]:
                    p = limpiar_precio(re.sub(r'[^\d]', '', precio_raw))
                    if p:
                        resultados.append({
                            "tienda": "Google Shopping",
                            "nombre": limpiar_nombre(nombre_raw)[:150],
                            "precio_con_iva": p,
                            "url": "",
                            "fuente": "google_shopping",
                            "pais": "CL",
                        })
                if resultados:
                    break

        if resultados:
            cache_resultados[cache_key] = {"data": resultados, "timestamp": time.time()}
        print(f"  [GShop] {len(resultados)} resultados")
        return resultados
    except Exception as e:
        print(f"  [GShop] Error: {e}")
        return []


# ─── DuckDuckGo HTML (GET — maneja 200 y 202) ────────────────────────────────

def buscar_duckduckgo(producto: str, limite: int = 12):
    cache_key = get_cache_key(f"ddg_{producto}", limite)
    if cache_key in cache_resultados:
        return cache_resultados[cache_key]['data']
    if not BS4_DISPONIBLE:
        return []
    try:
        query = f"{producto} precio Chile comprar"
        r = requests.get(
            "https://html.duckduckgo.com/html/",
            params={"q": query, "kl": "cl-es"},
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
                "Accept-Language": "es-CL,es;q=0.9",
                "Accept-Encoding": "gzip, deflate",
                "Referer": "https://duckduckgo.com/",
            },
            timeout=(5, 10),
            allow_redirects=True,
        )
        # DDG puede responder 200 o 202 — en ambos casos el HTML está en r.text
        if r.status_code not in (200, 202):
            print(f"  [DDG] HTTP {r.status_code}")
            return []

        soup = BeautifulSoup(r.text, "lxml")
        resultados = []

        for result in soup.select(".result")[:limite * 3]:
            a_tag = result.select_one(".result__a")
            snippet_tag = result.select_one(".result__snippet")
            if not a_tag:
                continue
            title = a_tag.get_text(strip=True)
            raw_href = a_tag.get("href", "")

            # Extraer URL real del redirect DDG (/l/?uddg=...)
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(raw_href).query)
            url_res = qs.get("uddg", [raw_href])[0]
            if not url_res.startswith("http"):
                continue

            url_low = url_res.lower()
            if not any(x in url_low for x in [".cl", "mercadolibre"]):
                continue
            if any(ind in url_low for ind in INDICADORES_EXTRANJEROS):
                continue

            snippet = snippet_tag.get_text(strip=True) if snippet_tag else ""
            pm = re.search(r'\$\s*([\d\.,]{3,})', title + " " + snippet)
            if not pm:
                continue
            precio = limpiar_precio(re.sub(r'[^\d]', '', pm.group(1)))
            if not precio:
                continue

            domain_m = re.search(r'https?://(?:www\.)?([^/]+)', url_res)
            tienda = domain_m.group(1)[:40] if domain_m else "Web"

            resultados.append({
                "tienda": tienda,
                "nombre": limpiar_nombre(title)[:150],
                "precio_con_iva": precio,
                "url": url_res,
                "fuente": "duckduckgo",
                "pais": "CL",
            })
            if len(resultados) >= limite:
                break

        if resultados:
            cache_resultados[cache_key] = {"data": resultados, "timestamp": time.time()}
        print(f"  [DDG] {len(resultados)} resultados")
        return resultados
    except Exception as e:
        print(f"  [DDG] Error: {e}")
        return []


# ─── VTEX stores (Easy, Construmart, Imperial, Chilemat, Placacentro) ─────────

def buscar_vtex(store: dict, query: str, limite: int = 8):
    cache_key = get_cache_key(f"vtex_{store['nombre']}_{query}", limite)
    if cache_key in cache_resultados:
        return cache_resultados[cache_key]['data']
    try:
        r = requests.get(
            f"https://{store['dominio']}/api/catalog_system/pub/products/search",
            params={"ft": query, "_from": 0, "_to": limite - 1},
            headers={**HEADERS_BROWSER, "Accept": "application/json"},
            timeout=(4, 7)
        )
        if r.status_code != 200:
            return []
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
        print(f"  [{store['nombre']}] {len(resultados)} productos")
        return resultados
    except Exception as e:
        print(f"  [{store['nombre']}] Error: {e}")
        return []


# ─── Generador de queries ─────────────────────────────────────────────────────

def generar_queries(producto: str, categoria: str) -> list:
    queries = [producto]
    prod_norm = re.sub(r'(\d+)\s*"', r'\1 pulgadas', producto)
    prod_norm = re.sub(r'(\d+)\s*\'', r'\1 pies', prod_norm)
    if prod_norm != producto: queries.append(prod_norm)
    terminos_extra = {
        "madera":             ["madera Chile"],
        "metal_acero":        ["acero Chile"],
        "cemento_hormigon":   ["saco Chile"],
        "senaletica":         ["señalética Chile"],
        "pintura_recubrimiento": ["galón Chile"],
    }
    for termino in terminos_extra.get(categoria, []):
        queries.append(f"{producto} {termino}")
    return list(dict.fromkeys(queries))[:3]


# ─── BÚSQUEDA PRINCIPAL ───────────────────────────────────────────────────────

def realizar_busqueda(producto: str, limite: int = 15, conversion: str = "unidad"):
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

    # ── Query VTEX: solo palabras clave sin números puros ni stop words ────────
    PALABRAS_IGNORAR = {'con', 'para', 'por', 'los', 'las', 'del', 'una', 'uno',
                        'marca', 'similar', 'unidades', 'unidad', 'medidas', 'varias',
                        'resistente', 'acabado', 'interior', 'exterior', 'brillante'}
    palabras_clave = [
        w for w in producto.split()
        if not re.match(r'^[\d\.,xX×"\'\/\-]+$', w)
        and len(w) > 2
        and w.lower() not in PALABRAS_IGNORAR
    ]
    query_vtex = ' '.join(palabras_clave[:5])

    print(f"  📡 Google Shopping + DDG + VTEX × {len(VTEX_STORES)} tiendas (VTEX: '{query_vtex}')")

    # IMPORTANTE: NO usar "with" — espera todos los threads al salir aunque haya timeout
    ex = ThreadPoolExecutor(max_workers=10)
    try:
        futures = {
            ex.submit(buscar_google_shopping, producto, limite): "Google Shopping",
            ex.submit(buscar_duckduckgo, producto, 12): "DuckDuckGo",
        }
        for store in VTEX_STORES:
            futures[ex.submit(buscar_vtex, store, query_vtex, 8)] = store["nombre"]

        try:
            for future in as_completed(futures, timeout=18):
                nombre_f = futures[future]
                try:
                    nuevos = future.result()
                    agregar(nuevos)
                    print(f"  ✅ {nombre_f}: {len(nuevos)} | Total: {len(resultados)}")
                except Exception as e:
                    print(f"  ❌ {nombre_f}: {e}")
        except Exception:
            print(f"  ⚠️ Timeout 18s — continuando con {len(resultados)} resultados parciales")
    finally:
        try:
            ex.shutdown(wait=False, cancel_futures=True)
        except TypeError:
            ex.shutdown(wait=False)

    # ── Fase 2: variación de query VTEX si hay pocos resultados ──────────────
    if len(resultados) < 5:
        # Intentar query más corta (solo 3 palabras)
        query_corta = ' '.join(palabras_clave[:3])
        if query_corta and query_corta != query_vtex:
            print(f"  📡 Fase 2: VTEX query corta '{query_corta}'...")
            ex2 = ThreadPoolExecutor(max_workers=5)
            try:
                futures2 = {ex2.submit(buscar_vtex, store, query_corta, 6): store["nombre"]
                            for store in VTEX_STORES}
                try:
                    for future in as_completed(futures2, timeout=12):
                        try:
                            agregar(future.result())
                        except Exception:
                            pass
                except Exception:
                    pass
            finally:
                try:
                    ex2.shutdown(wait=False, cancel_futures=True)
                except TypeError:
                    ex2.shutdown(wait=False)

    if not resultados:
        return [], {}

    # ── Scoring y ranking ─────────────────────────────────────────────────────
    analisis_buscado = analizar_producto_buscado(producto)
    conv_lower = conversion.lower() if conversion else "unidad"
    for r in resultados:
        ar = analizar_resultado_encontrado(r, analisis_buscado)
        score = ar["score_python"]
        nombre_r = r.get("nombre", "").lower()
        if conv_lower not in ("unidad", "und", "un", ""):
            if detectar_unidad_resultado(nombre_r, conv_lower):
                score = min(100, score + 8)
        nivel, etiqueta = clasificar_concordancia(score)
        r.update({
            "score": score,
            "nivel_concordancia": nivel,
            "etiqueta_concordancia": etiqueta,
            "prioridad_tienda": prioridad_tienda(r.get("url", ""), r.get("tienda", "")),
            "categoria": categoria,
            "conversion": conv_lower,
            "precio_neto": round(r["precio_con_iva"] / IVA),
            "precio_formateado": f"${r['precio_con_iva']:,.0f}".replace(",", "."),
            "_analisis": ar,
        })

    resultados.sort(key=lambda x: (-x["score"], -x["prioridad_tienda"], x["precio_con_iva"]))
    filtrados = [r for r in resultados if r["score"] >= 10] or resultados
    return filtrados[:limite], analisis_buscado


# ─── ENDPOINT ─────────────────────────────────────────────────────────────────

UNIDADES_VALIDAS = {
    "kg":     ["kg", "kilo", "kilos", "kilogramo", "/kg", "por kg"],
    "m3":     ["m3", "m³", "metro cubico", "metro cúbico", "/m3", "por m3"],
    "m2":     ["m2", "m²", "metro cuadrado", "/m2"],
    "galon":  ["galón", "galon", "gal", "gl", "/gl", "1 gl", "1 galón"],
    "litro":  ["litro", "lt", "lts", "/lt", "1 lt", "1 litro"],
    "tira":   ["tira", "tira 6m", "/tira"],
    "caja":   ["caja", "por caja", "/caja"],
    "pack":   ["pack", "paquete", "por pack"],
    "tineta": ["tineta", "/tineta"],
    "metro":  ["metro", "mt", "/mt", "por metro"],
    "rollo":  ["rollo", "por rollo"],
    "unidad": [],
}


def detectar_unidad_resultado(nombre: str, conversion: str) -> bool:
    if not conversion or conversion.lower() in ("unidad", "und", "un", ""):
        return True
    nombre_lower = nombre.lower()
    conv_lower = conversion.lower()
    for key, indicadores in UNIDADES_VALIDAS.items():
        if conv_lower in (key, *indicadores):
            return any(ind in nombre_lower for ind in indicadores) if indicadores else True
    return True


@app.route("/python/busqueda-robusta", methods=["GET"])
def busqueda_robusta():
    producto = request.args.get("producto", "").strip()
    numero_item = request.args.get("numero", "")
    minimo_requerido = int(request.args.get("minimo", 15))
    force_refresh = request.args.get("force", "").lower() == "true"
    conversion = request.args.get("conversion", "unidad").strip().lower()

    print(f"\n{'='*60}\n🔍 [{numero_item}] {producto}\n{'='*60}")

    if not producto:
        return jsonify({"numero_item": numero_item, "producto": producto, "resultados": [],
                        "total_encontrados": 0, "suficientes": False, "deficit": minimo_requerido,
                        "categoria": "desconocida", "analisis_producto": {}})

    if force_refresh:
        for k in [k for k in cache_resultados if producto.lower() in k.lower()]:
            del cache_resultados[k]
        print(f"  🔄 Cache limpiado para: {producto}")

    resultados, analisis_buscado = realizar_busqueda(producto, minimo_requerido * 2, conversion=conversion)

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
            "conversion": r.get("conversion", "unidad"),
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
        "fuentes": ["Google Shopping (scraper)", "DuckDuckGo"] + [s["nombre"] for s in VTEX_STORES],
        "version": "6.0"
    })


@app.route("/python/diagnostico", methods=["GET"])
def diagnostico():
    resultado = {}

    # Test Google Shopping
    try:
        items = buscar_google_shopping("tornillo", 3)
        resultado["google_shopping"] = {
            "ok": len(items) > 0, "resultados": len(items),
            "muestra": items[0].get("nombre", "") if items else ""
        }
    except Exception as e:
        resultado["google_shopping"] = {"ok": False, "error": str(e)}

    # Test DuckDuckGo
    try:
        items = buscar_duckduckgo("tornillo", 3)
        resultado["duckduckgo"] = {
            "ok": len(items) > 0, "resultados": len(items),
            "muestra": items[0].get("nombre", "") if items else ""
        }
    except Exception as e:
        resultado["duckduckgo"] = {"ok": False, "error": str(e)}

    # Test VTEX Easy
    try:
        r = requests.get(
            "https://www.easy.cl/api/catalog_system/pub/products/search",
            params={"ft": "tornillo", "_from": 0, "_to": 2},
            headers={**HEADERS_BROWSER, "Accept": "application/json"}, timeout=6
        )
        items = r.json() if r.status_code == 200 else []
        resultado["vtex_easy"] = {
            "ok": len(items) > 0, "http": r.status_code, "resultados": len(items),
            "muestra": items[0].get("productName", "") if items else ""
        }
    except Exception as e:
        resultado["vtex_easy"] = {"ok": False, "error": str(e)}

    # Test VTEX Construmart
    try:
        r = requests.get(
            "https://www.construmart.cl/api/catalog_system/pub/products/search",
            params={"ft": "tornillo", "_from": 0, "_to": 2},
            headers={**HEADERS_BROWSER, "Accept": "application/json"}, timeout=6
        )
        items = r.json() if r.status_code == 200 else []
        resultado["vtex_construmart"] = {
            "ok": len(items) > 0, "http": r.status_code, "resultados": len(items)
        }
    except Exception as e:
        resultado["vtex_construmart"] = {"ok": False, "error": str(e)}

    alguna_ok = any(v.get("ok") for v in resultado.values())
    return jsonify({
        "estado_general": "operativo" if alguna_ok else "todas_las_fuentes_fallan",
        "fuentes": resultado,
        "server_ip": request.environ.get("HTTP_X_FORWARDED_FOR", request.remote_addr),
    })


@app.route("/python/cache/clear", methods=["POST"])
def clear_cache():
    cache_resultados.clear()
    return jsonify({"status": "ok", "mensaje": "Caché limpiado"})


@app.route("/python/exportar-costeo", methods=["POST"])
def exportar_costeo():
    if not OPENPYXL_DISPONIBLE:
        return jsonify({"error": "openpyxl no disponible en el servidor"}), 500
    if "archivo" not in request.files:
        return jsonify({"error": "No se envió el archivo Excel"}), 400

    archivo = request.files["archivo"]
    try:
        datos = json.loads(request.form.get("datos", "{}"))
    except Exception:
        return jsonify({"error": "Datos JSON inválidos"}), 400

    sheet_name = datos.get("sheet", "COSTEO")
    items_data = datos.get("items", [])
    if not items_data:
        return jsonify({"error": "No hay ítems con resultados"}), 400

    try:
        wb = openpyxl.load_workbook(io.BytesIO(archivo.read()))
    except Exception as e:
        return jsonify({"error": f"No se pudo abrir el Excel: {e}"}), 400

    if sheet_name not in wb.sheetnames:
        sheet_name = wb.sheetnames[0]
    ws = wb[sheet_name]

    header_row_idx = None
    col_item = col_valor_civa = col_link1 = None

    for row in ws.iter_rows(min_row=1, max_row=25):
        headers = {}
        for cell in row:
            h = str(cell.value or "").upper().strip()
            if h:
                headers[h] = cell.column
        if "ITEM" in headers:
            header_row_idx = row[0].row
            col_item = headers.get("ITEM")
            for h, c in headers.items():
                if "VALOR" in h and "IVA" in h:
                    col_valor_civa = c
                    break
            for h, c in sorted(headers.items(), key=lambda x: x[1]):
                if h.startswith("LINK"):
                    col_link1 = c
                    break
            break

    if not header_row_idx or not col_item:
        return jsonify({"error": "No se encontró columna ITEM en la pestaña seleccionada"}), 400
    if not col_valor_civa:
        return jsonify({"error": "No se encontró columna VALOR C/IVA"}), 400

    max_col = ws.max_column
    col_tienda_extra = max_col + 1
    col_match_extra = max_col + 2
    ws.cell(row=header_row_idx, column=col_tienda_extra).value = "TIENDA COTIZADA"
    ws.cell(row=header_row_idx, column=col_match_extra).value = "% COINCIDENCIA"

    precios = {str(i["numero"]): i for i in items_data}
    filled = 0

    for row in ws.iter_rows(min_row=header_row_idx + 1):
        cell_item = row[col_item - 1]
        if cell_item.value is None:
            continue
        item_str = str(cell_item.value).strip()
        if not item_str.isdigit():
            continue
        dato = precios.get(item_str)
        if not dato or not dato.get("precio"):
            continue

        r_num = cell_item.row
        ws.cell(row=r_num, column=col_valor_civa).value = dato["precio"]
        if col_link1 and dato.get("link"):
            ws.cell(row=r_num, column=col_link1).value = dato["link"]
        ws.cell(row=r_num, column=col_tienda_extra).value = dato.get("tienda", "")
        ws.cell(row=r_num, column=col_match_extra).value = f"{dato.get('match', 0)}%"
        filled += 1

    if filled == 0:
        return jsonify({"error": "No se encontraron ítems con resultados para exportar"}), 400

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    fecha = datetime.now().strftime("%Y-%m-%d")
    print(f"  📊 Export COSTEO: {filled} ítems rellenados en '{sheet_name}'")
    return send_file(
        output,
        as_attachment=True,
        download_name=f"COSTEO_cotizado_{fecha}.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    print("=" * 60)
    print("🚀 BUSCADOR CHILE — GRUPO ICA v6.0")
    print("   FUENTES PRIMARIAS:")
    print("   • Google Shopping Chile (scraper tbm=shop — IP real)")
    print("   • DuckDuckGo Chile (scraper HTML — cualquier IP)")
    print("   FUENTES DIRECTAS (precios exactos):")
    for s in VTEX_STORES:
        print(f"   • {s['nombre']} (VTEX directo)")
    print("   ARQUITECTURA: ThreadPoolExecutor — shutdown(wait=False)")
    print("=" * 60)
    try:
        from waitress import serve
        print("✅ Waitress activo en http://0.0.0.0:5000")
        serve(app, host="0.0.0.0", port=5000, threads=16)
    except ImportError:
        print("⚠️  Waitress no instalado, usando Flask dev server")
        app.run(host="0.0.0.0", port=5000, debug=True)
