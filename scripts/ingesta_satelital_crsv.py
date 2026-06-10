#!/usr/bin/env python3
# CAIA-HUB / GEA: Ingesta satelital para Centroamérica (CR + SV + PA)
#
# Descarga y procesa fuentes satelitales gratuitas, calcula estadísticas
# zonales por país y las guarda en Supabase:
#   - public.sat_observaciones  (CAIA-Core; serie de valores zonales, proyecto='gea')
#   - public.sat_alertas        (CAIA-Core; anomalías significativas, proyecto='gea')
#
# Fuentes (todas gratuitas):
#   sentinel2  -> Sentinel-2 L2A   (Microsoft Planetary Computer STAC)  NDVI/NDWI/NBR
#   sentinel1  -> Sentinel-1 GRD   (Microsoft Planetary Computer STAC)  SAR VV/VH
#   tropomi    -> Sentinel-5P SO2  (Copernicus Data Space / PC STAC)    volcanes
#   modis      -> MODIS MOD11A2    (Microsoft Planetary Computer STAC)  LST (K)
#   gpm        -> GPM IMERG diario (NASA GES DISC)                      precipitación
#   enos       -> ONI Niño 3.4     (NOAA CPC, texto plano)              índice ENOS
#
# Cada fuente degrada con elegancia: si falta una dependencia, credencial o
# producto, se registra un WARN y se continúa con el resto (no aborta el lote).
#
# Uso:
#   python3 scripts/ingesta_satelital_crsv.py --fuentes sentinel2,gpm
#   python3 scripts/ingesta_satelital_crsv.py --fuentes tropomi
#   python3 scripts/ingesta_satelital_crsv.py --paises CR,SV --fuentes enos
#   python3 scripts/ingesta_satelital_crsv.py --test          # muestra mínima
#
# Dependencias:
#   pip install requests rasterio numpy scipy supabase python-dotenv \
#               pystac-client planetary-computer rio-cogeo shapely netCDF4
#
# Variables de entorno (.env en cwd o ~/.env.caia-hub):
#   SUPABASE_URL_CAIA / SUPABASE_KEY_CAIA          (CAIA-Core, destino por defecto)
#   SUPABASE_URL_IAGRI  / SUPABASE_KEY_IAGRI       (destino alterno --target iagri)
#   NASA_EARTHDATA_USER / NASA_EARTHDATA_PASS      (GPM IMERG, MODIS opcional)
#   NASA_EARTHDATA_TOKEN                           (alternativa a user/pass)
#   (compatibilidad: SUPABASE_CAIA_HUB_URL / SUPABASE_CAIA_HUB_SERVICE_ROLE_KEY)

import os
import sys
import json
import math
import argparse
import warnings
from datetime import datetime, date, timedelta, timezone

warnings.filterwarnings("ignore", category=RuntimeWarning)  # nanmean de slices vacíos

# --- carga perezosa de dependencias (se instalan si faltan) -----------------
import subprocess


def _ensure(pkg, mod=None):
    try:
        __import__(mod or pkg)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])


for _p, _m in [("python-dotenv", "dotenv"), ("supabase", "supabase"),
               ("requests", "requests"), ("numpy", "numpy")]:
    _ensure(_p, _m)

from dotenv import load_dotenv          # noqa: E402
from supabase import create_client      # noqa: E402
import requests                         # noqa: E402
import numpy as np                      # noqa: E402

# =============================================================================
# Configuración
# =============================================================================
ENV_FILES = [".env", os.path.expanduser("~/.env.caia-hub")]

PC_STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
# (el prompt cita sstoi.indices; oni.ascii.txt expone el ONI ya suavizado)

# BBox por país: [W, S, E, N]  (lon_min, lat_min, lon_max, lat_max)
PAISES = {
    "CR": [-85.95, 8.03, -82.55, 11.22],
    "SV": [-90.10, 13.15, -87.65, 14.45],
    "PA": [-83.05, 7.20, -77.17, 9.65],
}

