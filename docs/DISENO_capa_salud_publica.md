# CAIA-Hub · Capa Salud Pública (clima → salud)

> Estado: **en construcción** (esqueleto creado, dengue en marcha)
> Hipótesis del usuario (correcta y respaldada): los cambios climáticos modulados
> por ENSO afectan la salud pública por dos vías principales — **vectores**
> (zancudos) y **agua** (dilución de contaminantes) — con desfase temporal.

---

## 1. Cadenas causales (todas documentadas en la literatura)

### A. Vía VECTOR (dengue, zika, chikungunya, malaria)
```
↑Temperatura  → ciclo del mosquito más rápido + replicación viral más rápida
Lluvia/sequía → criaderos (lluvia: charcos; sequía: agua almacenada en casas)
              → ↑población de Aedes / Anopheles
              → ↑transmisión con desfase de semanas-meses
```
- Rango óptimo *Aedes aegypti*: ~22-32 °C. Por eso ↑temperatura = ↑riesgo.
- **Conexión ENSO**: El Niño se asocia a brotes de dengue/malaria en LATAM con
  lag de meses → enlaza directamente con el modelo estacional ya construido.

### B. Vía AGUA (diarrea, hepatitis A, cólera) — el ejemplo del usuario
```
↑Temperatura + ↓Lluvia → ↓caudal ríos/quebradas + ↓agua subterránea
   → ↑concentración de contaminantes (menos dilución)
   → fuentes de agua alternativas menos seguras
   → ↑enfermedades diarreicas / hepatitis A
   + las PRIMERAS lluvias tras sequía arrastran contaminantes → picos
```

### C. Eslabón intermedio: HIDROLOGÍA
El puente clima→salud por agua pasa por el caudal/disponibilidad hídrica.
Cuando no hay estaciones hidrométricas, se usan **proxies derivados de ERA5**:
- `runoff` (escorrentía), `volumetric_soil_water_layer_1` (humedad del suelo)
- Índices de sequía calculados desde precipitación (SPI/SPEI)

---

## 2. Fuentes de datos (verificadas, junio 2026)

| Fuente | Contenido | Acceso | Estado |
|--------|-----------|--------|--------|
| **OpenDengue** (opendengue.org) | Casos de dengue, 102 países, 1924-2023+, semanal/mensual, subnacional en 40 países | CSV abierto (figshare, CC-BY) | ✅ script hecho |
| **OPS/PAHO PLISA** | Dengue + malaria por país/semana epidemiológica, Américas | Portal/descargas; subnacional en 9 países | ⬜ pendiente |
| **OPS Open Data** (opendata.paho.org) | Indicadores varios | Portal | ⬜ pendiente |
| **MinSalud por país** | Boletines epidemiológicos semanales | Mayormente PDF | ⬜ artesanal |

> ⚠️ **Realismo**: los datos de salud de CA son más desordenados que el clima.
> Subregistro, formatos heterogéneos, muchos PDF, a veces solo nivel nacional
> (no por zona). OpenDengue es el punto de entrada más limpio.

---

## 3. Esquema de datos (creado en Supabase)

| Tabla | Contenido | Clave |
|-------|-----------|-------|
| `salud_vectores_semanal` | dengue/zika/chik/malaria por país-zona-semana | (pais, zona, enf, año, semana, fuente) |
| `salud_agua_semanal` | diarrea/hepatitis/cólera por país-zona-semana | (pais, zona, enf, año, semana, edad, fuente) |
| `hidrologia_mensual` | escorrentía, humedad suelo, índice sequía, caudal | (zona, año, mes, fuente) |

Todas enlazan a `clima_ca_zonas` para correlacionar con clima/ENSO.

---

## 4. Pipeline

1. **Dengue (OpenDengue)** → `salud_vectores_semanal`. *(script listo)*
   - Nota: OpenDengue es por país/adm1; el mapeo país→`zona_code` agroclimática
     se hace en una fase posterior (requiere tabla de correspondencia adm1→zona).
2. **OPS PLISA** → complementa dengue/malaria recientes y por subnacional.
3. **Enf. por agua** → buscar series por país (MinSalud/OPS); las más dispersas.
4. **Hidrología** → derivar de ERA5 (runoff, humedad suelo) por zona → puente
   cuantitativo clima→agua→salud.

---

## 5. Modelado (fase posterior)

Sobre las tablas cruzadas con `clima_ca_mensual` + `clima_enso_fases`:
- **Correlación con lag**: casos_dengue(semana t) vs. temp/lluvia(t-4, t-8, t-12).
- **Regresión / modelos de conteo** (Poisson/binomial negativa) para incidencia.
- **Validación con el grupo de control** (mismo principio que el modelo de
  eventos): variables sin relación causal no deben "predecir".
- Salida: **riesgo estacional por zona y enfermedad** → alertas tempranas.

---

## 6. Visión integrada

```
                 ENSO (✅ 915 reg.)
                     │
                     ▼
        Clima por zona CA (⏳ descargando)
              │                    │
              ▼                    ▼
        SALUD (esqueleto ✅)   AGRICULTURA (planeado)
        ├─ vectores (dengue ⏳)
        ├─ agua (diarrea)
        └─ hidrología (proxy ERA5)
```

Mismo principio del proyecto: **sistema acoplado**, correlaciones con desfase,
validación honesta. La capa salud comparte el esqueleto climático y aporta una
dimensión de impacto humano directo.

---

## 7. Expectativas honestas

- **Alcanzable**: cuantificar correlación clima↔dengue por zona; mapas de riesgo
  estacional; alertas tempranas probabilísticas ligadas al pronóstico ENSO.
- **Difícil/limitado**: datos de enfermedades por agua (dispersos); resolución
  subnacional fina (muchos países solo reportan nacional); causalidad estricta
  (confusores socioeconómicos: agua potable, saneamiento, urbanización).
- El valor: **anticipar temporadas de alto riesgo** con meses de antelación,
  accionable para ministerios de salud y prevención.
