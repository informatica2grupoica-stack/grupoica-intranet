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
# Serper solo como fallback de último recurso
SERPER_API_KEY = "2a1e02a687f2b1e29d461b6d8acce180b707942e"

cache_resultados = {}
CACHE_TTL = 300

HEADERS_BROWSER = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

# ─── Tiendas VTEX Chile ──────────────────────────────────────────────────────
VTEX_STORES = [
    {"dominio": "www.easy.cl",       "nombre": "Easy",       "prioridad": 10},
    {"dominio": "www.construmart.cl", "nombre": "Construmart","prioridad": 10},
    {"dominio": "www.imperial.cl",   "nombre": "Imperial",   "prioridad": 9},
    {"dominio": "www.chilemat.cl",   "nombre": "Chilemat",   "prioridad": 9},
    {"dominio": "www.placacentro.cl","nombre": "Placacentro","prioridad": 8},
]

DOMINIOS_CHILE = {
    "sodimac": {"dominio": "sodimac.com", "tipo": "ferretería_grande", "prioridad": 10},
    "easy": {"dominio": "easy.cl", "tipo": "ferretería_grande", "prioridad": 10},
    "construmart": {"dominio": "construmart.cl", "tipo": "materiales_construccion", "prioridad": 10},
    "imperial": {"dominio": "imperial.cl", "tipo": "ferretería_grande", "prioridad": 9},
    "chilemat": {"dominio": "chilemat.cl", "tipo": "materiales_construccion", "prioridad": 9},
    "cic": {"dominio": "cic.cl", "tipo": "materiales_construccion", "prioridad": 9},
    "aceroscmpc": {"dominio": "aceroscmpc.cl", "tipo": "aceros", "prioridad": 9},
    "mvm": {"dominio": "mvm.cl", "tipo": "aceros", "prioridad": 8},
    "cintac": {"dominio": "cintac.cl", "tipo": "aceros", "prioridad": 8},
    "sherwin": {"dominio": "sherwin-williams.cl", "tipo": "pinturas", "prioridad": 8},
    "sipa": {"dominio": "sipa.cl", "tipo": "pinturas", "prioridad": 8},
    "seton": {"dominio": "seton.cl", "tipo": "señalética", "prioridad": 8},
    "prevenco": {"dominio": "prevenco.cl", "tipo": "señalética", "prioridad": 8},
    "mercadolibre": {"dominio": "mercadolibre.cl", "tipo": "marketplace", "prioridad": 6},
}

INDICADORES_EXTRANJEROS = [
    "amazon.com", "ebay.com", "aliexpress", "wish.com",
    "walmart.com", "homedepot.com", "lowes.com",
    ".com.ar", ".com.mx", ".com.pe", ".com.co",
]

MONEDAS_EXTRANJERAS = re.compile(r'\b(USD|EUR|ARS|PEN|COP|MXN)\b', re.IGNORECASE)