# Volcanes activos -> bbox pequeño para columna de SO2 (TROPOMI)
VOLCANES = {
    "CR": {"Turrialba": [-83.77, 10.02, -83.73, 10.06],
           "Rincon_de_la_Vieja": [-85.33, 10.80, -85.29, 10.84]},
    "SV": {"Santa_Ana": [-89.64, 13.85, -89.60, 13.89]},
    "PA": {"Baru": [-82.55, 8.79, -82.51, 8.83]},
}

# Umbrales de anomalía -> alerta
UMBRAL = {
    "ndvi_bajo": -0.3,     # NDVI medio por debajo de esto = estrés vegetal severo
    "so2_du": 100.0,       # SO2 > 100 DU = desgasificación volcánica fuerte
    "precip_sigma": 2.0,   # precipitación > media + 2σ (sobre la ventana)
    "nbr_quemado": -0.1,   # NBR muy bajo = posible área quemada
}

# Colecciones MODIS LST en Planetary Computer (col. 6.1)
PC_MODIS = "modis-11A2-061"
PC_S2 = "sentinel-2-l2a"
PC_S1 = "sentinel-1-grd"
PC_S5P = "sentinel-5p-l2-netcdf"  # TROPOMI L2 (incluye SO2)

# Resolución de muestreo: leemos los COG decimados a esta malla (px) por eje.
# Suficiente para estadística zonal de país sin descargar el tile completo.
SAMPLE_PX = 512


def log(level, msg):
    icons = {"INFO": "ℹ️", "OK": "✅", "ERR": "❌", "WARN": "⚠️", "STEP": "🔹"}
    print(f"[{datetime.now():%H:%M:%S}] {icons.get(level, '▸')} {msg}", flush=True)


def _n(v):
    """NaN/inf -> None (JSON/Supabase no aceptan NaN)."""
    if v is None:
        return None
    try:
        return None if (math.isnan(v) or math.isinf(v)) else float(v)
    except (TypeError, ValueError):
        return v


def _round(v, nd=4):
    return None if v is None else round(v, nd)


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


# =============================================================================
# Supabase
# =============================================================================
def connect(target):
    for f in ENV_FILES:
        if os.path.exists(f):
            load_dotenv(f)
    if target == "iagri":
        url = os.getenv("SUPABASE_URL_IAGRI")
        key = os.getenv("SUPABASE_KEY_IAGRI") or os.getenv("SUPABASE_KEY_CAIA")
    else:  # caia-core (por defecto)
        url = os.getenv("SUPABASE_URL_CAIA") or os.getenv("SUPABASE_CAIA_HUB_URL")
        key = (os.getenv("SUPABASE_KEY_CAIA")
               or os.getenv("SUPABASE_CAIA_HUB_SERVICE_ROLE_KEY"))
    if not url or not key:
        log("ERR", f"Faltan credenciales Supabase para target='{target}' "
                   "(SUPABASE_URL_/KEY_ en .env o ~/.env.caia-hub)")
        sys.exit(1)
    log("OK", f"Conectado a {url} (public.sat_observaciones / sat_alertas)")
    return create_client(url, key)


def insert_observaciones(sb, rows):
    # destino: public.sat_observaciones (CAIA-Core)
    if not rows:
        return 0
    total = 0
    for i in range(0, len(rows), 500):
        sb.table("sat_observaciones").upsert(
            rows[i:i + 500],
            on_conflict="pais_id,fuente,variable,fecha_obs,producto_id",
        ).execute()
        total += len(rows[i:i + 500])
    return total


def insert_alertas(sb, rows):
    # destino: public.sat_alertas (CAIA-Core)
    if not rows:
        return 0
    sb.table("sat_alertas").insert(rows).execute()
    return len(rows)


def obs_row(pais, fuente, variable, stats, bbox, crs, fecha_obs,
            producto_id, meta):
    """Construye una fila de observación con la estadística zonal."""
    return {
        "proyecto": "gea",
        "pais_id": pais,
        "fuente": fuente,
        "variable": variable,
        "valor_mean": _round(_n(stats.get("mean"))),
        "valor_min": _round(_n(stats.get("min"))),
        "valor_max": _round(_n(stats.get("max"))),
        "valor_std": _round(_n(stats.get("std"))),
        "valor_p25": _round(_n(stats.get("p25"))),
        "valor_p75": _round(_n(stats.get("p75"))),
        "bbox": list(bbox),
        "crs": crs,
        "fecha_obs": fecha_obs,
        "fecha_ingesta": _now_iso(),
        "producto_id": producto_id,
        "metadata_json": _json_safe(meta),
    }


