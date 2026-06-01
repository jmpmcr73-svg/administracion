# CAIA-Hub · Diseño del modelo causa-efecto (eventos ↔ clima)

> Estado: **propuesta de diseño** (antes de implementar)
> Objetivo del proyecto: tratar el sistema Tierra como un sistema acoplado y
> cuantificar, con datos históricos, qué condiciones atmosféricas **previas**
> se asocian a la ocurrencia (y severidad) de eventos naturales — empezando por
> **tornados**, usando **sismos como grupo de control negativo**.

---

## 1. Principio metodológico

No buscamos "predecir el futuro" como producto operativo (la meteorología
operativa con supercomputadoras aún no ubica un tornado a 24 h). Buscamos algo
real y alcanzable:

1. **Cuantificar correlaciones** entre precursores atmosféricos y eventos.
2. **Construir modelos de riesgo probabilístico** (P(evento | condiciones)).
3. **Validar causalidad vs. azar** con un grupo de control.

### Por qué tornados como piloto
- Precursores atmosféricos **reales y estudiados** (CAPE, CIN, cizalladura...).
- **104.518 eventos etiquetados** con fecha, hora y lat/lon (5.527 fuertes EF3-5).
- La hipótesis del usuario (cizalladura → tornado) es **físicamente correcta**.

### Por qué sismos como CONTROL (no como evento a modelar)
Los terremotos **no tienen precursores atmosféricos comprobados** (consenso
USGS). Por eso son el control perfecto:
- Si el modelo halla señal climática antes de **tornados** pero **no** antes de
  **sismos** → la señal es **real**, no un artefacto del método.
- Si hallara "señal" también antes de sismos → estaríamos ante **correlaciones
  espurias** y habría que revisar el pipeline.

Esto protege al proyecto de engañarse a sí mismo (el mayor riesgo en este tipo
de minería de datos).

---

## 2. Variables precursoras (features) — ERA5

Extraídas **en el punto y las horas previas** a cada evento. Fuente: ERA5
*hourly on single levels* (resolución ~0.25°, horaria).

| Variable ERA5 | Símbolo | Por qué importa |
|---------------|---------|-----------------|
| `convective_available_potential_energy` | CAPE | "Combustible" de la convección |
| `convective_inhibition` | CIN | La "tapa" que retiene la energía |
| `10m_u/v_component_of_wind` | viento 10m | Base de la cizalladura |
| `100m_u/v_component_of_wind` | viento 100m | Cizalladura de capa baja |
| `2m_temperature` | T2m | Energía térmica superficial |
| `2m_dewpoint_temperature` | Td | Humedad / inestabilidad |
| `mean_sea_level_pressure` | MSLP | Sistemas frontales |
| `k_index`, `total_totals_index` | K, TT | Índices de inestabilidad |
| `total_column_water_vapour` | TCWV | Humedad integrada |

**Derivadas calculadas** (no vienen directas en ERA5):
- **Cizalladura 0-1 km y 0-6 km** = |viento(nivel alto) − viento(10m)|
- **Helicidad relativa a la tormenta (SRH)** — proxy con perfil de viento.

> Nota: cizalladura y SRH "completas" requieren niveles de presión (otro dataset
> ERA5, `pressure-levels`). El piloto empieza con la aproximación 10m/100m y se
> amplía si la señal lo justifica.

---

## 3. Ventanas temporales

Por cada evento con timestamp `t0`:

```
   t0-48h        t0-24h        t0-6h     t0 (evento)
     |-------------|-------------|---------|
        ventana de precursores (features)
```

Se agregan los precursores en ventanas: **-48h, -24h, -6h, -1h**. Esto permite
preguntar: *¿la cizalladura subió en las 24 h previas?* (la pregunta del usuario).

---

## 4. Generación de NO-eventos (control negativo interno)

Un modelo solo con eventos no aprende nada (no sabe qué es "normal"). Por cada
evento generamos **N no-eventos**:
- Mismo dominio espacial, **misma estación del año**, pero fecha/hora **sin**
  ningún tornado reportado en ~150 km / ±6 h.
