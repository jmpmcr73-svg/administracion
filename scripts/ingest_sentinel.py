#!/usr/bin/env python3
"""
DaVinci Hídrico — ingesta Sentinel-2 (NDTI) + reglas de alerta para fuentes.

Pipeline:
  1. Lee las fuentes desde public.davinci_v_fuentes (lat/lng) vía PostgREST.
  2. Construye un AOI (bbox) alrededor de cada fuente.
  3. Consulta el STAC abierto de Element84 (colección sentinel-2-l2a) por la
     escena más reciente con eo:cloud_cover < 30 sobre el AOI.
  4. Lee B03 (verde), B04 (rojo) y SCL con rasterio (ventana sobre el bbox),
     calcula NDTI = (B04 - B03) / (B04 + B03) y promedia sobre píxeles de agua
     (SCL == 6). Si no hay agua clasificada, usa el agregado del AOI.
  5. Inserta en davinci_fuentes.obs_satelital vía RPC public.davinci_obs_insert.
  6. Cruza con clima (lluvia/SPI) y mediciones (turbidez/CE) y genera alertas
     vía RPC public.davinci_alerta_insert.

Variables de entorno (NUNCA hardcodear):
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Notas:
  - En entornos detrás de proxy con MITM SSL: export GDAL_HTTP_UNSAFESSL=YES
    En local / Vercel normal NO hace falta.
  - Vercel functions no pueden correr rasterio/GDAL; programá este script con
    GitHub Actions / cron de servidor. La route /api/cron/fuentes aplica las
    reglas de alerta sobre lo que este script deja en obs_satelital.

Dependencias: ver scripts/requirements.txt
"""

import os
import sys
import datetime as dt
from typing import Any, Optional

import requests

try:
    import numpy as np
    import rasterio
    from rasterio.windows import from_bounds
    from rasterio.warp import transform_bounds
    HAS_RASTER = True
except Exception:  # rasterio opcional: sin él, solo corren las reglas de alerta
    HAS_RASTER = False

STAC_SEARCH = "https://earth-search.aws.element84.com/v1/search"
COLLECTION = "sentinel-2-l2a"
AOI_BUFFER_DEG = 0.01        # ~1.1 km alrededor de la fuente
MAX_CLOUD = 30               # eo:cloud_cover <
WATER_SCL = 6                # clase "water" en la banda SCL de Sentinel-2

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_ROLE = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


# --------------------------------------------------------------------------- #
# PostgREST helpers (service role, solo servidor)
# --------------------------------------------------------------------------- #
def _headers() -> dict:
    if not SUPABASE_URL or not SERVICE_ROLE:
        sys.exit("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.")
    return {
        "apikey": SERVICE_ROLE,
        "Authorization": f"Bearer {SERVICE_ROLE}",
        "Content-Type": "application/json",
    }


def sb_get(view: str, select: str = "*", params: Optional[dict] = None) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{view}"
    p = {"select": select}
    if params:
        p.update(params)
    r = requests.get(url, headers=_headers(), params=p, timeout=60)
    r.raise_for_status()
    return r.json()


def sb_rpc(fn: str, payload: dict) -> Any:
    url = f"{SUPABASE_URL}/rest/v1/rpc/{fn}"
    r = requests.post(url, headers=_headers(), json=payload, timeout=60)
    r.raise_for_status()
    return r.json() if r.text else None


# --------------------------------------------------------------------------- #
# STAC + raster
# --------------------------------------------------------------------------- #
def buscar_escena(bbox: list) -> Optional[dict]:
    body = {
        "collections": [COLLECTION],
        "bbox": bbox,
        "query": {"eo:cloud_cover": {"lt": MAX_CLOUD}},
        "sortby": [{"field": "properties.datetime", "direction": "desc"}],
        "limit": 1,
    }
    r = requests.post(STAC_SEARCH, json=body, timeout=120)
    r.raise_for_status()
    feats = r.json().get("features", [])
    return feats[0] if feats else None


def _asset_href(item: dict, *keys: str) -> Optional[str]:
    assets = item.get("assets", {})
    for k in keys:
        if k in assets and assets[k].get("href"):
            return assets[k]["href"]
    return None


def calcular_ndti(item: dict, bbox: list) -> tuple[Optional[float], Optional[float]]:
    """Devuelve (ndti_medio, area_agua_m2). Requiere rasterio."""
    if not HAS_RASTER:
        return None, None

    green_href = _asset_href(item, "green", "B03")
    red_href = _asset_href(item, "red", "B04")
    scl_href = _asset_href(item, "scl", "SCL")
    if not green_href or not red_href:
        return None, None

    def read_window(href: str) -> tuple["np.ndarray", float]:
        with rasterio.open(href) as ds:
            # bbox viene en EPSG:4326; transformarlo al CRS del raster
            left, bottom, right, top = transform_bounds("EPSG:4326", ds.crs, *bbox)
            win = from_bounds(left, bottom, right, top, ds.transform)
            arr = ds.read(1, window=win).astype("float32")
            px_area = abs(ds.transform.a * ds.transform.e)  # m2 por píxel (CRS métrico)
            return arr, px_area

    green, _ = read_window(green_href)
    red, px_area = read_window(red_href)

    denom = red + green
    ndti = np.where(denom != 0, (red - green) / denom, np.nan)

    area_agua = None
    if scl_href:
        try:
            scl, _ = read_window(scl_href)
            # SCL puede tener distinta resolución; recortar al tamaño común
            h = min(ndti.shape[0], scl.shape[0])
            w = min(ndti.shape[1], scl.shape[1])
            mask = scl[:h, :w] == WATER_SCL
            sub = ndti[:h, :w]
            if mask.any():
                area_agua = float(mask.sum() * px_area)
                return float(np.nanmean(sub[mask])), area_agua
        except Exception as e:  # noqa: BLE001
            print(f"  SCL no disponible/legible: {e}")

    # Sin agua clasificada -> agregado del AOI
    val = float(np.nanmean(ndti))
    return (None if np.isnan(val) else val), area_agua