def alerta_row(pais, fuente, variable, severidad, valor, umbral, mensaje,
               bbox, fecha_obs, producto_id):
    return {
        "proyecto": "gea",
        "pais_id": pais,
        "fuente": fuente,
        "variable": variable,
        "severidad": severidad,
        "valor": _round(_n(valor)),
        "umbral": umbral,
        "mensaje": mensaje,
        "bbox": list(bbox),
        "fecha_obs": fecha_obs,
        "fecha_ingesta": _now_iso(),
        "producto_id": producto_id,
    }


def _json_safe(obj):
    """Limpia un dict de metadatos STAC para que sea JSON serializable."""
    try:
        return json.loads(json.dumps(obj, default=str))
    except (TypeError, ValueError):
        return {"_repr": str(obj)[:2000]}


# =============================================================================
# Estadística zonal
# =============================================================================
def zonal_stats(arr):
    """mean/min/max/std/p25/p75 ignorando NaN. Devuelve dict o None si vacío."""
    a = np.asarray(arr, dtype="float64").ravel()
    a = a[np.isfinite(a)]
    if a.size == 0:
        return None
    return {
        "mean": float(np.mean(a)),
        "min": float(np.min(a)),
        "max": float(np.max(a)),
        "std": float(np.std(a)),
        "p25": float(np.percentile(a, 25)),
        "p75": float(np.percentile(a, 75)),
    }


# =============================================================================
# STAC / lectura de COG decimado
# =============================================================================
def _pc_clients():
    """Devuelve (catalog, planetary_computer) o (None, None) si faltan deps."""
    try:
        import planetary_computer as pc
        from pystac_client import Client
    except ImportError:
        log("WARN", "Faltan pystac-client / planetary-computer; "
                    "pip install pystac-client planetary-computer")
        return None, None
    cat = Client.open(PC_STAC, modifier=pc.sign_inplace)
    return cat, pc


def read_cog_bbox(href, bbox, out_px=SAMPLE_PX):
    """Lee un COG (href firmado) recortado al bbox (lon/lat WGS84) y decimado
    a ~out_px en su eje mayor. Devuelve (array float32, perfil) o (None, None).

    No descarga el archivo completo: usa lectura por ventana sobre el COG
    remoto y los overviews para muestrear barato."""
    try:
        import rasterio
        from rasterio.warp import transform_bounds
        from rasterio.windows import from_bounds
    except ImportError:
        log("WARN", "Falta rasterio; pip install rasterio")
        return None, None
    try:
        with rasterio.open(href) as ds:
            dst_bounds = transform_bounds("EPSG:4326", ds.crs, *bbox, densify_pts=21)
            win = from_bounds(*dst_bounds, transform=ds.transform)
            win = win.round_offsets().round_lengths()
            if win.width <= 0 or win.height <= 0:
                return None, ds.crs.to_string()
            scale = max(win.width, win.height) / float(out_px)
            scale = max(scale, 1.0)
            oh = max(int(win.height / scale), 1)
            ow = max(int(win.width / scale), 1)
            data = ds.read(1, window=win, out_shape=(oh, ow),
                           boundless=True, fill_value=ds.nodata)
            arr = data.astype("float32")
            if ds.nodata is not None:
                arr[arr == ds.nodata] = np.nan
            return arr, ds.crs.to_string()
    except Exception as e:  # noqa - red, COG corrupto, etc.
        log("WARN", f"  lectura COG falló: {str(e)[:120]}")
        return None, None


