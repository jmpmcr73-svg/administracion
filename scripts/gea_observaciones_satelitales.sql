-- =============================================================================
-- GEA: tablas destino de la ingesta satelital (ingesta_satelital_crsv.py)
-- Proyecto Supabase: KRONOS (zsmlntktqisiclzaxoky), schema gea
-- Idempotente: CREATE ... IF NOT EXISTS (no toca tablas existentes).
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS gea;

-- Serie de estadísticas zonales por país / fuente / variable -----------------
CREATE TABLE IF NOT EXISTS gea.observaciones_satelitales (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pais_id        TEXT NOT NULL,                    -- CR / SV / PA
  fuente         TEXT NOT NULL,                    -- sentinel2/sentinel1/tropomi/modis/gpm/enos
  variable       TEXT NOT NULL,                    -- ndvi/ndwi/nbr/sar_vv/so2_du/lst_k/precip_mm/oni
  valor_mean     DOUBLE PRECISION,
  valor_min      DOUBLE PRECISION,
  valor_max      DOUBLE PRECISION,
  valor_std      DOUBLE PRECISION,
  valor_p25      DOUBLE PRECISION,
  valor_p75      DOUBLE PRECISION,
  bbox           DOUBLE PRECISION[],               -- [W, S, E, N]
  crs            TEXT,
  fecha_obs      DATE,
  fecha_ingesta  TIMESTAMPTZ DEFAULT NOW(),
  producto_id    TEXT,                             -- id del item/archivo STAC fuente
  metadata_json  JSONB DEFAULT '{}',
  -- clave de conflicto usada por el upsert del script
  CONSTRAINT uq_obs_sat UNIQUE (pais_id, fuente, variable, fecha_obs, producto_id)
);

CREATE INDEX IF NOT EXISTS ix_obs_sat_pais_fuente
  ON gea.observaciones_satelitales (pais_id, fuente, variable, fecha_obs DESC);
CREATE INDEX IF NOT EXISTS ix_obs_sat_fecha
  ON gea.observaciones_satelitales (fecha_ingesta DESC);

-- Alertas por anomalía significativa -----------------------------------------
CREATE TABLE IF NOT EXISTS gea.alertas_satelitales (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pais_id        TEXT NOT NULL,
  fuente         TEXT NOT NULL,
  variable       TEXT NOT NULL,
  severidad      TEXT,                             -- media / alta / critica
  valor          DOUBLE PRECISION,
  umbral         DOUBLE PRECISION,
  mensaje        TEXT,
  bbox           DOUBLE PRECISION[],
  fecha_obs      DATE,
  fecha_ingesta  TIMESTAMPTZ DEFAULT NOW(),
  producto_id    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_alert_sat_pais
  ON gea.alertas_satelitales (pais_id, severidad, fecha_obs DESC);
