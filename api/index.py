import re
import time
import random
import requests
import json
from difflib import SequenceMatcher
from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import lru_cache

app = Flask(__name__)
CORS(app)

IVA = 1.19
SERPER_API_KEY = "2a1e02a687f2b1e29d461b6d8acce180b707942e"

# ==========================================
# CACHÉ EN MEMORIA
# ==========================================
cache_resultados = {}
CACHE_TTL = 300  # 5 minutos

def get_cache_key(producto, limite):
    return f"{producto}_{limite}"

def limpiar_cache_expirado():
    ahora = time.time()
    expirados = [k for k, v in cache_resultados.items() if ahora - v['timestamp'] > CACHE_TTL]
    for k in expirados:
        del cache_resultados[k]

# ==========================================
# DOMINIOS CHILENOS DE CONFIANZA
# ==========================================

DOMINIOS_CHILE = {
    "sodimac": {"dominio": "sodimac.com", "tipo": "ferretería_grande", "prioridad": 10},
    "easy": {"dominio": "easy.cl", "tipo": "ferretería_grande", "prioridad": 10},
    "construmart": {"dominio": "construmart.cl", "tipo": "materiales_construccion", "prioridad": 10},
    "imperial": {"dominio": "imperial.cl", "tipo": "ferretería_grande", "prioridad": 9},
    "chilemat": {"dominio": "chilemat.cl", "tipo": "materiales_construccion", "prioridad": 9},
    "cic": {"dominio": "cic.cl", "tipo": "materiales_construccion", "prioridad": 9},
    "aceroscmpc": {"dominio": "aceroscmpc.cl", "tipo": "aceros", "prioridad": 9},
    "mvm": {"dominio": "mvm.cl", "tipo": "aceros", "prioridad": 8},
    "aceroexpress": {"dominio": "aceroexpress.cl", "tipo": "aceros", "prioridad": 8},
    "cintac": {"dominio": "cintac.cl", "tipo": "aceros", "prioridad": 8},
    "gerdau": {"dominio": "gerdau.com/cl", "tipo": "aceros", "prioridad": 8},
    "sherwin": {"dominio": "sherwin-williams.cl", "tipo": "pinturas", "prioridad": 8},
    "sipa": {"dominio": "sipa.cl", "tipo": "pinturas", "prioridad": 8},
    "volcan": {"dominio": "volcan.cl", "tipo": "materiales", "prioridad": 7},
    "seton": {"dominio": "seton.cl", "tipo": "señalética", "prioridad": 8},
    "prevenco": {"dominio": "prevenco.cl", "tipo": "señalética", "prioridad": 8},
    "seguridad_total": {"dominio": "seguridadtotal.cl", "tipo": "señalética", "prioridad": 7},
    "mercadolibre": {"dominio": "mercadolibre.cl", "tipo": "marketplace", "prioridad": 6},
    "paris": {"dominio": "paris.cl", "tipo": "retail", "prioridad": 5},
    "falabella": {"dominio": "falabella.com/cl", "tipo": "retail", "prioridad": 5},
    "maderas_arauco": {"dominio": "arauco.cl", "tipo": "maderas", "prioridad": 9},
    "masisa": {"dominio": "masisa.com", "tipo": "maderas", "prioridad": 8},
    "placacentro": {"dominio": "placacentro.cl", "tipo": "maderas", "prioridad": 8},
    "cemento_bio_bio": {"dominio": "cbb.cl", "tipo": "cemento", "prioridad": 9},
    "melon": {"dominio": "melon.cl", "tipo": "cemento", "prioridad": 9},
    "fv": {"dominio": "fv.cl", "tipo": "ferretería", "prioridad": 7},
}

INDICADORES_EXTRANJEROS = [
    "amazon.com", "ebay.com", "aliexpress", "wish.com",
    "walmart.com", "homedepot.com", "lowes.com",
    "mercadolibre.com.ar", "mercadolibre.com.mx",
    "mercadolibre.com.pe", "mercadolibre.com.co",
    "precio en $", "usd", "u$s", "us$", "dólar americano",
    ".com.ar", ".com.mx", ".com.pe", ".com.co",
    "argentina", "méxico", "perú", "colombia",
    "envío desde usa", "ships from usa",
]

MONEDAS_EXTRANJERAS = re.compile(r'\b(USD|EUR|ARS|PEN|COP|MXN)\b', re.IGNORECASE)

# ==========================================
# CLASIFICACIÓN DE PRODUCTOS
# ==========================================