# =============================================================================
# Fuente 1: Sentinel-2 L2A (NDVI, NDWI, NBR)
# =============================================================================
def fuente_sentinel2(sb, paises, dias=15, cloud=20, test=False):
    log("STEP", "Sentinel-2 L2A (NDVI/NDWI/NBR) via Planetary Computer")
    cat, _ = _pc_clients()
    if cat is None:
        return
    dt = f"{(date.today() - timedelta(days=dias)).isoformat()}/{date.today().isoformat()}"
    obs, alertas = [], []
    for pais in paises:
        bbox = PAISES[pais]
        search = cat.search(
            collections=[PC_S2], bbox=bbox, datetime=dt,
            query={"eo:cloud_cover": {"lt": cloud}},
            sortby=[{"field": "properties.eo:cloud_cover", "direction": "asc"}],
            max_items=3 if not test else 1,
        )
        items = list(search.items())
        if not items:
            log("WARN", f"  {pais}: sin escenas S2 < {cloud}% nubes en {dias}d")
            continue
        it = items[0]  # la menos nubosa
        pid = it.id
        fecha_obs = str(it.datetime.date()) if it.datetime else None
        meta = {"id": pid, **{k: v for k, v in it.properties.items()
                              if k in ("eo:cloud_cover", "datetime",
                                       "s2:mgrs_tile", "platform")}}
        bands = {}
        for name, asset in (("B03", "B03"), ("B04", "B04"),
                            ("B08", "B08"), ("B12", "B12")):
            if asset not in it.assets:
                continue
            arr, crs = read_cog_bbox(it.assets[asset].href, bbox)
            if arr is not None:
                bands[name] = arr
                meta["crs"] = crs
        crs = meta.get("crs", "EPSG:4326")
        # alinear formas (los assets S2 comparten 10/20m -> remuestreados a out_px)
        shapes = {b.shape for b in bands.values()}
        if len(shapes) > 1:
            tgt = min(bands.values(), key=lambda x: x.size).shape
            bands = {k: _resample_to(v, tgt) for k, v in bands.items()}

        def idx(a, b):
            num = bands[a] - bands[b]
            den = bands[a] + bands[b]
            with np.errstate(divide="ignore", invalid="ignore"):
                return np.where(den != 0, num / den, np.nan)

        indices = {}
        if "B08" in bands and "B04" in bands:
            indices["ndvi"] = idx("B08", "B04")
        if "B03" in bands and "B08" in bands:
            indices["ndwi"] = idx("B03", "B08")
        if "B08" in bands and "B12" in bands:
            indices["nbr"] = idx("B08", "B12")

        for var, grid in indices.items():
            st = zonal_stats(grid)
            if not st:
                continue
            obs.append(obs_row(pais, "sentinel2", var, st, bbox, crs,
                               fecha_obs, pid, meta))
            log("INFO", f"  {pais} {var}: mean={st['mean']:.3f} "
                        f"[{st['min']:.2f},{st['max']:.2f}]")
            if var == "ndvi" and st["mean"] < UMBRAL["ndvi_bajo"]:
                alertas.append(alerta_row(
                    pais, "sentinel2", "ndvi", "alta", st["mean"],
                    UMBRAL["ndvi_bajo"],
                    f"NDVI medio {st['mean']:.2f} indica estrés vegetal severo",
                    bbox, fecha_obs, pid))
            if var == "nbr" and st["mean"] < UMBRAL["nbr_quemado"]:
                alertas.append(alerta_row(
                    pais, "sentinel2", "nbr", "media", st["mean"],
                    UMBRAL["nbr_quemado"],
                    f"NBR medio {st['mean']:.2f}: posible área quemada",
                    bbox, fecha_obs, pid))
    _persist(sb, obs, alertas)


def _resample_to(arr, shape):
    """Remuestreo nearest sencillo (sin scipy) a una forma destino."""
    h, w = shape
    yi = (np.linspace(0, arr.shape[0] - 1, h)).astype(int)
    xi = (np.linspace(0, arr.shape[1] - 1, w)).astype(int)
    return arr[np.ix_(yi, xi)]