CATEGORIAS_PRODUCTOS = {
    "madera": {
        "palabras_clave": ["madera", "pino", "mdf", "osb", "terciado", "plywood", "listón", "tablón", "tabla", "eucalipto"],
        "queries_extra": ["{producto} madera Chile precio", "{producto} maderera Chile"],
        "unidades_relevantes": ["metro", "mt", "m2", "tabla", "unidad"],
    },
    "metal_acero": {
        "palabras_clave": ["fierro", "acero", "tubo", "tubular", "barra", "pletina", "pilar", "viga", "placa acero", "ángulo", "canal", "perfil"],
        "queries_extra": ["{producto} acero Chile precio", "{producto} metalúrgica Chile"],
        "unidades_relevantes": ["kg", "metro", "barra", "mt"],
    },
    "cemento_hormigon": {
        "palabras_clave": ["cemento", "cal", "arena", "grava", "estabilizado", "hormigón", "concreto", "mortero"],
        "queries_extra": ["{producto} precio Chile kg", "{producto} saco Chile ferretería"],
        "unidades_relevantes": ["saco", "kg", "m3", "bolsa"],
    },
    "ferreteria_general": {
        "palabras_clave": ["clavo", "tornillo", "perno", "malla", "soldadura", "alambre", "desmoldante", "tuerca", "remache"],
        "queries_extra": ["{producto} ferretería Chile precio"],
        "unidades_relevantes": ["caja", "kg", "unidad", "paquete"],
    },
    "pintura_recubrimiento": {
        "palabras_clave": ["pintura", "anticorrosivo", "esmalte", "látex", "barniz", "semibrillo", "microesferas", "imprimante", "sellador"],
        "queries_extra": ["{producto} pintura Chile litro precio"],
        "unidades_relevantes": ["litro", "galón", "lt", "gl", "cuñete"],
    },
    "senaletica": {
        "palabras_clave": ["letrero", "señal", "tránsito", "paso cebra", "señalética", "delineador", "tachas"],
        "queries_extra": ["{producto} señalética Chile precio"],
        "unidades_relevantes": ["unidad", "metro", "m2", "kit"],
    },
    "herramienta_medicion": {
        "palabras_clave": ["lienza", "rollo", "plomada", "nivel", "metro", "cinta"],
        "queries_extra": ["{producto} Chile precio ferretería"],
        "unidades_relevantes": ["unidad", "metro"],
    },
}


def get_cache_key(producto, limite):
    return f"{producto}_{limite}"


def limpiar_cache_expirado():
    ahora = time.time()
    expirados = [k for k, v in cache_resultados.items() if ahora - v['timestamp'] > CACHE_TTL]
    for k in expirados:
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
    reemplazos = {'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n'}
    for orig, rep in reemplazos.items():
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
    texto = re.sub(r'\s+', ' ', texto).strip()
    return texto


def extraer_medidas(texto: str) -> dict:
    medidas = {}
    texto_lower = texto.lower()
    dim3 = re.findall(r'(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)', texto_lower)
    if dim3:
        medidas['dim3'] = [float(d) for d in dim3[0]]
    dim2 = re.findall(r'(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)', texto_lower)
    if dim2:
        medidas['dim2'] = [float(d) for d in dim2[0]]
    frac = re.findall(r'(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)', texto_lower)
    for f in frac:
        if f[0]:
            medidas['fraccion'] = float(f[0]) + float(f[1]) / float(f[2])
        else:
            medidas['fraccion'] = float(f[3]) / float(f[4])
    pulg = re.findall(r'(\d+(?:\.\d+)?)\s*(?:"|pulgadas?|pulg\b|inch)', texto_lower)
    if pulg:
        medidas['pulgadas'] = float(pulg[0])
    mm = re.findall(r'(\d+(?:\.\d+)?)\s*mm', texto_lower)
    if mm:
        medidas['mm'] = [float(m) for m in mm]
    kg = re.findall(r'(\d+(?:\.\d+)?)\s*kg', texto_lower)
    if kg:
        medidas['kg'] = float(kg[0])
    lts = re.findall(r'(\d+(?:\.\d+)?)\s*(?:lt|lts|litros?|l\b)', texto_lower)
    if lts:
        medidas['litros'] = float(lts[0])
    mts = re.findall(r'(\d+(?:\.\d+)?)\s*(?:mt|mts|metros?|m\b)', texto_lower)
    if mts:
        medidas['metros'] = float(mts[0])
    return medidas