CATEGORIAS_PRODUCTOS = {
    "madera": {
        "palabras_clave": ["madera", "pino", "mdf", "osb", "terciado", "plywood", "listón", "tablón", "tabla", "eucalipto"],
        "tiendas_prioritarias": ["construmart", "sodimac", "easy", "placacentro", "maderas_arauco"],
        "queries_extra": ["madera {producto} Chile precio", "{producto} maderas precio CLP"],
        "unidades_relevantes": ["metro", "mt", "m2", "tabla", "unidad"],
    },
    "metal_acero": {
        "palabras_clave": ["fierro", "acero", "tubo", "tubular", "barra", "pletina", "pilar", "viga", "placa acero", "ángulo", "canal", "perfil"],
        "tiendas_prioritarias": ["aceroscmpc", "mvm", "aceroexpress", "cintac", "gerdau"],
        "queries_extra": ["{producto} acero Chile precio", "{producto} metalúrgica Chile"],
        "unidades_relevantes": ["kg", "metro", "barra", "mt"],
    },
    "cemento_hormigon": {
        "palabras_clave": ["cemento", "cal", "arena", "grava", "estabilizado", "hormigón", "concreto", "mortero"],
        "tiendas_prioritarias": ["chilemat", "construmart", "cic", "cemento_bio_bio", "melon"],
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
        "queries_extra": ["{producto} pintura Chile precio litro", "{producto} Chile galón precio"],
        "unidades_relevantes": ["litro", "galón", "lt", "gl", "cuñete"],
    },
    "senaletica": {
        "palabras_clave": ["letrero", "señal", "tránsito", "paso cebra", "señalética", "tineta", "fastrack", "delineador", "tachas"],
        "tiendas_prioritarias": ["seton", "prevenco", "seguridad_total"],
        "queries_extra": ["{producto} señalética Chile precio", "{producto} tránsito Chile comprar"],
        "unidades_relevantes": ["unidad", "metro", "m2", "kit"],
    },
    "herramienta_medicion": {
        "palabras_clave": ["lienza", "rollo", "plomada", "nivel", "metro", "cinta"],
        "tiendas_prioritarias": ["sodimac", "easy", "imperial"],
        "queries_extra": ["{producto} Chile precio", "{producto} ferretería Chile"],
        "unidades_relevantes": ["unidad", "metro"],
    },
}

def clasificar_producto(nombre: str) -> str:
    nombre_lower = nombre.lower()
    for categoria, datos in CATEGORIAS_PRODUCTOS.items():
        for palabra in datos["palabras_clave"]:
            if palabra in nombre_lower:
                return categoria
    return "ferreteria_general"

# ==========================================
# NORMALIZACIÓN Y ANÁLISIS SEMÁNTICO (MEJORADO)
# ==========================================

@lru_cache(maxsize=2000)
def normalizar(texto):
    """Normaliza texto: minúsculas, sin acentos, normaliza medidas."""
    if not texto:
        return ""
    texto = texto.lower()
    
    # Acentos
    reemplazos = {'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n'}
    for orig, rep in reemplazos.items():
        texto = texto.replace(orig, rep)
    
    # 🔥 MEJORADO: Normalizar medidas correctamente
    # 1x4 → 1 x 4
    texto = re.sub(r'(\d+)\s*[xX×]\s*(\d+)', r'\1 x \2', texto)
    # 1"x4" → 1 x 4 (elimina comillas)
    texto = re.sub(r'(\d+)\s*["\']\s*[xX×]\s*(\d+)\s*["\']', r'\1 x \2', texto)
    # 1" → 1 pulgadas
    texto = re.sub(r'(\d+)\s*["\'](?![xX×])', r'\1 pulgadas', texto)
    # 1' → 1 pie
    texto = re.sub(r'(\d+)\s*[\']', r'\1 pies', texto)
    
    # Unificar espacios entre letras y números
    texto = re.sub(r'([a-z])\s+(\d)', r'\1\2', texto)
    texto = re.sub(r'(\d)\s+([a-z])', r'\1\2', texto)
    
    # Fracciones (ej: 2 1/2 → 2.5)
    texto = re.sub(r'(\d+)\s+(\d+)\/(\d+)', 
                   lambda m: str(float(m.group(1)) + float(m.group(2))/float(m.group(3))), texto)
    texto = re.sub(r'(\d+)\/(\d+)', 
                   lambda m: str(float(m.group(1))/float(m.group(2))), texto)
    
    # Limpiar caracteres especiales
    texto = re.sub(r'[^\w\s\/\-]', ' ', texto)
    texto = re.sub(r'\s+', ' ', texto).strip()
    
    return texto


def normalizar_sin_orden(texto: str) -> str:
    """Normaliza y ordena las palabras alfabéticamente para comparación sin orden."""
    texto_norm = normalizar(texto)
    palabras = sorted(texto_norm.split())
    return ' '.join(palabras)


