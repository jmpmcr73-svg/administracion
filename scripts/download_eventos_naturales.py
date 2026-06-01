#!/usr/bin/env python3
# CAIA-HUB: Descarga de eventos naturales (global)
# Fuentes públicas y gratuitas (NO usan API keys):
#   - ENSO/ONI  : NOAA CPC      -> clima_enso_fases
#   - Sismos    : USGS FDSN API -> eventos_sismos
#   - Huracanes : NOAA IBTrACS  -> eventos_huracanes
#   - Tornados  : NOAA SPC (US) -> eventos_tornados
#
# Uso:
#   python3 scripts/download_eventos_naturales.py --source all
#   python3 scripts/download_eventos_naturales.py --source enso
#   python3 scripts/download_eventos_naturales.py --source sismos --start 2020 --end 2024 --min-mag 5.0
#   python3 scripts/download_eventos_naturales.py --test        # muestra reducida para validar

import os
import sys
import csv
import io
import argparse
import subprocess
from datetime import datetime, date

# --- dependencias ---
try:
    from dotenv import load_dotenv
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "python-dotenv"])
    from dotenv import load_dotenv
try:
    from supabase import create_client
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "supabase"])
    from supabase import create_client
try:
    import requests
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

ENV_FILE = os.path.expanduser("~/.env.caia-hub")

# Fuentes
ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"
IBTRACS_URL = ("https://www.ncei.noaa.gov/data/"
               "international-best-track-archive-for-climate-stewardship-ibtracs/"
               "v04r01/access/csv/ibtracs.last3years.list.v04r01.csv")
IBTRACS_ALL_URL = ("https://www.ncei.noaa.gov/data/"
                   "international-best-track-archive-for-climate-stewardship-ibtracs/"
                   "v04r01/access/csv/ibtracs.ALL.list.v04r01.csv")
SPC_TORNADO_URL = "https://www.spc.noaa.gov/wcm/data/1950-2023_actual_tornadoes.csv"

# Centro de cada temporada trimestral ONI -> mes (1-12)
SEASON_CENTER = {
    "DJF": 1, "JFM": 2, "FMA": 3, "MAM": 4, "AMJ": 5, "MJJ": 6,
    "JJA": 7, "JAS": 8, "ASO": 9, "SON": 10, "OND": 11, "NDJ": 12,
}


def log(level, msg):
    icons = {"INFO": "ℹ️", "OK": "✅", "ERR": "❌", "WARN": "⚠️", "STEP": "🔹"}
    print(f"[{datetime.now():%H:%M:%S}] {icons.get(level,'▸')} {msg}")


def connect():
    load_dotenv(ENV_FILE)
    url = os.getenv("SUPABASE_CAIA_HUB_URL")
    key = os.getenv("SUPABASE_CAIA_HUB_SERVICE_ROLE_KEY")
    if not url or not key:
        log("ERR", "Faltan SUPABASE_CAIA_HUB_URL / SERVICE_ROLE_KEY en ~/.env.caia-hub")
        sys.exit(1)
    return create_client(url, key)


def dedup_rows(rows, on_conflict):
    """Elimina filas con clave de conflicto duplicada (gana la última).
    Evita el error 'ON CONFLICT DO UPDATE cannot affect row a second time'."""
    keys = [k.strip() for k in on_conflict.split(",")]
    seen = {}
    for r in rows:
        k = tuple(r.get(c) for c in keys)
        seen[k] = r  # la última ocurrencia sobreescribe
    return list(seen.values())


def upsert_chunked(sb, table, rows, on_conflict, chunk=500):
    """Inserta filas en lotes. Devuelve cuántas se procesaron."""
    rows = dedup_rows(rows, on_conflict)
    total = 0
    for i in range(0, len(rows), chunk):
        batch = rows[i:i + chunk]
        sb.table(table).upsert(batch, on_conflict=on_conflict).execute()
        total += len(batch)
        log("INFO", f"  {table}: {total}/{len(rows)}")
    return total