# --------------------------------------------------------------------------- #
# Reglas de alerta (mismo criterio que /api/cron/fuentes)
# --------------------------------------------------------------------------- #
def generar_alertas() -> int:
    fuentes = sb_get("davinci_v_fuentes")
    med = sb_get("davinci_v_mediciones")
    clima = sb_get("davinci_v_clima")
    obs = sb_get("davinci_v_obs_satelital")
    vivas = sb_get("davinci_v_alertas_vivas", select="tipo,fuente_id")

    def by_fuente(rows, fid, key):
        xs = [r for r in rows if r.get("fuente_id") == fid and r.get(key) is not None]
        return sorted(xs, key=lambda r: r[key])

    def ya_tiene(fid, tipo):
        return any(a["fuente_id"] == fid and a["tipo"] == tipo for a in vivas)

    n = 0
    for f in fuentes:
        fid = f["id"]
        m = by_fuente(med, fid, "medido_at")
        c = by_fuente(clima, fid, "fecha")
        o = by_fuente(obs, fid, "fecha")

        turb_asc = len(m) >= 2 and (m[-1].get("turbidez_ntu") or 0) > (m[-2].get("turbidez_ntu") or 0)
        ce_asc = len(m) >= 2 and (m[-1].get("ce_us_cm") or 0) > (m[-2].get("ce_us_cm") or 0)
        ndti_asc = (len(o) >= 2 and (o[-1].get("ndti") or 0) > (o[-2].get("ndti") or 0)) or \
                   (len(o) == 1 and (o[-1].get("ndti") or 0) > 0)
        precip = float(c[-1]["precip_mm"]) if c and c[-1].get("precip_mm") is not None else 0.0
        spi = float(c[-1]["spi"]) if c and c[-1].get("spi") is not None else 0.0

        if precip >= 20 and (turb_asc or ndti_asc) and not ya_tiene(fid, "lluvia"):
            sb_rpc("davinci_alerta_insert", {
                "p_fuente_id": fid, "p_tipo": "lluvia", "p_parametro": "turbidez",
                "p_severidad": "alta" if precip >= 50 else "media", "p_horizonte_dias": 2,
                "p_mensaje": f"Lluvia {precip} mm con turbidez/NDTI en ascenso en {f['nombre']}.",
                "p_recomendacion": "Reforzar coagulación/sedimentación y vigilar entrada a planta.",
            })
            n += 1

        if ce_asc and (spi <= -0.5 or precip < 5) and not ya_tiene(fid, "sequia"):
            sb_rpc("davinci_alerta_insert", {
                "p_fuente_id": fid, "p_tipo": "sequia", "p_parametro": "ce_ph",
                "p_severidad": "alta" if spi <= -1 else "media", "p_horizonte_dias": 7,
                "p_mensaje": f"CE al alza con estiaje (SPI {spi}) en {f['nombre']}.",
                "p_recomendacion": "Monitorear iones/pH; evaluar fuente alterna si persiste.",
            })
            n += 1
    return n


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main() -> None:
    print("== DaVinci Hídrico · ingesta Sentinel-2 ==")
    if not HAS_RASTER:
        print("rasterio/GDAL no disponible: se omite el cálculo de NDTI y solo "
              "se aplican las reglas de alerta.")

    fuentes = sb_get("davinci_v_fuentes")
    print(f"Fuentes: {len(fuentes)}")

    inserts = 0
    if HAS_RASTER:
        for f in fuentes:
            lat, lng = f.get("lat"), f.get("lng")
            if lat is None or lng is None:
                continue
            bbox = [lng - AOI_BUFFER_DEG, lat - AOI_BUFFER_DEG,
                    lng + AOI_BUFFER_DEG, lat + AOI_BUFFER_DEG]
            print(f"\n[{f['id']}] {f['nombre']}  bbox={bbox}")
            try:
                item = buscar_escena(bbox)
            except Exception as e:  # noqa: BLE001
                print(f"  STAC error: {e}")
                continue
            if not item:
                print("  Sin escenas <30% nubes.")
                continue

            scene_id = item.get("id")
            fecha = (item.get("properties", {}).get("datetime", "") or "")[:10]
            cloud = item.get("properties", {}).get("eo:cloud_cover")
            print(f"  Escena: {scene_id} ({fecha}, nubes={cloud}%)")

            ndti, area_agua = calcular_ndti(item, bbox)
            print(f"  NDTI={ndti}  area_agua_m2={area_agua}")

            sb_rpc("davinci_obs_insert", {
                "p_fuente_id": f["id"],
                "p_scene_id": scene_id,
                "p_fecha": fecha or dt.date.today().isoformat(),
                "p_ndti": ndti,
                "p_clorofila_a": None,
                "p_area_agua_m2": area_agua,
                "p_nubosidad_pct": float(cloud) if cloud is not None else None,
            })
            inserts += 1

    alertas = generar_alertas()
    print(f"\nObservaciones insertadas: {inserts} · Alertas generadas: {alertas}")


if __name__ == "__main__":
    main()