def extraer_medidas(texto: str) -> dict:
    """Extrae todas las medidas de un producto para comparación exacta."""
    medidas = {}
    texto_lower = texto.lower()

    # Dimensiones 3D (ej: 10x20x30)
    dim3 = re.findall(r'(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)', texto_lower)
    if dim3:
        medidas['dim3'] = [float(d) for d in dim3[0]]

    # Dimensiones 2D (ej: 10x20)
    dim2 = re.findall(r'(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)', texto_lower)
    if dim2:
        medidas['dim2'] = [float(d) for d in dim2[0]]

    # Fracciones
    frac = re.findall(r'(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)', texto_lower)
    for f in frac:
        if f[0]:
            medidas['fraccion'] = float(f[0]) + float(f[1]) / float(f[2])
        else:
            medidas['fraccion'] = float(f[3]) / float(f[4])

    # Pulgadas
    pulg = re.findall(r'(\d+(?:\.\d+)?)\s*(?:"|pulgadas?|pulg\b|inch)', texto_lower)
    if pulg:
        medidas['pulgadas'] = float(pulg[0])

    # Milímetros
    mm = re.findall(r'(\d+(?:\.\d+)?)\s*mm', texto_lower)
    if mm:
        medidas['mm'] = [float(m) for m in mm]

    # Kilogramos
    kg = re.findall(r'(\d+(?:\.\d+)?)\s*kg', texto_lower)
    if kg:
        medidas['kg'] = float(kg[0])

    # Litros
    lts = re.findall(r'(\d+(?:\.\d+)?)\s*(?:lt|lts|litros?|l\b)', texto_lower)
    if lts:
        medidas['litros'] = float(lts[0])

    # Metros
    mts = re.findall(r'(\d+(?:\.\d+)?)\s*(?:mt|mts|metros?|m\b)', texto_lower)
    if mts:
        medidas['metros'] = float(mts[0])

    return medidas


def medidas_a_texto(medidas: dict) -> str:
    """Convierte dict de medidas a texto legible para la IA."""
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
        if isinstance(medidas['mm'], list):
            partes.append(f"{medidas['mm'][0]}mm")
        else:
            partes.append(f"{medidas['mm']}mm")
    if 'kg' in medidas:
        partes.append(f"{medidas['kg']}kg")
    if 'litros' in medidas:
        partes.append(f"{medidas['litros']}lt")
    if 'metros' in medidas:
        partes.append(f"{medidas['metros']}m")
    return ", ".join(partes) if partes else "sin medidas"


def comparar_medidas(medidas_b: dict, medidas_e: dict) -> float:
    """Compara medidas entre buscado y encontrado. Retorna 0-1."""
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
            if len(val_b) == len(val_e):
                if all(abs(a - b) < 0.5 for a, b in zip(sorted(val_b), sorted(val_e))):
                    coincidencias += 1
        elif isinstance(val_b, (int, float)) and isinstance(val_e, (int, float)):
            # Tolerancia del 10%
            tolerancia = max(0.1, val_b * 0.1)
            if abs(val_b - val_e) <= tolerancia:
                coincidencias += 1
        elif isinstance(val_b, list) and isinstance(val_e, (int, float)):
            # Comparar lista contra escalar (ej: [150] vs 150)
            if len(val_b) == 1 and abs(val_b[0] - val_e) < 0.5:
                coincidencias += 1
        elif isinstance(val_e, list) and isinstance(val_b, (int, float)):
            if len(val_e) == 1 and abs(val_b - val_e[0]) < 0.5:
                coincidencias += 1
    
    return coincidencias / total if total > 0 else 0.5


def extraer_especificaciones(texto: str) -> set:
    """Extrae especificaciones técnicas del texto."""
    specs = set()
    texto_norm = normalizar(texto)
    
    materiales = ['acero', 'hierro', 'fierro', 'pino', 'madera', 'cemento', 'cal', 'arena', 'pino radiata', 'pino insigne']
    for m in materiales:
        if m in texto_norm:
            specs.add(m)
    
    tipos = ['estriado', 'liso', 'bruto', 'sin cepillar', 'estructural', 'tubular', 'cuadrado', 'rectangular',
             'redondo', 'colaborante', 'recocido', 'semibrillo', 'anticorrosivo', 'galvanizado', 'cepillado']
    for t in tipos:
        if t in texto_norm:
            specs.add(t)
    
    # Detectar sinónimos
    if 'bruto' in texto_norm or 'sin cepillar' in texto_norm:
        specs.add('bruto')
    if 'cepillado' in texto_norm:
        specs.add('cepillado')
    
    normas = re.findall(r'\b[a-z]+\d+\b', texto_norm)
    specs.update(normas)
    
    return specs


# ==========================================
# FUNCIÓN DE CONCORDANCIA MEJORADA
# Detecta palabras invertidas, medidas equivalentes, etc.
# ==========================================