def medidas_a_texto(medidas: dict) -> str:
    partes = []
    if 'dim3' in medidas:
        v = medidas['dim3']
        partes.append(f"{v[0]}x{v[1]}x{v[2]}")
    if 'dim2' in medidas:
        v = medidas['dim2']
        partes.append(f"{v[0]}x{v[1]}")
    if 'fraccion' in medidas:
        partes.append(f"{medidas['fraccion']:.2f}\"")
    if 'pulgadas' in medidas:
        partes.append(f"{medidas['pulgadas']}\"")
    if 'mm' in medidas:
        mm = medidas['mm']
        partes.append(f"{mm[0] if isinstance(mm, list) else mm}mm")
    if 'kg' in medidas:
        partes.append(f"{medidas['kg']}kg")
    if 'litros' in medidas:
        partes.append(f"{medidas['litros']}lt")
    if 'metros' in medidas:
        partes.append(f"{medidas['metros']}m")
    return ", ".join(partes) if partes else "sin medidas"


def comparar_medidas(medidas_b: dict, medidas_e: dict) -> float:
    if not medidas_b:
        return 0.5
    if not medidas_e:
        return 0.0
    coincidencias = 0
    total = 0
    for key, val_b in medidas_b.items():
        total += 1
        val_e = medidas_e.get(key)
        if val_e is None:
            continue
        if isinstance(val_b, list) and isinstance(val_e, list):
            if len(val_b) == len(val_e) and all(abs(a - b) < 0.5 for a, b in zip(sorted(val_b), sorted(val_e))):
                coincidencias += 1
        elif isinstance(val_b, (int, float)) and isinstance(val_e, (int, float)):
            if abs(val_b - val_e) <= max(0.1, val_b * 0.1):
                coincidencias += 1
        elif isinstance(val_b, list) and isinstance(val_e, (int, float)):
            if len(val_b) == 1 and abs(val_b[0] - val_e) < 0.5:
                coincidencias += 1
        elif isinstance(val_e, list) and isinstance(val_b, (int, float)):
            if len(val_e) == 1 and abs(val_b - val_e[0]) < 0.5:
                coincidencias += 1
    return coincidencias / total if total > 0 else 0.5


def extraer_especificaciones(texto: str) -> set:
    specs = set()
    texto_norm = normalizar(texto)
    materiales = ['acero', 'hierro', 'fierro', 'pino', 'madera', 'cemento', 'cal', 'arena']
    tipos = ['estriado', 'liso', 'bruto', 'estructural', 'tubular', 'cuadrado', 'rectangular',
             'redondo', 'galvanizado', 'cepillado', 'anticorrosivo', 'semibrillo']
    for m in materiales + tipos:
        if m in texto_norm:
            specs.add(m)
    if 'bruto' in texto_norm or 'sin cepillar' in texto_norm:
        specs.add('bruto')
    normas = re.findall(r'\b[a-z]+\d+\b', texto_norm)
    specs.update(normas)
    return specs


def calcular_concordancia(buscado: str, encontrado: str) -> int:
    b_norm = normalizar(buscado)
    e_norm = normalizar(encontrado)
    if not b_norm or not e_norm:
        return 0
    seq_ratio = SequenceMatcher(None, b_norm, e_norm).ratio()
    palabras_b = set(b_norm.split())
    palabras_e = set(e_norm.split())
    palabras_b_filtradas = {p for p in palabras_b if len(p) > 2}
    jaccard = len(palabras_b_filtradas & palabras_e) / len(palabras_b_filtradas) if palabras_b_filtradas else 0.5
    equivalencias = {
        'bruto': 'sin cepillar', 'sin cepillar': 'bruto',
        'fierro': 'acero', 'acero': 'fierro',
        'anticorrosivo': 'antioxidante', 'antioxidante': 'anticorrosivo',
        'pino': 'pino radiata', 'pino radiata': 'pino',
    }
    b_eq = b_norm
    e_eq = e_norm
    for orig, rep in equivalencias.items():
        b_eq = b_eq.replace(orig, rep)
        e_eq = e_eq.replace(orig, rep)
    seq_eq = SequenceMatcher(None, b_eq, e_eq).ratio()
    medidas_b = extraer_medidas(buscado)
    medidas_e = extraer_medidas(encontrado)
    medida_score = comparar_medidas(medidas_b, medidas_e)
    bono_medidas = 0
    if medidas_b and medidas_e:
        if medida_score >= 0.95:
            bono_medidas = 15
        elif medida_score >= 0.7:
            bono_medidas = 8
    specs_b = extraer_especificaciones(buscado)
    specs_e = extraer_especificaciones(encontrado)
    spec_match = len(specs_b & specs_e) / len(specs_b) if specs_b else 0.5
    score_base = (seq_ratio * 0.15 + jaccard * 0.30 + seq_eq * 0.15 + medida_score * 0.25 + spec_match * 0.15) * 100
    score_final = score_base + bono_medidas
    palabras_importantes = {p for p in palabras_b if p in ['pino', 'madera', 'acero', 'fierro', 'cemento', 'pintura']}
    if palabras_importantes:
        score_final -= len(palabras_importantes - palabras_e) * 8
    if medidas_b and not medidas_e:
        score_final -= 15
    if len(palabras_b_filtradas - palabras_e) > 3:
        score_final -= 10
    return round(min(100, max(0, score_final)))


