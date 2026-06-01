#!/usr/bin/env python3
# CAIA-HUB: Clima mensual agregado por ZONA AGROCLIMÁTICA de Centroamérica (ERA5)
#
# Descarga temperatura, precipitación y humedad mensuales de ERA5, las agrega
# por cada zona de clima_ca_zonas y las cruza con la fase ENSO del mes.
# Resultado -> clima_ca_mensual  (base del pronóstico estacional ENSO->clima).
#
# Requisitos: igual que download_clima.py (cuenta CDS + licencia ERA5 aceptada).
#
# Uso:
#   python3 scripts/download_clima_centroamerica.py --test            # 1 año
#   python3 scripts/download_clima_centroamerica.py --start 2005 --end 2025
#   python3 scripts/download_clima_centroamerica.py --zonas SV-PAC,SV-CEN

import os
import sys
import calendar
import argparse
import subprocess
import tempfile
from datetime import datetime


def _ensure(pkg, mod=None):
    try:
        __import__(mod or pkg)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])


for _p, _m in [("python-dotenv", "dotenv"), ("supabase", "supabase"),
               ("cdsapi", "cdsapi"), ("xarray", "xarray"),
               ("h5netcdf", "h5netcdf"), ("netCDF4", "netCDF4"), ("numpy", "numpy")]:
    _ensure(_p, _m)


def _resolve_nc(path):
    """El CDS nuevo a veces entrega un ZIP (con .nc dentro) aunque se pida
    netcdf. Detecta el tipo real por los magic bytes y devuelve la ruta de un
    NetCDF utilizable (extrayéndolo si hace falta)."""
    import zipfile, os as _os
    with open(path, "rb") as f:
        magic = f.read(4)
    # ZIP -> 'PK\x03\x04'
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


def _open_one(m):
    import xarray as _xr
    last = None
    for eng in ("h5netcdf", "netcdf4", None):
        try:
            return _xr.open_dataset(m, engine=eng) if eng else _xr.open_dataset(m)
        except Exception as e:  # noqa
            last = e
    raise last


def _open_nc(path):
    """Abre NetCDF(s) del CDS. El ZIP del CDS nuevo suele separar variables
    instantáneas (t2m, d2m) y acumuladas (tp) en .nc distintos; los combinamos."""
    import xarray as _xr
    members = _resolve_nc(path)
    if len(members) == 1:
        return _open_one(members[0])
    datasets = []
    for m in members:
        try:
            datasets.append(_open_one(m))
        except Exception:  # noqa
            pass
    if not datasets:
        raise RuntimeError("No se pudo abrir ningún .nc del ZIP del CDS")
    # merge por variables (mismas coords lat/lon/time)
    try:
        return _xr.merge(datasets, compat="override", join="outer")
    except Exception:  # noqa
        # si el merge falla, devolver el que tenga más variables
        return max(datasets, key=lambda d: len(d.data_vars))

from dotenv import load_dotenv
from supabase import create_client
import cdsapi
import xarray as xr
import numpy as np

import math
import warnings
warnings.filterwarnings("ignore", category=RuntimeWarning)  # nanmean de slices vacíos


def _n(v):
    """NaN/inf -> None (JSON no acepta NaN; Supabase lo rechaza)."""
    if v is None:
        return None
    try:
        return None if (math.isnan(v) or math.isinf(v)) else v
    except TypeError:
        return v


def _round(v, nd=2):
    return None if v is None else round(v, nd)


ENV_FILE = os.path.expanduser("~/.env.caia-hub")
ERA5_DATASET = "reanalysis-era5-single-levels-monthly-means"
# Bounding box Centroamérica completa: N, W, S, E
CA_AREA = [18.5, -92.5, 7.0, -77.0]
# Mapeo trimestre ONI -> mes central (para cruzar fase ENSO con cada mes)
SEASON_FOR_MONTH = {  # mes -> periodo ONI cuyo centro es ese mes
    1: "DJF", 2: "JFM", 3: "FMA", 4: "MAM", 5: "AMJ", 6: "MJJ",
    7: "JJA", 8: "JAS", 9: "ASO", 10: "SON", 11: "OND", 12: "NDJ",
}


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
    cds_url = os.getenv("COPERNICUS_CDS_URL", "https://cds.climate.copernicus.eu/api")
    cds_key = os.getenv("COPERNICUS_CDS_API_KEY")
    if not cds_key:
        log("ERR", "Falta COPERNICUS_CDS_API_KEY en ~/.env.caia-hub")
        sys.exit(1)
    return cdsapi.Client(url=cds_url, key=cds_key)