def calcular_concordancia(buscado: str, encontrado: str) -> int:
    """Calcula coincidencia entre producto buscado y encontrado.
    Mejorado para detectar:
    - Palabras invertidas (ej: "Madera Pino" vs "Pino Madera")
    - Medidas (1x4 vs 1"x4")
    - Términos equivalentes (bruto vs sin cepillar)
    """
    b_norm = normalizar(buscado)
    e_norm = normalizar(encontrado)
    
    if not b_norm or not e_norm:
        return 0
    
    # 1. SIMILITUD DE SECUENCIA (SequenceMatcher) - 15%
    seq_ratio = SequenceMatcher(None, b_norm, e_norm).ratio()
    
    # 2. SIMILITUD DE CONJUNTO DE PALABRAS (ignora orden) - 30%
    palabras_b = set(b_norm.split())
    palabras_e = set(e_norm.split())
    
    palabras_b_filtradas = {p for p in palabras_b if len(p) > 2}
    if palabras_b_filtradas:
        interseccion = palabras_b_filtradas & palabras_e
        jaccard = len(interseccion) / len(palabras_b_filtradas)
    else:
        jaccard = 0.5
    
    # 3. DETECCIÓN DE TÉRMINOS EQUIVALENTES - 15%
    equivalencias = {
        'bruto': 'sin cepillar',
        'sin cepillar': 'bruto',
        'cepillado': 'cepillada',
        'cepillada': 'cepillado',
        'fierro': 'acero',
        'acero': 'fierro',
        'anticorrosivo': 'antioxidante',
        'antioxidante': 'anticorrosivo',
        'esmalte': 'pintura esmalte',
        'pino': 'pino radiata',
        'pino radiata': 'pino',
    }
    
    b_norm_eq = b_norm
    e_norm_eq = e_norm
    for orig, rep in equivalencias.items():
        b_norm_eq = b_norm_eq.replace(orig, rep)
        e_norm_eq = e_norm_eq.replace(orig, rep)
    
    seq_eq_ratio = SequenceMatcher(None, b_norm_eq, e_norm_eq).ratio()
    
    # 4. COINCIDENCIA DE MEDIDAS (crítica) - 25%
    medidas_b = extraer_medidas(buscado)
    medidas_e = extraer_medidas(encontrado)
    medida_score = comparar_medidas(medidas_b, medidas_e)
    
    # Bonificación por medidas exactas
    bono_medidas = 0
    if medidas_b and medidas_e:
        if medida_score >= 0.95:
            bono_medidas = 15
        elif medida_score >= 0.7:
            bono_medidas = 8
    
    # 5. COINCIDENCIA DE ESPECIFICACIONES TÉCNICAS - 15%
    specs_b = extraer_especificaciones(buscado)
    specs_e = extraer_especificaciones(encontrado)
    if specs_b:
        spec_match = len(specs_b & specs_e) / len(specs_b)
    else:
        spec_match = 0.5
    
    # 6. CÁLCULO FINAL DEL PUNTAJE
    score_base = (
        seq_ratio * 0.15 +
        jaccard * 0.30 +
        seq_eq_ratio * 0.15 +
        medida_score * 0.25 +
        spec_match * 0.15
    ) * 100
    
    # Aplicar bonificaciones
    score_final = score_base + bono_medidas
    
    # Penalización por palabras faltantes importantes
    palabras_importantes = {p for p in palabras_b if p in ['pino', 'madera', 'acero', 'fierro', 'cemento', 'pintura']}
    if palabras_importantes:
        faltantes = palabras_importantes - palabras_e
        penalizacion = len(faltantes) * 8
        score_final -= penalizacion
    
    # Penalización si el buscado tiene medidas pero el encontrado no
    if medidas_b and not medidas_e:
        score_final -= 15
    
    # Penalización por palabras faltantes críticas (más de 3)
    if len(palabras_b_filtradas - palabras_e) > 3:
        score_final -= 10
    
    return round(min(100, max(0, score_final)))


def clasificar_concordancia(score: int):
    """Clasifica el nivel de concordancia según el puntaje."""
    if score >= 90:
        return "exacta", "✅ Coincidencia exacta (mismo producto)"
    elif score >= 75:
        return "alta", "🟢 Alta coincidencia (mismo producto, variación menor)"
    elif score >= 60:
        return "parcial", "🟡 Coincidencia parcial (mismo tipo, varían detalles)"
    elif score >= 40:
        return "baja", "🟠 Baja coincidencia (producto relacionado)"
    else:
        return "nula", "🔴 Sin coincidencia (producto diferente)"


def es_mismo_producto_medidas_diferentes(buscado: str, encontrado: str) -> bool:
    """Detecta si dos nombres describen el mismo producto pero con medidas diferentes."""
    cat_b = clasificar_producto(buscado)
    cat_e = clasificar_producto(encontrado)
    
    if cat_b != cat_e:
        return False
    
    # Extraer tipo base (sin medidas)
    base_b = re.sub(r'\d+[xX×]\d+', 'X', buscado.lower())
    base_b = re.sub(r'\d+', '', base_b)
    base_b = re.sub(r'["\']', '', base_b)
    base_b = ' '.join(sorted(set(base_b.split())))
    
    base_e = re.sub(r'\d+[xX×]\d+', 'X', encontrado.lower())
    base_e = re.sub(r'\d+', '', base_e)
    base_e = re.sub(r'["\']', '', base_e)
    base_e = ' '.join(sorted(set(base_e.split())))
    
    similitud = SequenceMatcher(None, base_b, base_e).ratio()
    return similitud > 0.6