def clasificar_concordancia(score: int):
    if score >= 90:
        return "exacta", "✅ Coincidencia exacta"
    elif score >= 75:
        return "alta", "🟢 Alta coincidencia"
    elif score >= 60:
        return "parcial", "🟡 Coincidencia parcial"
    elif score >= 40:
        return "baja", "🟠 Baja coincidencia"
    else:
        return "nula", "🔴 Sin coincidencia"


def inferir_tipo_producto(nombre: str) -> dict:
    nombre_lower = nombre.lower()
    return {
        "maquinaria_pesada": any(p in nombre_lower for p in ["retroexcavadora", "minicargador", "grúa", "compactador"]),
        "herramienta_electrica": any(p in nombre_lower for p in ["taladro", "amoladora", "sierra", "esmeril", "compresor"]),
        "material_construccion": any(p in nombre_lower for p in ["cemento", "hormigón", "arena", "madera", "fierro", "acero", "tubo", "tabla"]),
        "articulo_pequeno": any(p in nombre_lower for p in ["clavo", "tornillo", "perno", "tuerca", "remache"]),
        "pintura_quimico": any(p in nombre_lower for p in ["pintura", "anticorrosivo", "barniz", "esmalte", "sellador"]),
        "senaletica_vial": any(p in nombre_lower for p in ["letrero", "señal", "tránsito", "paso cebra", "tachas"]),
    }


def analizar_producto_buscado(nombre: str) -> dict:
    categoria = clasificar_producto(nombre)
    medidas = extraer_medidas(nombre)
    specs = list(extraer_especificaciones(nombre))
    nombre_norm = normalizar(nombre)
    palabras = [p for p in nombre_norm.split() if len(p) > 2]
    return {
        "nombre_original": nombre,
        "nombre_normalizado": nombre_norm,
        "categoria": categoria,
        "palabras_clave": palabras,
        "medidas": {"tiene_medidas": bool(medidas), "detalle": medidas, "texto_legible": medidas_a_texto(medidas)},
        "especificaciones_tecnicas": specs,
        "unidades_relevantes": CATEGORIAS_PRODUCTOS.get(categoria, {}).get("unidades_relevantes", []),
        "es_accesorio": any(p in nombre.lower() for p in ["repuesto", "accesorio", "disco", "carbón", "funda"]),
        "marca_detectada": next((m for m in ["sherwin", "sipa", "gerdau", "cintac", "stanley", "bosch", "dewalt", "makita", "sika"] if m in nombre.lower()), None),
        "tipo_producto": inferir_tipo_producto(nombre),
    }