def get_zonas(sb, only=None):
    res = sb.table("clima_ca_zonas").select(
        "zona_code,zona_name,lon_min,lon_max,lat_min,lat_max").execute()
    zonas = res.data or []
    if only:
        wanted = {z.strip().upper() for z in only.split(",")}
        zonas = [z for z in zonas if z["zona_code"] in wanted]
    return zonas


def load_enso(sb):
    """Devuelve dict {(anio, periodo): (fase, oni)} para cruzar con cada mes."""
    res = sb.table("clima_enso_fases").select("anio,periodo,fase,oni_valor").execute()
    return {(r["anio"], r["periodo"]): (r["fase"], r["oni_valor"]) for r in (res.data or [])}


def enso_for(enso, anio, mes):
    periodo = SEASON_FOR_MONTH[mes]
    return enso.get((anio, periodo), (None, None))


def upsert(sb, table, rows, on_conflict):
    # dedup intra-lote por la clave de conflicto (evita error 21000)
    keys = [k.strip() for k in on_conflict.split(",")]
    seen = {}
    for r in rows:
        seen[tuple(r.get(k) for k in keys)] = r
    rows = list(seen.values())
    for i in range(0, len(rows), 500):
        sb.table(table).upsert(rows[i:i+500], on_conflict=on_conflict).execute()


def _retrieve(cds, year, variables, target):
    cds.retrieve(
        ERA5_DATASET,
        {
            "product_type": "monthly_averaged_reanalysis",
            "variable": variables,
            "year": str(year),
            "month": [f"{m:02d}" for m in range(1, 13)],
            "time": "00:00",
            "area": CA_AREA,
            "grid": [0.25, 0.25],
            "data_format": "netcdf",
        },
        target,
    )


def download_year(cds, year, tmpdir):
    """Descarga en DOS peticiones separadas (instantáneas vs. acumulada) para
    garantizar que la precipitación venga, y devuelve un dataset combinado."""
    log("INFO", f"  Solicitando ERA5 {year} (Centroamérica) a Copernicus (puede haber cola)...")
    f_inst = os.path.join(tmpdir, f"era5_ca_{year}_inst.nc")
    f_prec = os.path.join(tmpdir, f"era5_ca_{year}_prec.nc")
    if not os.path.exists(f_inst):
        _retrieve(cds, year, ["2m_temperature", "2m_dewpoint_temperature"], f_inst)
    ds_inst = _open_nc(f_inst)
    try:
        if not os.path.exists(f_prec):
            _retrieve(cds, year, ["total_precipitation"], f_prec)
        ds_prec = _open_nc(f_prec)
        ds = xr.merge([ds_inst, ds_prec], compat="override", join="outer")
        log("INFO", f"  variables disponibles: {list(ds.data_vars)}")
        return ds
    except Exception as e:  # noqa
        log("WARN", f"  precipitación {year} no disponible ({str(e)[:60]}); sigo sin lluvia")
        return ds_inst


def dewpoint_to_rh(t_c, d_c):
    def es(t):
        return 6.112 * np.exp((17.67 * t) / (t + 243.5))
    return float(np.clip(100.0 * es(d_c) / es(t_c), 0, 100))


