#!/usr/bin/env python3
# CAIA-HUB: Descarga de casos de DENGUE (capa salud) desde OpenDengue
#
# Fuente: OpenDengue (https://opendengue.org) — base global abierta de casos de
# dengue, >56M casos, 102 países, 1924-2023+. Resolución semanal/mensual.
# Datos publicados en figshare (CSV). Licencia abierta (CC-BY).
#
# Filtra a los 7 países de Centroamérica y carga -> salud_vectores_semanal.
#
# Columnas OpenDengue (extract): adm_0_name (país), adm_1_name/adm_2_name
# (subnacional), calendar_start_date, calendar_end_date, T_res (temporal res),
# dengue_total (casos). Ver data dictionary en opendengue.org.
#
# Uso:
#   python3 scripts/download_salud_dengue.py --test     # valida con muestra
#   python3 scripts/download_salud_dengue.py            # carga CA completo
#   python3 scripts/download_salud_dengue.py --url <CSV_URL>   # fuente alterna

import os
import sys
import csv
import io
import argparse
import subprocess
from datetime import datetime


def _ensure(pkg, mod=None):
    try:
        __import__(mod or pkg)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])


for _p, _m in [("python-dotenv", "dotenv"), ("supabase", "supabase"), ("requests", "requests")]:
    _ensure(_p, _m)

from dotenv import load_dotenv
from supabase import create_client
import requests

ENV_FILE = os.path.expanduser("~/.env.caia-hub")

# Países de Centroamérica como aparecen en adm_0_name de OpenDengue
CA_COUNTRIES = {
    "Guatemala": "Guatemala",
    "Belize": "Belice",
    "Honduras": "Honduras",
    "El Salvador": "El Salvador",
    "Nicaragua": "Nicaragua",
    "Costa Rica": "Costa Rica",
    "Panama": "Panamá",
}

# Extract espacial (mejor resolución subnacional) publicado en figshare.
# Nota: si el enlace directo cambia, pasar --url con la URL del CSV actual
# descargado desde https://opendengue.org/data.html
DEFAULT_CSV_URL = (
    "https://opendengue.org/assets/data/"
    "OpenDengue_Spatial_extract_V1_2.csv"
)


def log(level, msg):
    icons = {"INFO": "ℹ️", "OK": "✅", "ERR": "❌", "WARN": "⚠️", "STEP": "🔹"}
    print(f"[{datetime.now():%H:%M:%S}] {icons.get(level,'▸')} {msg}")


def connect():
    load_dotenv(ENV_FILE)
    url = os.getenv("SUPABASE_CAIA_HUB_URL")
    key = os.getenv("SUPABASE_CAIA_HUB_SERVICE_ROLE_KEY")
    if not url or not key:
        log("ERR", "Faltan credenciales Supabase en ~/.env.caia-hub")
        sys.exit(1)
    return create_client(url, key)


def upsert(sb, table, rows, on_conflict, chunk=500):
    # dedup intra-lote por la clave de conflicto
    keys = [k.strip() for k in on_conflict.split(",")]
    seen = {}
    for r in rows:
        seen[tuple(r.get(k) for k in keys)] = r
    rows = list(seen.values())
    total = 0
    for i in range(0, len(rows), chunk):
        sb.table(table).upsert(rows[i:i+chunk], on_conflict=on_conflict).execute()
        total += len(rows[i:i+chunk])
        log("INFO", f"  {table}: {total}/{len(rows)}")
    return total


def iso_week(date_str):
    """'YYYY-MM-DD' -> (anio_epi, semana_epi)."""
    try:
        d = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        iso = d.isocalendar()
        return iso[0], iso[1]
    except (ValueError, TypeError):
        return None, None


def fetch_dengue(sb, csv_url, test=False):
    log("STEP", f"Descargando OpenDengue desde {csv_url}")
    try:
        r = requests.get(csv_url, timeout=300)
        r.raise_for_status()
    except requests.HTTPError as e:
        log("ERR", f"No se pudo descargar el CSV ({e}).")
        log("WARN", "Descarga manual el extract desde https://opendengue.org/data.html")
        log("WARN", "y reejecuta con:  --url file://<ruta_local.csv>  o la URL vigente")
        sys.exit(1)

    reader = csv.DictReader(io.StringIO(r.text))
    cols = reader.fieldnames or []
    # localizar columnas con tolerancia a variaciones de nombre
    def col(*cands):
        for c in cands:
            if c in cols:
                return c
        return None
    c_pais = col("adm_0_name", "ADM_0_NAME", "country")
    c_ini = col("calendar_start_date", "Calendar_start_date")
    c_casos = col("dengue_total", "Dengue_total", "cases")
    c_adm1 = col("adm_1_name", "FullName", "adm_2_name")
    if not (c_pais and c_ini and c_casos):
        log("ERR", f"Columnas inesperadas en el CSV: {cols[:10]}")
        sys.exit(1)

    rows = []
    matched = 0
    for x in reader:
        pais_src = (x.get(c_pais) or "").strip()
        if pais_src not in CA_COUNTRIES:
            continue
        matched += 1
        anio, semana = iso_week(x.get(c_ini, ""))
        if anio is None:
            continue
        try:
            casos = int(float(x.get(c_casos) or 0))
        except ValueError:
            casos = None
        rows.append({
            "zona_code": None,  # OpenDengue es por país/adm1; mapeo a zona en fase posterior
            "pais": CA_COUNTRIES[pais_src],
            "enfermedad": "dengue",
            "anio": anio,
            "semana_epi": semana,
            "casos": casos,
            "casos_graves": None,
            "defunciones": None,
            "fuente": "OpenDengue",
        })
        if test and matched >= 200:
            break

    if not rows:
        log("WARN", "No se encontraron registros de Centroamérica en el CSV.")
        return
    n = upsert(sb, "salud_vectores_semanal", rows,
               "pais,zona_code,enfermedad,anio,semana_epi,fuente")
    log("OK", f"Dengue: {n} registros (país x semana) cargados para Centroamérica")
    # resumen por país
    por_pais = {}
    for row in rows:
        por_pais[row["pais"]] = por_pais.get(row["pais"], 0) + 1
    for p, c in sorted(por_pais.items()):
        log("INFO", f"  {p}: {c} semanas")


def main():
    ap = argparse.ArgumentParser(description="CAIA-Hub: descarga dengue (OpenDengue) Centroamérica")
    ap.add_argument("--url", default=DEFAULT_CSV_URL, help="URL o file:// del CSV de OpenDengue")
    ap.add_argument("--test", action="store_true")
    args = ap.parse_args()

    sb = connect()
    log("OK", f"Conectado a {os.getenv('SUPABASE_CAIA_HUB_URL')}")
    if args.test:
        log("WARN", "MODO TEST: máx 200 registros de CA")

    url = args.url
    if url.startswith("file://"):
        # permitir CSV local descargado a mano
        path = url[7:]
        with open(path, "r") as f:
            data = f.read()
        # reusar fetch con contenido local
        import types
        global requests
        class _Fake:
            text = data
            def raise_for_status(self): pass
        _orig = requests.get
        requests.get = lambda *a, **k: _Fake()
        try:
            fetch_dengue(sb, url, args.test)
        finally:
            requests.get = _orig
    else:
        fetch_dengue(sb, url, args.test)

    log("OK", "Capa salud (dengue) completada")
    log("INFO", "Nota: mapeo país->zona_code y enf. por agua/hidrología en fases siguientes.")


if __name__ == "__main__":
    main()