# ==========================================
# ANÁLISIS SEMÁNTICO ENRIQUECIDO
# ==========================================

def analizar_producto_buscado(nombre: str) -> dict:
    """Extrae toda la información estructurada del producto buscado."""
    categoria = clasificar_producto(nombre)
    medidas = extraer_medidas(nombre)
    specs = list(extraer_especificaciones(nombre))
    nombre_norm = normalizar(nombre)
    palabras = [p for p in nombre_norm.split() if len(p) > 2]

    tiene_medidas = bool(medidas)
    medidas_texto = medidas_a_texto(medidas)
    unidades_esperadas = CATEGORIAS_PRODUCTOS.get(categoria, {}).get("unidades_relevantes", [])

    palabras_accesorio = ["repuesto", "accesorio", "disco", "carbón", "estuche", "funda",
                          "tornillo de", "tuerca de", "filtro para", "correa para"]
    es_accesorio = any(p in nombre.lower() for p in palabras_accesorio)

    marcas_conocidas = ["sherwin", "sipa", "gerdau", "cintac", "arauco", "masisa",
                        "melon", "melón", "bío bío", "stanley", "bosch", "dewalt",
                        "makita", "hilti", "sika", "weber"]
    marca_detectada = None
    nombre_lower = nombre.lower()
    for marca in marcas_conocidas:
        if marca in nombre_lower:
            marca_detectada = marca
            break

    return {
        "nombre_original": nombre,
        "nombre_normalizado": nombre_norm,
        "nombre_sin_orden": normalizar_sin_orden(nombre),
        "categoria": categoria,
        "palabras_clave": palabras,
        "medidas": {
            "tiene_medidas": tiene_medidas,
            "detalle": medidas,
            "texto_legible": medidas_texto,
        },
        "especificaciones_tecnicas": specs,
        "unidades_relevantes": unidades_esperadas,
        "es_accesorio": es_accesorio,
        "marca_detectada": marca_detectada,
        "tipo_producto": inferir_tipo_producto(nombre),
    }


def inferir_tipo_producto(nombre: str) -> dict:
    """Detecta el tipo de producto para que la IA sepa qué esperar."""
    nombre_lower = nombre.lower()
    return {
        "maquinaria_pesada": any(p in nombre_lower for p in [
            "retroexcavadora", "minicargador", "grúa", "compactador", "pavimentadora"
        ]),
        "herramienta_electrica": any(p in nombre_lower for p in [
            "taladro", "amoladora", "sierra", "esmeril", "compresor", "soldadora"
        ]),
        "material_construccion": any(p in nombre_lower for p in [
            "cemento", "hormigón", "arena", "grava", "madera", "fierro", "acero",
            "tubo", "placa", "tabla", "barra"
        ]),
        "articulo_pequeno": any(p in nombre_lower for p in [
            "clavo", "tornillo", "perno", "tuerca", "remache", "tarugos"
        ]),
        "pintura_quimico": any(p in nombre_lower for p in [
            "pintura", "anticorrosivo", "barniz", "esmalte", "sellador", "impermeabilizante"
        ]),
        "senaletica_vial": any(p in nombre_lower for p in [
            "letrero", "señal", "tránsito", "paso cebra", "tachas", "delineador"
        ]),
    }


def analizar_resultado_encontrado(resultado: dict, analisis_buscado: dict) -> dict:
    """Analiza un resultado encontrado en contexto del producto buscado."""
    nombre = resultado.get("nombre", "")
    medidas_encontradas = extraer_medidas(nombre)
    specs_encontradas = list(extraer_especificaciones(nombre))
    score = calcular_concordancia(analisis_buscado["nombre_original"], nombre)
    nivel, etiqueta = clasificar_concordancia(score)

    # Detectar si hay conflicto de medidas
    medidas_buscado = analisis_buscado["medidas"]["detalle"]
    conflicto_medidas = False
    if medidas_buscado and medidas_encontradas:
        score_medidas = comparar_medidas(medidas_buscado, medidas_encontradas)
        conflicto_medidas = score_medidas < 0.5

    # Detectar palabras que coinciden exactamente
    palabras_b = set(analisis_buscado["palabras_clave"])
    palabras_e = set(normalizar(nombre).split())
    palabras_comunes = list(palabras_b & palabras_e)
    palabras_faltantes = list(palabras_b - palabras_e)

    return {
        "medidas_encontradas": medidas_a_texto(medidas_encontradas),
        "specs_encontradas": specs_encontradas,
        "score_python": score,
        "nivel_python": nivel,
        "palabras_comunes": palabras_comunes,
        "palabras_faltantes": palabras_faltantes,
        "conflicto_medidas": conflicto_medidas,
    }