- Ratio inicial 1:3 (evento:no-evento), ajustable.

Esto convierte el problema en **clasificación**: `features → {evento, no-evento}`.

---

## 5. Esquema de datos propuesto

```sql
-- Catálogo de features por evento (y por no-evento)
modelo_muestras (
  id uuid pk,
  tipo_muestra text,        -- 'evento' | 'no_evento'
  evento_tipo text,         -- 'tornado' | 'sismo'(control) | 'huracan'
  evento_ref uuid,          -- fk al evento original (nullable para no-eventos)
  lat, lon double precision,
  t0 timestamptz,           -- instante del evento / muestra
  -- severidad (target secundario)
  severidad text,           -- EF0..EF5 / magnitud
  created_at timestamptz
)

-- Features atmosféricas por muestra y ventana temporal
modelo_features (
  id uuid pk,
  muestra_id uuid fk -> modelo_muestras,
  ventana text,             -- '-48h' | '-24h' | '-6h' | '-1h'
  cape, cin, t2m, td, mslp, k_index, tt_index, tcwv numeric,
  wind10_u, wind10_v, wind100_u, wind100_v numeric,
  shear_0_1km, shear_0_6km, srh_proxy numeric,   -- derivadas
  fuente text default 'ERA5',
  unique (muestra_id, ventana)
)
```

La tabla `modelo_features` es la **matriz de entrenamiento** (una fila ancha por
muestra×ventana → se pivota para el modelo).

---

## 6. Pipeline de extracción (futuro `scripts/build_modelo_features.py`)

1. Tomar muestra de eventos (empezar con **tornados EF3-5**, los 5.527 fuertes).
2. Generar no-eventos emparejados por estación/región.
3. Para cada (lat, lon, t0): descargar ERA5 horario del punto en t0-48h..t0.
4. Agregar por ventana, calcular derivadas (cizalladura, SRH).
5. Insertar en `modelo_muestras` + `modelo_features`.
6. Repetir el **mismo pipeline** para una muestra de **sismos** (control).

> ⚠️ ERA5 horario por punto: usar el dataset `reanalysis-era5-single-levels`
> (no monthly) con `area` reducida al punto. Cola del CDS aplica.

---

## 7. Modelado (fase posterior, fuera de Supabase)

Sobre la matriz exportada:
1. **Análisis exploratorio**: correlación de cada precursor con la etiqueta.
2. **Modelos base**: regresión logística (interpretable) → P(tornado | features).
3. **Modelos no lineales**: gradient boosting / random forest (importancia de
   variables = qué precursor pesa más).
4. **Validación con el control**: el mismo modelo sobre sismos **no** debe
   discriminar mejor que el azar. Si discrimina → revisar fuga de datos.
5. Métricas: ROC-AUC, Brier score, curvas de fiabilidad.

---

## 8. Roadmap

| Fase | Entregable | Estado |
|------|-----------|--------|
| 0 | Tablas de eventos (tornados, sismos, huracanes, ENSO) | ✅ hecho |
| 1 | Este documento de diseño | ✅ propuesta |
| 2 | Esquema `modelo_muestras` + `modelo_features` | ⬜ |
| 3 | `build_modelo_features.py` piloto (tornados EF3-5, muestra) | ⬜ |
| 4 | Extracción control (sismos) | ⬜ |
| 5 | Notebook de exploración + modelo base | ⬜ |
| 6 | Clima agregado mensual (agro) — vía paralela | ⬜ (script listo) |

---

## 9. Expectativas honestas

- **Sí alcanzable**: cuantificar qué combinación de precursores eleva la
  probabilidad de tornado; modelos de riesgo; validación rigurosa.
- **No prometido**: ubicar el punto exacto de toque 24 h antes como sistema
  operativo (problema abierto en la ciencia actual).
- El valor está en **entender las relaciones** y construir un marco reproducible
  y científicamente honesto — que es exactamente el objetivo declarado.