# =============================================================================
# Fuente 2: Sentinel-1 GRD (SAR VV/VH)
# =============================================================================
def fuente_sentinel1(sb, paises, dias=12, test=False):
    log("STEP", "Sentinel-1 GRD (SAR VV/VH) via Planetary Computer")
    cat, _ = _pc_clients()
    if cat is None:
        return
    dt = f"{(date.today() - timedelta(days=dias)).isoformat()}/{date.today().isoformat()}"
    obs = []
    for pais in paises:
        bbox = PAISES[pais]
        search = cat.search(
            collections=[PC_S1], bbox=bbox, datetime=dt,
            query={"sar:instrument_mode": {"eq": "IW"}},
            max_items=2 if not test else 1,
        )
        items = list(search.items())
        if not items:
            log("WARN", f"  {pais}: sin escenas S1 IW en {dias}d")
            continue
        it = items[0]
        pid, fecha_obs = it.id, (str(it.datetime.date()) if it.datetime else None)
        meta = {"id": pid, "mode": it.properties.get("sar:instrument_mode"),
                "orbit": it.properties.get("sat:orbit_state")}
        for pol, var in (("vv", "sar_vv"), ("vh", "sar_vh")):
            if pol not in it.assets:
                continue
            arr, crs = read_cog_bbox(it.assets[pol].href, bbox)
            if arr is None:
                continue
            # backscatter lineal -> dB (10*log10), evitando log(0)
            with np.errstate(divide="ignore", invalid="ignore"):
                db = 10.0 * np.log10(np.where(arr > 0, arr, np.nan))
            st = zonal_stats(db)
            if st:
                obs.append(obs_row(pais, "sentinel1", var, st, bbox, crs,
                                   fecha_obs, pid, meta))
                log("INFO", f"  {pais} {var}: mean={st['mean']:.1f} dB")
    _persist(sb, obs, [])


# =============================================================================
# Fuente 3: TROPOMI SO2 (volcanes)
# =============================================================================
def fuente_tropomi(sb, paises, dias=3, test=False):
    log("STEP", "TROPOMI / Sentinel-5P SO2 (volcanes) via Planetary Computer")
    cat, _ = _pc_clients()
    if cat is None:
        return
    try:
        import netCDF4  # noqa
    except ImportError:
        log("WARN", "Falta netCDF4 (S5P es NetCDF); pip install netCDF4 — se omite TROPOMI")
        return
    dt = f"{(date.today() - timedelta(days=dias)).isoformat()}/{date.today().isoformat()}"
    obs, alertas = [], []
    for pais in paises:
        for volcan, bbox in VOLCANES.get(pais, {}).items():
            search = cat.search(
                collections=[PC_S5P], bbox=bbox, datetime=dt,
                query={"s5p:processing_mode": {"eq": "OFFL"}},
                max_items=1,
            )
            items = list(search.items())
            if not items:
                log("WARN", f"  {pais}/{volcan}: sin paso S5P SO2 en {dias}d")
                continue
            it = items[0]
            asset = (it.assets.get("so2") or it.assets.get("data")
                     or next(iter(it.assets.values()), None))
            if asset is None:
                continue
            du = _read_s5p_so2(asset.href, bbox)
            if du is None:
                continue
            st = zonal_stats(du)
            if not st:
                continue
            pid = it.id
            fecha_obs = str(it.datetime.date()) if it.datetime else None
            meta = {"id": pid, "volcan": volcan,
                    "mode": it.properties.get("s5p:processing_mode")}
            obs.append(obs_row(pais, "tropomi", "so2_du", st, bbox,
                               "EPSG:4326", fecha_obs, pid, meta))
            log("INFO", f"  {pais}/{volcan} SO2: mean={st['mean']:.1f} DU "
                        f"max={st['max']:.1f} DU")
            if st["max"] > UMBRAL["so2_du"]:
                alertas.append(alerta_row(
                    pais, "tropomi", "so2_du", "critica", st["max"],
                    UMBRAL["so2_du"],
                    f"SO2 {st['max']:.0f} DU sobre {volcan}: desgasificación fuerte",
                    bbox, fecha_obs, pid))
    _persist(sb, obs, alertas)