# ==========================================
# FILTROS DE RESULTADOS CHILENOS
# ==========================================

def es_resultado_chileno(item: dict) -> bool:
    url = item.get('url', item.get('link', '')).lower()
    tienda = item.get('tienda', item.get('source', '')).lower()

    for ind in INDICADORES_EXTRANJEROS:
        if ind in url or ind in tienda:
            return False

    precio_raw = str(item.get('price', item.get('precio_con_iva', '')))
    if MONEDAS_EXTRANJERAS.search(precio_raw):
        return False

    if '.cl' in url:
        return True

    for datos in DOMINIOS_CHILE.values():
        if datos['dominio'] in url:
            return True

    if 'mercadolibre' in url and '/mlc' in url.lower():
        return True

    if 'fuente' in item and item['fuente'] == 'google_shopping_cl':
        return True

    return False


def prioridad_tienda(url: str, tienda: str) -> int:
    url_lower = url.lower()
    tienda_lower = tienda.lower()
    for nombre, datos in DOMINIOS_CHILE.items():
        if datos['dominio'] in url_lower or nombre in tienda_lower:
            return datos['prioridad']
    return 3


def limpiar_nombre(nombre: str) -> str:
    nombre = re.sub(r'\s*[\|–—]\s*.*$', '', nombre)
    nombre = re.sub(r'\s*MercadoLibre.*$', '', nombre, flags=re.IGNORECASE)
    nombre = re.sub(r'\s*Envío\s*(gratis|internacional|express).*$', '', nombre, flags=re.IGNORECASE)
    nombre = re.sub(r'\s*✓.*$', '', nombre)
    nombre = re.sub(r'\s*\(.*?\)$', '', nombre)
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


# ==========================================
# MERCADOLIBRE CHILE
# ==========================================

def buscar_mercadolibre(producto: str, limite: int = 15):
    limpiar_cache_expirado()
    cache_key = get_cache_key(f"ml_{producto}", limite)
    if cache_key in cache_resultados:
        return cache_resultados[cache_key]['data']

    try:
        url = "https://api.mercadolibre.com/sites/MLC/search"
        params = {"q": producto, "limit": limite, "condition": "new", "country": "CL"}
        r = requests.get(url, params=params, timeout=10)
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


# ==========================================
# GOOGLE SERPER
# ==========================================

def fetch_serper(query: str, search_type: str = "search", retries: int = 2) -> dict:
    url = f"https://google.serper.dev/{search_type}"
    payload = json.dumps({
        "q": query,
        "gl": "cl",
        "hl": "es",
        "num": 20,
        "location": "Chile"
    })
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}

    for intento in range(retries):
        try:
            response = requests.post(url, headers=headers, data=payload, timeout=12)
            if response.status_code == 200:
                return response.json()
            time.sleep(1)
        except Exception as e:
            print(f"  [Serper] Intento {intento+1}: {e}")
            time.sleep(1)
    return {}


def buscar_google_shopping_chile(producto: str, limite: int = 15):
    limpiar_cache_expirado()
    cache_key = get_cache_key(f"gs_{producto}", limite)
    if cache_key in cache_resultados:
        return cache_resultados[cache_key]['data']

    query = f"{producto} precio Chile"
    data = fetch_serper(query, "shopping")
    items = data.get('shopping', [])

    resultados = []
    for item in items[:limite * 2]:
        raw_price = item.get('price', '')
        if not raw_price:
            continue
        precio = limpiar_precio(raw_price)
        if precio is None:
            continue
        nombre = limpiar_nombre(item.get('title', ''))
        if len(nombre) < 4:
            continue
        url_item = item.get('link', '')
        tienda = item.get('source', 'Tienda Chile')

        resultado = {
            "tienda": tienda[:40],
            "nombre": nombre[:150],
            "precio_con_iva": precio,
            "url": url_item,
            "fuente": "google_shopping_cl",
            "pais": "CL",
        }
        if es_resultado_chileno(resultado):
            resultados.append(resultado)

    cache_resultados[cache_key] = {'data': resultados, 'timestamp': time.time()}
    return resultados


def buscar_web_organica_chile(producto: str, categoria: str, limite: int = 10):
    datos_cat = CATEGORIAS_PRODUCTOS.get(categoria, CATEGORIAS_PRODUCTOS["ferreteria_general"])
    queries_extra = datos_cat.get("queries_extra", [])
    resultados = []

    for query_template in queries_extra[:2]:
        query = query_template.format(producto=producto)
        data = fetch_serper(query, "search")
        organicos = data.get('organic', [])

        for item in organicos[:5]:
            url_item = item.get('link', '')
            tienda = item.get('displayLink', item.get('source', ''))
            nombre = item.get('title', '')
            snippet = item.get('snippet', '')

            precio_match = re.search(r'\$\s*([\d\.,]+)', snippet)
            if not precio_match:
                continue

            precio = limpiar_precio(precio_match.group(1))
            if precio is None:
                continue

            resultado = {
                "tienda": tienda[:40],
                "nombre": limpiar_nombre(nombre)[:150],
                "precio_con_iva": precio,
                "url": url_item,
                "fuente": "web_organica",
                "pais": "CL",
            }
            if es_resultado_chileno(resultado):
                resultados.append(resultado)

        time.sleep(random.uniform(0.3, 0.6))

    return resultados