def analizar_resultado_encontrado(resultado: dict, analisis_buscado: dict) -> dict:
    nombre = resultado.get("nombre", "")
    medidas_encontradas = extraer_medidas(nombre)
    specs_encontradas = list(extraer_especificaciones(nombre))
    score = calcular_concordancia(analisis_buscado["nombre_original"], nombre)
    nivel, etiqueta = clasificar_concordancia(score)
    medidas_buscado = analisis_buscado["medidas"]["detalle"]
    conflicto_medidas = False
    if medidas_buscado and medidas_encontradas:
        conflicto_medidas = comparar_medidas(medidas_buscado, medidas_encontradas) < 0.5
    palabras_b = set(analisis_buscado["palabras_clave"])
    palabras_e = set(normalizar(nombre).split())
    return {
        "medidas_encontradas": medidas_a_texto(medidas_encontradas),
        "specs_encontradas": specs_encontradas,
        "score_python": score,
        "nivel_python": nivel,
        "palabras_comunes": list(palabras_b & palabras_e),
        "palabras_faltantes": list(palabras_b - palabras_e),
        "conflicto_medidas": conflicto_medidas,
    }


def limpiar_nombre(nombre: str) -> str:
    nombre = re.sub(r'\s*[\|–—]\s*.*$', '', nombre)
    nombre = re.sub(r'\s*MercadoLibre.*$', '', nombre, flags=re.IGNORECASE)
    nombre = re.sub(r'\s*Envío\s*(gratis|internacional|express).*$', '', nombre, flags=re.IGNORECASE)
    nombre = re.sub(r'\s*✓.*$', '', nombre)
    nombre = re.sub(r'\s+', ' ', nombre).strip()
    return nombre


def limpiar_precio(raw_price) -> int | None:
    precio_str = re.sub(r'[^\d]', '', str(raw_price))
    if not precio_str:
        return None
    precio = int(precio_str)
    if precio < 500 or precio > 500_000_000:
        return None
    return precio


def prioridad_tienda(url: str, tienda: str) -> int:
    url_lower = url.lower()
    tienda_lower = tienda.lower()
    for nombre, datos in DOMINIOS_CHILE.items():
        if datos['dominio'] in url_lower or nombre in tienda_lower:
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
            timeout=10
        )
        if r.status_code != 200:
            return []
        resultados = []
        for item in r.json().get("results", []):
            precio = item.get("price", 0)
            if precio <= 0:
                continue
            nombre = limpiar_nombre(item.get("title", ""))
            if len(nombre) < 4:
                continue
            permalink = item.get("permalink", "")
            if "mercadolibre.cl" not in permalink and "/MLC" not in permalink:
                continue
            resultados.append({
                "tienda": "MercadoLibre Chile",
                "nombre": nombre[:150],
                "precio_con_iva": round(precio),
                "url": permalink,
                "fuente": "mercadolibre_cl",
                "pais": "CL",
            })
        cache_resultados[cache_key] = {'data': resultados, 'timestamp': time.time()}
        return resultados
    except Exception as e:
        print(f"  [ML] Error: {e}")
        return []


# ─── Scrapers VTEX (Easy, Construmart, Imperial, Chilemat) ───────────────────

def buscar_vtex(store: dict, query: str, limite: int = 10):
    cache_key = get_cache_key(f"vtex_{store['nombre']}_{query}", limite)
    if cache_key in cache_resultados:
        return cache_resultados[cache_key]['data']
    try:
        url = f"https://{store['dominio']}/api/catalog_system/pub/products/search"
        r = requests.get(
            url,
            params={"ft": query, "_from": 0, "_to": limite - 1},
            headers=HEADERS_BROWSER,
            timeout=10
        )
        if r.status_code != 200:
            print(f"  [{store['nombre']}] HTTP {r.status_code}")
            return []

        products = r.json()
        resultados = []

        for prod in products:
            nombre = limpiar_nombre(prod.get("productName", ""))
            if len(nombre) < 4:
                continue
            precio = None
            link = prod.get("link", "")

            for item in prod.get("items", []):
                for seller in item.get("sellers", []):
                    offer = seller.get("commertialOffer", {})
                    if offer.get("AvailableQuantity", 0) > 0:
                        precio = offer.get("Price", 0)
                        break
                if precio:
                    break

            if not precio or precio < 500:
                continue

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