def process_year(ds, year, zonas, enso):
    name = {v.lower(): v for v in ds.variables}
    t2m = ds[name.get("t2m", "t2m")]
    d2m = ds[name.get("d2m", "d2m")]
    tp = ds[name["tp"]] if "tp" in name else None  # precipitación opcional
    if tp is None:
        log("WARN", "  Sin variable 'tp' (precipitación) en este archivo; se cargará null")
    lat_n = "latitude" if "latitude" in ds.coords else "lat"
    lon_n = "longitude" if "longitude" in ds.coords else "lon"
    time_n = "valid_time" if "valid_time" in ds.coords else "time"
    times = ds[time_n].values

    rows = []
    for z in zonas:
        sl = {lat_n: slice(z["lat_max"], z["lat_min"]), lon_n: slice(z["lon_min"], z["lon_max"])}
        st, sd = t2m.sel(sl), d2m.sel(sl)
        sp = tp.sel(sl) if tp is not None else None
        if st.sizes.get(lat_n, 0) == 0 or st.sizes.get(lon_n, 0) == 0:
            log("WARN", f"  zona {z['zona_code']} sin celdas ERA5 (bbox pequeño)")
            continue
        for i, tval in enumerate(times):
            mes = int(str(tval)[5:7])
            # nanmean/min/max ignoran celdas NaN (p.ej. mar); _n() limpia el resto
            t_c = _n(float(np.nanmean(st.isel({time_n: i}).values)) - 273.15)
            d_c = _n(float(np.nanmean(sd.isel({time_n: i}).values)) - 273.15)
            dias = calendar.monthrange(year, mes)[1]
            if sp is not None:
                p_mm = _n(float(np.nanmean(sp.isel({time_n: i}).values)) * 1000.0 * dias)
            else:
                p_mm = None
            # si la zona no tiene celdas terrestres (todo NaN), saltar el mes
            if t_c is None:
                continue
            rh = _n(dewpoint_to_rh(t_c, d_c)) if (t_c is not None and d_c is not None) else None
            fase, oni = enso_for(enso, year, mes)
            rows.append({
                "zona_code": z["zona_code"],
                "anio": year, "mes": mes,
                "temp_media_c": _round(t_c),
                "temp_min_c": _round(_n(float(np.nanmin(st.isel({time_n: i}).values)) - 273.15)),
                "temp_max_c": _round(_n(float(np.nanmax(st.isel({time_n: i}).values)) - 273.15)),
                "precip_total_mm": _round(p_mm),
                "humedad_rel_pct": _round(rh, 1),
                "enso_fase": fase, "enso_oni": oni,
                "fuente": "Copernicus ERA5",
                "updated_at": datetime.now().isoformat(),
            })
    return rows


def main():
    ap = argparse.ArgumentParser(description="CAIA-Hub: clima ERA5 mensual por zona de Centroamérica")
    ap.add_argument("--start", type=int, default=2005)
    ap.add_argument("--end", type=int, default=datetime.now().year - 1)
    ap.add_argument("--zonas", default=None, help="lista de zona_code, ej. SV-PAC,GT-ALT")
    ap.add_argument("--test", action="store_true")
    args = ap.parse_args()

    sb = connect()
    log("OK", f"Conectado a {os.getenv('SUPABASE_CAIA_HUB_URL')}")
    if args.test:
        args.start = args.end = datetime.now().year - 1
        log("WARN", f"MODO TEST: año {args.start}, todas las zonas CA")

    zonas = get_zonas(sb, args.zonas)
    enso = load_enso(sb)
    log("INFO", f"Zonas: {len(zonas)} | ENSO periodos en memoria: {len(enso)}")

    cds = cds_client()
    with tempfile.TemporaryDirectory() as tmp:
        for year in range(args.start, args.end + 1):
            log("STEP", f"ERA5 Centroamérica {year}")
            try:
                ds = download_year(cds, year, tmp)
                rows = process_year(ds, year, zonas, enso)
                ds.close()
                if rows:
                    upsert(sb, "clima_ca_mensual", rows, "zona_code,anio,mes")
                    log("OK", f"  {year}: {len(rows)} filas (zona x mes) cargadas")
            except Exception as e:
                log("ERR", f"  {year} falló: {e}")
                if "403" in str(e) or "licen" in str(e).lower():
                    log("WARN", f"Acepta la licencia ERA5: https://cds.climate.copernicus.eu/datasets/{ERA5_DATASET}")
                    break

    log("OK", "Clima de Centroamérica completado")


if __name__ == "__main__":
    main()