def _read_s5p_so2(href, bbox):
    """Lee la columna troposférica de SO2 de un producto S5P L2 y la convierte
    a Dobson Units recortando al bbox. Devuelve array o None."""
    try:
        import netCDF4
        import tempfile
        # descarga el NetCDF a temporal (S5P no es COG; no hay lectura parcial)
        local = os.path.join(tempfile.gettempdir(), os.path.basename(href.split("?")[0]))
        if not os.path.exists(local):
            with requests.get(href, stream=True, timeout=300) as r:
                r.raise_for_status()
                with open(local, "wb") as fh:
                    for chunk in r.iter_content(1 << 20):
                        fh.write(chunk)
        ds = netCDF4.Dataset(local)
        grp = ds.groups["PRODUCT"]
        so2 = grp.variables["sulfurdioxide_total_vertical_column"][:]  # mol/m²
        lat = grp.variables["latitude"][:]
        lon = grp.variables["longitude"][:]
        so2 = np.ma.filled(np.squeeze(so2), np.nan)
        lat = np.squeeze(lat)
        lon = np.squeeze(lon)
        w, s, e, n = bbox
        mask = (lon >= w) & (lon <= e) & (lat >= s) & (lat <= n)
        vals = so2[mask]
        ds.close()
        # mol/m² -> DU : 1 DU = 0.4462 mmol/m² => DU = col(mol/m²) / 4.462e-4
        return vals / 4.462e-4
    except Exception as e:  # noqa
        log("WARN", f"  lectura S5P SO2 falló: {str(e)[:120]}")
        return None


# =============================================================================
# Fuente 4: MODIS LST (MOD11A2, temperatura superficie)
# =============================================================================
def fuente_modis(sb, paises, dias=16, test=False):
    log("STEP", "MODIS MOD11A2 LST (temperatura superficie) via Planetary Computer")
    cat, _ = _pc_clients()
    if cat is None:
        return
    dt = f"{(date.today() - timedelta(days=dias)).isoformat()}/{date.today().isoformat()}"
    obs = []
    for pais in paises:
        bbox = PAISES[pais]
        search = cat.search(collections=[PC_MODIS], bbox=bbox, datetime=dt,
                            max_items=1)
        items = list(search.items())
        if not items:
            log("WARN", f"  {pais}: sin compuesto MOD11A2 en {dias}d")
            continue
        it = items[0]
        asset = it.assets.get("LST_Day_1km") or it.assets.get("LST_Day")
        if asset is None:
            log("WARN", f"  {pais}: MOD11A2 sin asset LST_Day_1km")
            continue
        arr, crs = read_cog_bbox(asset.href, bbox)
        if arr is None:
            continue
        # MOD11A2 LST_Day_1km: escala 0.02, en Kelvin; 0 = relleno
        kelvin = np.where(arr > 0, arr * 0.02, np.nan)
        st = zonal_stats(kelvin)
        if not st:
            continue
        pid = it.id
        fecha_obs = str(it.datetime.date()) if it.datetime else None
        meta = {"id": pid, "producto": "MOD11A2", "escala": 0.02}
        obs.append(obs_row(pais, "modis", "lst_k", st, bbox, crs or "MODIS Sinusoidal",
                           fecha_obs, pid, meta))
        log("INFO", f"  {pais} LST: mean={st['mean']:.1f} K "
                    f"({st['mean'] - 273.15:.1f} °C)")
    _persist(sb, obs, [])