# ─── Sodimac Chile (OCC / Oracle Commerce Cloud) ─────────────────────────────

def buscar_sodimac(query: str, limite: int = 12):
    cache_key = get_cache_key(f"sodimac_{query}", limite)
    if cache_key in cache_resultados:
        return cache_resultados[cache_key]['data']
    try:
        # Sodimac usa Oracle Commerce Cloud - endpoint público de búsqueda
        r = requests.get(
            "https://www.sodimac.cl/s/search/resources/v2/summary",
            params={
                "Ntt": query,
                "Nrpp": limite,
                "No": 0,
                "lang": "es-cl",
                "Ns": "product.sortPrice|0",
                "country": "CL",
            },
            headers=HEADERS_BROWSER,
            timeout=12
        )
        if r.status_code != 200:
            print(f"  [Sodimac] HTTP {r.status_code}")
            return []

        data = r.json()
        # OCC puede devolver en distintas estructuras según versión
        records = (
            data.get("resultList", {}).get("Record", [])
            or data.get("mainContent", [{}])[0].get("contents", [{}])[0].get("records", [])
            or []
        )

        resultados = []
        for rec in records[:limite]:
            attrs = rec.get("attributes", {})
            nombre_raw = (
                attrs.get("product.displayName", [""])[0]
                if isinstance(attrs.get("product.displayName"), list)
                else attrs.get("product.displayName", "")
            )
            nombre = limpiar_nombre(str(nombre_raw))
            if len(nombre) < 4:
                continue

            precio_raw = attrs.get("product.salePrice", attrs.get("product.listPrice", ["0"]))
            if isinstance(precio_raw, list):
                precio_raw = precio_raw[0]
            precio = limpiar_precio(str(precio_raw).replace(".", "").replace(",", ""))
            if not precio:
                continue

            url_raw = attrs.get("product.productUrl", [""])[0] if isinstance(attrs.get("product.productUrl"), list) else attrs.get("product.productUrl", "")
            url_prod = f"https://www.sodimac.cl{url_raw}" if url_raw and not url_raw.startswith("http") else url_raw

            resultados.append({
                "tienda": "Sodimac",
                "nombre": nombre[:150],
                "precio_con_iva": precio,
                "url": url_prod,
                "fuente": "sodimac_direct",
                "pais": "CL",
            })

        cache_resultados[cache_key] = {'data': resultados, 'timestamp': time.time()}
        print(f"  [Sodimac] {len(resultados)} productos")
        return resultados
    except Exception as e:
        print(f"  [Sodimac] Error: {e}")
        return []


# ─── Fallback Google Serper (solo si scrapers dan < 5 resultados) ─────────────

def fetch_serper(query: str, search_type: str = "shopping") -> dict:
    try:
        r = requests.post(
            f"https://google.serper.dev/{search_type}",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": query, "gl": "cl", "hl": "es", "num": 20, "location": "Chile"},
            timeout=12
        )
        return r.json() if r.status_code == 200 else {}
    except Exception as e:
        print(f"  [Serper] Error: {e}")
        return {}


def buscar_serper_fallback(producto: str, limite: int = 10):
    print(f"  ⚠️ Activando Serper fallback para: {producto[:40]}")
    data = fetch_serper(f"{producto} precio Chile", "shopping")
    items = data.get("shopping", [])
    resultados = []
    for item in items[:limite * 2]:
        precio = limpiar_precio(item.get("price", ""))
        if not precio:
            continue
        nombre = limpiar_nombre(item.get("title", ""))
        if len(nombre) < 4:
            continue
        url_item = item.get("link", "")
        tienda = item.get("source", "Tienda Chile")
        r = {"tienda": tienda[:40], "nombre": nombre[:150], "precio_con_iva": precio,
             "url": url_item, "fuente": "serper_fallback", "pais": "CL"}
        # Solo incluir resultados chilenos
        if ".cl" in url_item.lower() or any(d["dominio"] in url_item.lower() for d in DOMINIOS_CHILE.values()):
            resultados.append(r)
    return resultados


