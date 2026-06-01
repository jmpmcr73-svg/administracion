#!/usr/bin/env python3
# CAIA-HUB: Descarga de clima agregado mensual (ERA5)
#
# Variables (tierra, por estado): temperatura media/min/max, precipitación, humedad
# Fuente: Copernicus Climate Data Store (CDS) - dataset ERA5 monthly means.
#
# Requisitos previos (UNA sola vez):
#   1. Tener cuenta en https://cds.climate.copernicus.eu y la API key en
#      ~/.env.caia-hub  ->  COPERNICUS_CDS_API_KEY  (y opcional COPERNICUS_CDS_URL)
#   2. Aceptar la licencia del dataset "ERA5 monthly averaged data on single levels"
#      en su página web (si no, la API devuelve 403).
#
# Uso:
#   python3 scripts/download_clima.py --test                      # 1 año, valida pipeline
#   python3 scripts/download_clima.py --start 2005 --end 2025     # rango completo
#   python3 scripts/download_clima.py --start 2024 --end 2024 --states CA,TX,FL
#
# NOTA: ERA5 usa una COLA en el servidor de Copernicus. Cada petición puede
# tardar de minutos a horas. El script descarga año por año y agrega por estado.

import os
import sys
import argparse
import subprocess
import tempfile
from datetime import datetime

# --- dependencias ---
def _ensure(pkg, import_name=None):
    try:
        __import__(import_name or pkg)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

for _p, _i in [("python-dotenv", "dotenv"), ("supabase", "supabase"),
               ("cdsapi", "cdsapi"), ("xarray", "xarray"),
               ("h5netcdf", "h5netcdf"), ("netCDF4", "netCDF4"), ("numpy", "numpy")]:
    _ensure(_p, _i)


def _resolve_nc(path):
    """El CDS nuevo a veces entrega un ZIP (con .nc dentro) aunque se pida
    netcdf. Detecta el tipo real y devuelve rutas NetCDF utilizables."""
    import zipfile, os as _os
    with open(path, "rb") as f:
        magic = f.read(4)
    if magic[:2] == b"PK":
        outdir = path + "_extracted"
        _os.makedirs(outdir, exist_ok=True)
        with zipfile.ZipFile(path) as z:
            ncs = [n for n in z.namelist() if n.endswith(".nc")]
            if not ncs:
                raise RuntimeError(f"ZIP del CDS sin .nc dentro: {z.namelist()}")
            z.extractall(outdir)
            return [_os.path.join(outdir, n) for n in ncs]
    return [path]


def _open_nc(path):
    """Abre NetCDF del CDS, manejando el caso ZIP y múltiples backends."""
    import xarray as _xr
    last = None
    for m in _resolve_nc(path):
        for eng in ("h5netcdf", "netcdf4", None):
            try:
                return _xr.open_dataset(m, engine=eng) if eng else _xr.open_dataset(m)
            except Exception as e:  # noqa
                last = e
    raise last

from dotenv import load_dotenv
from supabase import create_client
import cdsapi
import xarray as xr
import numpy as np

ENV_FILE = os.path.expanduser("~/.env.caia-hub")
ERA5_DATASET = "reanalysis-era5-single-levels-monthly-means"


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


def cds_client():
    """Crea el cliente CDS desde las credenciales del .env."""
    cds_url = os.getenv("COPERNICUS_CDS_URL", "https://cds.climate.copernicus.eu/api")
    cds_key = os.getenv("COPERNICUS_CDS_API_KEY")
    if not cds_key:
        log("ERR", "Falta COPERNICUS_CDS_API_KEY en ~/.env.caia-hub")
        sys.exit(1)
    return cdsapi.Client(url=cds_url, key=cds_key)


def get_states(sb, only=None):
    res = sb.table("clima_usa_states").select(
        "state_code,state_name,lon_min,lon_max,lat_min,lat_max").execute()
    states = res.data or []
    if only:
        wanted = {s.strip().upper() for s in only.split(",")}
        states = [s for s in states if s["state_code"] in wanted]
    return states


def upsert(sb, table, rows, on_conflict):
    for i in range(0, len(rows), 500):
        sb.table(table).upsert(rows[i:i+500], on_conflict=on_conflict).execute()


def download_year(cds, year, tmpdir):
    """Descarga un NetCDF de ERA5 monthly-means para todo el año (Norteamérica)."""
    target = os.path.join(tmpdir, f"era5_{year}.nc")
    if os.path.exists(target):
        return target
    log("INFO", f"  Solicitando ERA5 {year} a Copernicus (puede tardar, hay cola)...")
    cds.retrieve(
        ERA5_DATASET,
        {
            "product_type": "monthly_averaged_reanalysis",
            "variable": [
                "2m_temperature",
                "total_precipitation",
                "2m_dewpoint_temperature",
            ],
            "year": str(year),
            "month": [f"{m:02d}" for m in range(1, 13)],
            "time": "00:00",
            # Bounding box Norteamérica continental + Alaska/Hawaii: N, W, S, E
            "area": [72, -172, 18, -66],
            "grid": [0.25, 0.25],
            "data_format": "netcdf",
        },
        target,
    )
    return target