# ==========================================
# GENERACIÓN DE QUERIES INTELIGENTES
# ==========================================

def generar_queries(producto: str, categoria: str) -> list:
    queries = []
    queries.append(f"{producto} Chile precio")

    prod_norm = re.sub(r'(\d+)\s*"', r'\1 pulgadas', producto)
    prod_norm = re.sub(r'(\d+)\s*\'', r'\1 pies', prod_norm)
    if prod_norm != producto:
        queries.append(f"{prod_norm} precio Chile")

    def expandir_fraccion(txt):
        return re.sub(r'(\d+)\s+(\d+)\/(\d+)',
            lambda m: str(float(m.group(1)) + float(m.group(2))/float(m.group(3))), txt)
    prod_frac = expandir_fraccion(producto)
    if prod_frac != producto:
        queries.append(f"{prod_frac} Chile")

    terminos_extra = {
        "madera": ["maderera", "tablón Chile"],
        "metal_acero": ["acero Chile CLP", "siderúrgica Chile"],
        "cemento_hormigon": ["hormigonera Chile", "saco Chile CLP"],
        "senaletica": ["vialidad Chile", "señalética tránsito Chile"],
        "pintura_recubrimiento": ["galón Chile", "litro Chile CLP"],
    }

    for termino in terminos_extra.get(categoria, []):
        queries.append(f"{producto} {termino}")

    return list(dict.fromkeys(queries))[:5]


# ==========================================
# BÚSQUEDA PRINCIPAL
# ==========================================

def realizar_busqueda(producto: str, limite: int = 15):
    print(f"\n  🔍 Producto: {producto}")
    categoria = clasificar_producto(producto)
    print(f"  📂 Categoría: {categoria}")

    resultados = []
    urls_vistas = set()

    def agregar_sin_duplicados(nuevos):
        for r in nuevos:
            url = r.get('url', '')
            nombre_norm = normalizar(r.get('nombre', ''))
            clave = url or nombre_norm
            if clave and clave not in urls_vistas:
                urls_vistas.add(clave)
                resultados.append(r)

    print(f"  📡 MercadoLibre Chile...")
    ml = buscar_mercadolibre(producto, limite)
    agregar_sin_duplicados(ml)
    print(f"  📊 ML: {len(ml)} → Total: {len(resultados)}")

    if len(resultados) < limite:
        print(f"  📡 Google Shopping Chile...")
        time.sleep(random.uniform(0.4, 0.8))
        gs = buscar_google_shopping_chile(producto, limite)
        agregar_sin_duplicados(gs)
        print(f"  📊 GS: {len(gs)} → Total: {len(resultados)}")

    if len(resultados) < 9:
        queries = generar_queries(producto, categoria)
        for query in queries[1:3]:
            if len(resultados) >= 9:
                break
            print(f"  📡 Variación: '{query[:50]}'...")
            time.sleep(random.uniform(0.3, 0.7))
            extra_gs = buscar_google_shopping_chile(query, 6)
            agregar_sin_duplicados(extra_gs)

    if len(resultados) < 5:
        print(f"  📡 Búsqueda web orgánica especializada...")
        organicos = buscar_web_organica_chile(producto, categoria)
        agregar_sin_duplicados(organicos)
        print(f"  📊 Orgánica: {len(organicos)} → Total: {len(resultados)}")

    if not resultados:
        return [], {}

    # ANÁLISIS ENRIQUECIDO DEL PRODUCTO BUSCADO
    analisis_buscado = analizar_producto_buscado(producto)

    # SCORING + METADATA por resultado
    for r in resultados:
        analisis_r = analizar_resultado_encontrado(r, analisis_buscado)
        score = analisis_r["score_python"]
        nivel, etiqueta = clasificar_concordancia(score)
        prioridad = prioridad_tienda(r.get('url', ''), r.get('tienda', ''))

        r["score"] = score
        r["nivel_concordancia"] = nivel
        r["etiqueta_concordancia"] = etiqueta
        r["prioridad_tienda"] = prioridad
        r["categoria"] = categoria
        r["precio_neto"] = round(r["precio_con_iva"] / IVA)
        r["precio_formateado"] = f"${r['precio_con_iva']:,.0f}".replace(",", ".")
        r["_analisis"] = analisis_r

    resultados.sort(key=lambda x: (-x["score"], -x["prioridad_tienda"], x["precio_con_iva"]))

    resultados_filtrados = [r for r in resultados if r["score"] >= 10]
    if not resultados_filtrados:
        resultados_filtrados = resultados

    return resultados_filtrados[:limite], analisis_buscado