# =============================================================================
# Fuente 5: GPM IMERG (precipitación)
# =============================================================================
def fuente_gpm(sb, paises, dias=30, test=False):
    log("STEP", "GPM IMERG diario (precipitación) via NASA GES DISC")
    user = os.getenv("NASA_EARTHDATA_USER")
    pwd = os.getenv("NASA_EARTHDATA_PASS")
    token = os.getenv("NASA_EARTHDATA_TOKEN")
    if not ((user and pwd) or token):
        log("WARN", "Faltan credenciales NASA Earthdata (NASA_EARTHDATA_USER/PASS "
                    "o NASA_EARTHDATA_TOKEN) — se omite GPM")
        return
    try:
        import netCDF4  # noqa
    except ImportError:
        log("WARN", "Falta netCDF4 — se omite GPM")
        return
    obs, alertas = [], []
    # GES DISC OPeNDAP del producto final diario GPM_3IMERGDF v07
    base = ("https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/"
            "GPM_3IMERGDF.07")
    sess = requests.Session()
    if token:
        sess.headers["Authorization"] = f"Bearer {token}"
    elif user and pwd:
        sess.auth = (user, pwd)
    fin = date.today() - timedelta(days=1)
    ini = fin - timedelta(days=(1 if test else dias))
    for pais in paises:
        bbox = PAISES[pais]
        serie = []  # mm/día medios sobre el país
        last_pid = None
        d = ini
        while d <= fin:
            url = (f"{base}/{d:%Y}/{d:%m}/3B-DAY.MS.MRG.3IMERG."
                   f"{d:%Y%m%d}-S000000-E235959.V07B.nc4")
            mm = _read_imerg_day(sess, url, bbox)
            if mm is not None:
                serie.append(mm)
                last_pid = os.path.basename(url)
            d += timedelta(days=1)
        if not serie:
            log("WARN", f"  {pais}: sin datos IMERG en la ventana")
            continue
        serie = np.array(serie, dtype="float64")
        st = {"mean": float(serie.mean()), "min": float(serie.min()),
              "max": float(serie.max()), "std": float(serie.std()),
              "p25": float(np.percentile(serie, 25)),
              "p75": float(np.percentile(serie, 75))}
        fecha_obs = fin.isoformat()
        meta = {"ventana_dias": len(serie), "producto": "GPM_3IMERGDF.07"}
        obs.append(obs_row(pais, "gpm", "precip_mm", st, bbox, "EPSG:4326",
                           fecha_obs, last_pid, meta))
        log("INFO", f"  {pais} precip: media={st['mean']:.1f} mm/d "
                    f"máx diario={st['max']:.1f} mm")
        # anomalía: algún día por encima de media + 2σ
        umbral = st["mean"] + UMBRAL["precip_sigma"] * st["std"]
        if st["std"] > 0 and st["max"] > umbral:
            alertas.append(alerta_row(
                pais, "gpm", "precip_mm", "alta", st["max"], _round(umbral),
                f"Pico de lluvia {st['max']:.0f} mm/d > media+2σ ({umbral:.0f} mm)",
                bbox, fecha_obs, last_pid))
    _persist(sb, obs, alertas)


def _read_imerg_day(sess, url, bbox):
    """Lee precipitación diaria IMERG (mm) media sobre bbox vía OPeNDAP/NetCDF."""
    try:
        import netCDF4
        import tempfile
        local = os.path.join(tempfile.gettempdir(), os.path.basename(url))
        if not os.path.exists(local):
            r = sess.get(url, timeout=300, allow_redirects=True)
            if r.status_code != 200:
                return None
            with open(local, "wb") as fh:
                fh.write(r.content)
        ds = netCDF4.Dataset(local)
        # IMERG v07: variable 'precipitation' (mm/día en el producto DAY), lon/lat
        var = "precipitation" if "precipitation" in ds.variables else "precipitationCal"
        pr = np.ma.filled(np.squeeze(ds.variables[var][:]).astype("float64"), np.nan)
        lon = ds.variables["lon"][:]
        lat = ds.variables["lat"][:]
        ds.close()
        w, s, e, n = bbox
        ix = np.where((lon >= w) & (lon <= e))[0]
        iy = np.where((lat >= s) & (lat <= n))[0]
        if ix.size == 0 or iy.size == 0:
            return None
        # IMERG suele venir [lon, lat]; ajustamos por orientación
        if pr.shape[0] == lon.size:
            sub = pr[np.ix_(ix, iy)]
        else:
            sub = pr[np.ix_(iy, ix)]
        sub = sub[np.isfinite(sub) & (sub >= 0)]
        return float(sub.mean()) if sub.size else None
    except Exception as e:  # noqa
        log("WARN", f"  lectura IMERG falló: {str(e)[:120]}")
        return None


# =============================================================================
# Fuente 6: ENOS / ONI (Niño 3.4)
# =============================================================================
SEASON_CENTER = {
    "DJF": 1, "JFM": 2, "FMA": 3, "MAM": 4, "AMJ": 5, "MJJ": 6,
    "JJA": 7, "JAS": 8, "ASO": 9, "SON": 10, "OND": 11, "NDJ": 12,
}