def dewpoint_to_rh(t2m_c, d2m_c):
    """Humedad relativa (%) a partir de temperatura y punto de rocío (Magnus)."""
    def es(t):
        return 6.112 * np.exp((17.67 * t) / (t + 243.5))
    rh = 100.0 * es(d2m_c) / es(t2m_c)
    return np.clip(rh, 0, 100)


def process_year(ds, year, states):
    """Agrega el NetCDF por estado y mes -> filas para clima_terrestre_mensual."""
    # Normaliza nombres de variables/coords (ERA5 puede usar t2m, tp, d2m)
    name = {v.lower(): v for v in ds.variables}
    t2m = ds[name.get("t2m", "t2m")]
    tp = ds[name.get("tp", "tp")]
    d2m = ds[name.get("d2m", "d2m")]
    lat_name = "latitude" if "latitude" in ds.coords else "lat"
    lon_name = "longitude" if "longitude" in ds.coords else "lon"
    time_name = "valid_time" if "valid_time" in ds.coords else "time"

    rows = []
    for st in states:
        # subconjunto espacial del estado (lat descendente en ERA5)
        sub_t = t2m.sel({lat_name: slice(st["lat_max"], st["lat_min"]),
                         lon_name: slice(st["lon_min"], st["lon_max"])})
        sub_p = tp.sel({lat_name: slice(st["lat_max"], st["lat_min"]),
                        lon_name: slice(st["lon_min"], st["lon_max"])})
        sub_d = d2m.sel({lat_name: slice(st["lat_max"], st["lat_min"]),
                         lon_name: slice(st["lon_min"], st["lon_max"])})
        if sub_t.sizes.get(lat_name, 0) == 0 or sub_t.sizes.get(lon_name, 0) == 0:
            continue
        times = ds[time_name].values
        for i, tval in enumerate(times):
            mes = int(str(tval)[5:7])
            t_c = float(sub_t.isel({time_name: i}).mean().values) - 273.15
            d_c = float(sub_d.isel({time_name: i}).mean().values) - 273.15
            # tp en m/día (monthly mean) -> mm/mes aprox (x1000 x días del mes)
            import calendar
            dias = calendar.monthrange(year, mes)[1]
            p_mm = float(sub_p.isel({time_name: i}).mean().values) * 1000.0 * dias
            rh = float(dewpoint_to_rh(t_c, d_c))
            rows.append({
                "state_code": st["state_code"],
                "anio": year,
                "mes": mes,
                "temp_media_c": round(t_c, 2),
                "temp_min_c": round(float(sub_t.isel({time_name: i}).min().values) - 273.15, 2),
                "temp_max_c": round(float(sub_t.isel({time_name: i}).max().values) - 273.15, 2),
                "precip_total_mm": round(p_mm, 2),
                "humedad_rel_pct": round(rh, 1),
                "fuente": "Copernicus ERA5",
                "updated_at": datetime.now().isoformat(),
            })
    return rows


def main():
    ap = argparse.ArgumentParser(description="CAIA-Hub: descarga de clima ERA5 mensual")
    ap.add_argument("--start", type=int, default=2005)
    ap.add_argument("--end", type=int, default=datetime.now().year - 1)
    ap.add_argument("--states", default=None, help="lista de códigos, ej. CA,TX,FL")
    ap.add_argument("--test", action="store_true", help="solo 1 año reciente y pocos estados")
    args = ap.parse_args()

    sb = connect()
    log("OK", f"Conectado a {os.getenv('SUPABASE_CAIA_HUB_URL')}")

    if args.test:
        args.start = args.end = datetime.now().year - 1
        if not args.states:
            args.states = "CA,TX,FL"
        log("WARN", f"MODO TEST: año {args.start}, estados {args.states}")

    states = get_states(sb, args.states)
    log("INFO", f"Estados a procesar: {len(states)}")

    cds = cds_client()
    with tempfile.TemporaryDirectory() as tmp:
        for year in range(args.start, args.end + 1):
            log("STEP", f"ERA5 {year}")
            try:
                nc = download_year(cds, year, tmp)
                ds = _open_nc(nc)
                rows = process_year(ds, year, states)
                ds.close()
                if rows:
                    upsert(sb, "clima_terrestre_mensual", rows, "state_code,anio,mes")
                    log("OK", f"  {year}: {len(rows)} filas (estado x mes) cargadas")
                else:
                    log("WARN", f"  {year}: sin datos agregados")
            except Exception as e:
                log("ERR", f"  {year} falló: {e}")
                if "403" in str(e) or "license" in str(e).lower():
                    log("WARN", "Acepta la licencia del dataset ERA5 en la web del CDS:")
                    log("WARN", f"https://cds.climate.copernicus.eu/datasets/{ERA5_DATASET}")
                    break

    log("OK", "Descarga de clima terrestre completada")
    log("INFO", "Nota: SST oceánico (clima_oceano_mensual) se añadirá en una fase aparte.")


if __name__ == "__main__":
    main()