# ==========================================
# ENDPOINTS
# ==========================================

@app.route("/python/busqueda-robusta", methods=["GET"])
def busqueda_robusta():
    producto = request.args.get("producto", "").strip()
    numero_item = request.args.get("numero", "")
    minimo_requerido = int(request.args.get("minimo", 15))
    force_refresh = request.args.get("force", "").lower() == "true"

    print("\n" + "=" * 60)
    print(f"🔍 [{numero_item}] {producto}")
    print(f"🎯 Mínimo: {minimo_requerido} | País: CHILE 🇨🇱")
    print("=" * 60)

    if not producto:
        return jsonify({
            "numero_item": numero_item,
            "producto": producto,
            "resultados": [],
            "total_encontrados": 0,
            "suficientes": False,
            "deficit": minimo_requerido,
            "categoria": "desconocida",
            "analisis_producto": {},
        })

    if force_refresh:
        cache_keys = [k for k in cache_resultados.keys() if producto.lower() in k.lower()]
        for k in cache_keys:
            del cache_resultados[k]
        print(f"  🔄 Cache limpiado para: {producto}")

    resultados, analisis_buscado = realizar_busqueda(producto, minimo_requerido * 2)
    categoria = clasificar_producto(producto)

    resultados_formateados = []
    for r in resultados:
        analisis_r = r.pop("_analisis", {})
        resultados_formateados.append({
            "tienda": r.get("tienda", ""),
            "nombre": r.get("nombre", ""),
            "precio_valor": r.get("precio_con_iva", 0),
            "precio_neto": r.get("precio_neto", 0),
            "precio_formateado": r.get("precio_formateado", "Consultar"),
            "link": r.get("url", ""),
            "canal": r.get("fuente", "web"),
            "pais": r.get("pais", "CL"),
            "busqueda_original": producto,
            "score": r.get("score", 0),
            "nivel_concordancia": r.get("nivel_concordancia", ""),
            "etiqueta_concordancia": r.get("etiqueta_concordancia", ""),
            "categoria": r.get("categoria", categoria),
            "prioridad_tienda": r.get("prioridad_tienda", 3),
            "medidas_encontradas": analisis_r.get("medidas_encontradas", ""),
            "specs_encontradas": analisis_r.get("specs_encontradas", []),
            "palabras_comunes": analisis_r.get("palabras_comunes", []),
            "palabras_faltantes": analisis_r.get("palabras_faltantes", []),
            "conflicto_medidas": analisis_r.get("conflicto_medidas", False),
        })

    tiene_suficientes = len(resultados_formateados) >= minimo_requerido
    mejor = resultados_formateados[0] if resultados_formateados else None

    print(f"\n📊 TOTAL: {len(resultados_formateados)} resultados chilenos")
    print(f"✅ Suficiente: {tiene_suficientes}")
    if mejor:
        print(f"🏆 Mejor: {mejor['tienda']} → ${mejor['precio_valor']:,} ({mejor['score']}% concordancia)")
    print("=" * 60)

    return jsonify({
        "numero_item": numero_item,
        "producto": producto,
        "categoria": categoria,
        "resultados": resultados_formateados,
        "total_encontrados": len(resultados_formateados),
        "suficientes": tiene_suficientes,
        "deficit": max(0, minimo_requerido - len(resultados_formateados)),
        "pais_busqueda": "CL",
        "analisis_producto": analisis_buscado,
    })


@app.route("/python/index", methods=["GET"])
def scrape_prices():
    producto = request.args.get("producto", "").strip()
    if not producto:
        return jsonify([])
    resultado = busqueda_robusta()
    return jsonify(resultado.get_json().get("resultados", []))


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "pais": "Chile 🇨🇱",
        "cache_size": len(cache_resultados),
        "categorias_disponibles": list(CATEGORIAS_PRODUCTOS.keys()),
        "tiendas_registradas": len(DOMINIOS_CHILE),
    })


@app.route("/python/cache/clear", methods=["POST"])
def clear_cache():
    cache_resultados.clear()
    return jsonify({"status": "ok", "mensaje": "Caché limpiado"})


@app.route("/python/categorias", methods=["GET"])
def listar_categorias():
    producto = request.args.get("producto", "").strip()
    if not producto:
        return jsonify({"error": "Falta parámetro 'producto'"})

    analisis = analizar_producto_buscado(producto)
    queries = generar_queries(producto, analisis["categoria"])

    return jsonify({
        "producto": producto,
        "analisis_completo": analisis,
        "queries_generados": queries,
    })


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 BUSCADOR CHILE - GRUPO ICA v3.1 (MEJORADO)")
    print("   • Detección de palabras invertidas")
    print("   • Normalización avanzada de medidas")
    print("   • Coincidencia semántica mejorada")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)