# ─── es_resultado_chileno ────────────────────────────────────────────────────

def es_resultado_chileno(item: dict) -> bool:
    url = item.get('url', item.get('link', '')).lower()
    for ind in INDICADORES_EXTRANJEROS:
        if ind in url:
            return False
    if MONEDAS_EXTRANJERAS.search(str(item.get('price', ''))):
        return False
    if '.cl' in url:
        return True
    if any(d["dominio"] in url for d in DOMINIOS_CHILE.values()):
        return True
    return item.get("fuente", "") in ("mercadolibre_cl", "vtex_direct", "sodimac_direct")


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
            url = r.get("url", "")
            clave = url or normalizar(r.get("nombre", ""))
            if clave and clave not in urls_vistas:
                urls_vistas.add(clave)
                resultados.append(r)

    # ── Consultas paralelas a todas las tiendas ──────────────────────────────
    with ThreadPoolExecutor(max_workers=7) as executor:
        futures = {
            executor.submit(buscar_mercadolibre, producto, limite): "ML",
            executor.submit(buscar_sodimac, producto, 12): "Sodimac",
        }
        for store in VTEX_STORES:
            futures[executor.submit(buscar_vtex, store, producto, 8)] = store["nombre"]

        for future in as_completed(futures, timeout=18):
            nombre_fuente = futures[future]
            try:
                nuevos = future.result()
                agregar(nuevos)
                print(f"  ✅ {nombre_fuente}: {len(nuevos)} | Total: {len(resultados)}")
            except Exception as e:
                print(f"  ❌ {nombre_fuente}: {e}")

    # ── Fallback Serper si hay muy pocos resultados ──────────────────────────
    if len(resultados) < 5:
        agregar(buscar_serper_fallback(producto, 10))

    if not resultados:
        return [], {}

    # ── Análisis + scoring ───────────────────────────────────────────────────
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


# ─── ENDPOINTS ───────────────────────────────────────────────────────────────

@app.route("/python/busqueda-robusta", methods=["GET"])
def busqueda_robusta():
    producto = request.args.get("producto", "").strip()
    numero_item = request.args.get("numero", "")
    minimo_requerido = int(request.args.get("minimo", 15))
    force_refresh = request.args.get("force", "").lower() == "true"

    print(f"\n{'='*60}\n🔍 [{numero_item}] {producto}\n{'='*60}")

    if not producto:
        return jsonify({"numero_item": numero_item, "producto": producto, "resultados": [],
                        "total_encontrados": 0, "suficientes": False, "deficit": minimo_requerido})

    if force_refresh:
        for k in [k for k in cache_resultados if producto.lower() in k.lower()]:
            del cache_resultados[k]

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

    print(f"\n📊 TOTAL: {len(resultados_formateados)} resultados")
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
        "tiendas_directas": ["MercadoLibre", "Sodimac"] + [s["nombre"] for s in VTEX_STORES],
        "serper_fallback": "activo",
    })


@app.route("/python/cache/clear", methods=["POST"])
def clear_cache():
    cache_resultados.clear()
    return jsonify({"status": "ok", "mensaje": "Caché limpiado"})


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 BUSCADOR CHILE — GRUPO ICA v4.0")
    print("   • Sodimac (OCC directo)")
    print("   • Easy, Construmart, Imperial, Chilemat (VTEX directo)")
    print("   • MercadoLibre Chile (API oficial)")
    print("   • Serper como fallback de último recurso")
    print("   • Búsquedas paralelas con ThreadPoolExecutor")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)