def fuente_enos(sb, paises, test=False):
    log("STEP", "ENOS / ONI Niño 3.4 (NOAA CPC)")
    try:
        r = requests.get(ONI_URL, timeout=60)
        r.raise_for_status()
    except requests.RequestException as e:
        log("WARN", f"  ONI no disponible: {str(e)[:120]}")
        return
    last = None
    for line in r.text.splitlines()[1:]:
        parts = line.split()
        if len(parts) != 4:
            continue
        seas, yr, total, anom = parts
        try:
            last = (seas, int(yr), float(anom))
        except ValueError:
            continue
    if not last:
        log("WARN", "  no se pudo parsear ONI")
        return
    seas, yr, oni = last
    mes = SEASON_CENTER.get(seas, 6)
    fecha_obs = date(yr, mes, 15).isoformat()
    fase = "El Nino" if oni >= 0.5 else "La Nina" if oni <= -0.5 else "Neutro"
    meta = {"periodo": seas, "anio": yr, "fase": fase, "fuente": "NOAA CPC ONI"}
    pid = f"ONI-{yr}-{seas}"
    st = {"mean": oni, "min": oni, "max": oni, "std": 0.0, "p25": oni, "p75": oni}
    obs = []
    for pais in paises:  # ONI es global; se replica por país para consistencia
        obs.append(obs_row(pais, "enos", "oni", st, PAISES[pais], "global",
                           fecha_obs, pid, meta))
    log("INFO", f"  ONI {seas} {yr} = {oni:+.1f} ({fase})")
    _persist(sb, obs, [])


# =============================================================================
# Persistencia + orquestación
# =============================================================================
def _persist(sb, obs, alertas):
    try:
        n = insert_observaciones(sb, obs)
        if n:
            log("OK", f"  {n} observaciones guardadas en public.sat_observaciones")
    except Exception as e:  # noqa
        log("ERR", f"  fallo al guardar observaciones: {str(e)[:160]}")
    try:
        m = insert_alertas(sb, alertas)
        if m:
            log("WARN", f"  {m} ALERTAS insertadas en public.sat_alertas")
    except Exception as e:  # noqa
        log("ERR", f"  fallo al guardar alertas: {str(e)[:160]}")


FUENTES = {
    "sentinel2": fuente_sentinel2,
    "sentinel1": fuente_sentinel1,
    "tropomi": fuente_tropomi,
    "modis": fuente_modis,
    "gpm": fuente_gpm,
    "enos": fuente_enos,
}


def main():
    ap = argparse.ArgumentParser(
        description="Ingesta satelital CR+SV+PA -> Supabase public.sat_* (CAIA-Core)")
    ap.add_argument("--fuentes", default="all",
                    help="lista separada por comas: " + ",".join(FUENTES) + " | all")
    ap.add_argument("--paises", default="CR,SV,PA",
                    help="lista separada por comas (CR,SV,PA)")
    ap.add_argument("--target", default="caia", choices=["caia", "iagri"],
                    help="proyecto Supabase destino (por defecto caia / CAIA-Core)")
    ap.add_argument("--test", action="store_true",
                    help="muestra mínima por fuente para validar")
    args = ap.parse_args()

    fuentes = list(FUENTES) if args.fuentes == "all" else [
        f.strip() for f in args.fuentes.split(",") if f.strip() in FUENTES]
    paises = [p.strip().upper() for p in args.paises.split(",")
              if p.strip().upper() in PAISES]
    if not fuentes:
        log("ERR", f"Fuentes inválidas. Opciones: {', '.join(FUENTES)}")
        sys.exit(1)
    if not paises:
        log("ERR", "Países inválidos. Opciones: CR, SV, PA")
        sys.exit(1)

    sb = connect(args.target)
    if args.test:
        log("WARN", "MODO TEST: muestra mínima por fuente")
    log("INFO", f"Fuentes: {', '.join(fuentes)} | Países: {', '.join(paises)}")

    for f in fuentes:
        try:
            fn = FUENTES[f]
            if f == "enos":
                fn(sb, paises, test=args.test)
            else:
                fn(sb, paises, test=args.test)
        except Exception as e:  # noqa - una fuente no debe tumbar el resto
            log("ERR", f"Fuente {f} falló: {str(e)[:160]}")

    log("OK", "Ingesta satelital completada")


if __name__ == "__main__":
    main()