# =============================================================================
# ENSO / ONI
# =============================================================================
def classify_oni(v):
    fase = "El Nino" if v >= 0.5 else "La Nina" if v <= -0.5 else "Neutro"
    a = abs(v)
    if fase == "Neutro":
        intens = None
    elif a >= 2.0:
        intens = "Very Strong"
    elif a >= 1.5:
        intens = "Strong"
    elif a >= 1.0:
        intens = "Moderate"
    else:
        intens = "Weak"
    return fase, intens


def fetch_enso(sb, test=False):
    log("STEP", "ENSO/ONI desde NOAA CPC")
    r = requests.get(ONI_URL, timeout=60)
    r.raise_for_status()
    rows = []
    for line in r.text.splitlines()[1:]:  # saltar cabecera
        parts = line.split()
        if len(parts) != 4:
            continue
        seas, yr, total, anom = parts
        try:
            yr = int(yr)
            anom = float(anom)
        except ValueError:
            continue
        mes = SEASON_CENTER.get(seas)
        fecha_centro = date(yr, mes, 15).isoformat() if mes else None
        fase, intens = classify_oni(anom)
        rows.append({
            "periodo": seas, "anio": yr, "fecha_centro": fecha_centro,
            "oni_valor": anom, "fase": fase, "intensidad": intens,
            "fuente": "NOAA CPC ONI",
        })
    if test:
        rows = rows[-12:]
    n = upsert_chunked(sb, "clima_enso_fases", rows, "anio,periodo")
    log("OK", f"ENSO: {n} periodos cargados")


# =============================================================================
# SISMOS (USGS)
# =============================================================================
def fetch_sismos(sb, start_year, end_year, min_mag, test=False):
    log("STEP", f"Sismos USGS {start_year}-{end_year} (mag>={min_mag})")
    if test:
        start_year, end_year, min_mag = end_year, end_year, max(min_mag, 6.0)
    total = 0
    for yr in range(start_year, end_year + 1):
        params = {
            "format": "csv",
            "starttime": f"{yr}-01-01",
            "endtime": f"{yr+1}-01-01",
            "minmagnitude": min_mag,
            "orderby": "time",
        }
        r = requests.get(USGS_URL, params=params, timeout=120)
        r.raise_for_status()
        reader = csv.DictReader(io.StringIO(r.text))
        rows = []
        for x in reader:
            try:
                rows.append({
                    "fecha_hora": x.get("time"),
                    "magnitud": float(x["mag"]) if x.get("mag") else None,
                    "tipo_mag": x.get("magType"),
                    "profundidad_km": float(x["depth"]) if x.get("depth") else None,
                    "lat": float(x["latitude"]) if x.get("latitude") else None,
                    "lon": float(x["longitude"]) if x.get("longitude") else None,
                    "lugar": x.get("place"),
                    "tsunami": x.get("tsunami") in ("1", 1),
                    "fuente": "USGS",
                    "external_id": x.get("id"),
                })
            except (ValueError, KeyError):
                continue
        if rows:
            total += upsert_chunked(sb, "eventos_sismos", rows, "external_id")
        log("INFO", f"  {yr}: acumulado {total}")
        if test:
            break
    log("OK", f"Sismos: {total} eventos cargados")


# =============================================================================
# HURACANES (IBTrACS global)
# =============================================================================
def fetch_huracanes(sb, test=False):
    log("STEP", "Huracanes IBTrACS (global)")
    url = IBTRACS_URL if test else IBTRACS_ALL_URL
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    reader = csv.DictReader(io.StringIO(r.text))
    next(reader, None)  # segunda fila = unidades, se descarta
    rows = []
    for x in reader:
        iso = x.get("ISO_TIME", "").strip()
        if not iso:
            continue
        def num(k):
            v = x.get(k, "").strip()
            try:
                return float(v)
            except ValueError:
                return None
        rows.append({
            "storm_id": x.get("SID", "").strip(),
            "nombre": (x.get("NAME", "") or "").strip() or None,
            "cuenca": x.get("BASIN", "").strip() or None,
            "fecha_hora": iso,
            "lat": num("LAT"),
            "lon": num("LON"),
            "categoria": (x.get("USA_STATUS", "") or x.get("NATURE", "")).strip() or None,
            "viento_max_kt": num("USA_WIND") or num("WMO_WIND"),
            "presion_mb": num("USA_PRES") or num("WMO_PRES"),
            "fuente": "NOAA IBTrACS",
        })
    if test:
        rows = rows[:500]
    n = upsert_chunked(sb, "eventos_huracanes", rows, "storm_id,fecha_hora,fuente")
    log("OK", f"Huracanes: {n} puntos de trayectoria cargados")


# =============================================================================
# TORNADOS (NOAA SPC - solo EE.UU.)
# =============================================================================
def fetch_tornados(sb, test=False):
    log("STEP", "Tornados NOAA SPC (EE.UU.)")
    log("WARN", "SPC solo cubre EE.UU.; no existe un catálogo global homogéneo de tornados")
    r = requests.get(SPC_TORNADO_URL, timeout=300)
    r.raise_for_status()
    reader = csv.DictReader(io.StringIO(r.text))
    rows = []
    for x in reader:
        def num(k):
            v = (x.get(k, "") or "").strip()
            try:
                return float(v)
            except ValueError:
                return None
        yr, mo, dy = x.get("yr"), x.get("mo"), x.get("dy")
        fecha = None
        try:
            fecha = date(int(yr), int(mo), int(dy)).isoformat()
        except (ValueError, TypeError):
            pass
        ef = x.get("mag")
        rows.append({
            "fecha": fecha,
            "hora": (x.get("time") or "").strip() or None,
            "pais": "US",
            "estado": (x.get("st") or "").strip() or None,
            "escala_ef": f"EF{ef}" if ef not in (None, "", "-9") else None,
            "lat_inicio": num("slat"),
            "lon_inicio": num("slon"),
            "lat_fin": num("elat"),
            "lon_fin": num("elon"),
            "longitud_km": (num("len") or 0) * 1.60934 if num("len") else None,  # millas->km
            "ancho_m": (num("wid") or 0) * 0.9144 if num("wid") else None,       # yardas->m
            "muertes": int(num("fat")) if num("fat") is not None else None,
            "heridos": int(num("inj")) if num("inj") is not None else None,
            "fuente": "NOAA SPC",
            # om = nº de tornado; un tornado que cruza estados/segmentos aparece
            # en varias filas -> incluimos estado (st) y segmento (sg) para unicidad
            "external_id": "-".join([
                (x.get("om") or "").strip(),
                str(yr),
                (x.get("st") or "").strip(),
                (x.get("sg") or "0").strip(),
            ]),
        })
    if test:
        rows = rows[:500]
    n = upsert_chunked(sb, "eventos_tornados", rows, "external_id,fuente")
    log("OK", f"Tornados: {n} eventos cargados")


# =============================================================================
def main():
    ap = argparse.ArgumentParser(description="CAIA-Hub: descarga de eventos naturales")
    ap.add_argument("--source", default="all",
                    choices=["all", "enso", "sismos", "huracanes", "tornados"])
    ap.add_argument("--start", type=int, default=2005, help="año inicial (sismos)")
    ap.add_argument("--end", type=int, default=datetime.now().year, help="año final (sismos)")
    ap.add_argument("--min-mag", type=float, default=4.5, help="magnitud mínima (sismos)")
    ap.add_argument("--test", action="store_true", help="muestra reducida para validar")
    args = ap.parse_args()

    sb = connect()
    log("OK", f"Conectado a {os.getenv('SUPABASE_CAIA_HUB_URL')}")
    if args.test:
        log("WARN", "MODO TEST: descargando muestra reducida")

    src = args.source
    try:
        if src in ("all", "enso"):
            fetch_enso(sb, args.test)
        if src in ("all", "sismos"):
            fetch_sismos(sb, args.start, args.end, args.min_mag, args.test)
        if src in ("all", "huracanes"):
            fetch_huracanes(sb, args.test)
        if src in ("all", "tornados"):
            fetch_tornados(sb, args.test)
    except requests.HTTPError as e:
        log("ERR", f"Error HTTP de la fuente: {e}")
        sys.exit(1)

    log("OK", "Descarga completada")


if __name__ == "__main__":
    main()
