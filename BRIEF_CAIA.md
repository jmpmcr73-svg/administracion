# BRIEF — Dashboard CAIA Central (datos reales)

> Para Claude Code. Construir un dashboard ejecutivo del cerebro CAIA, con datos
> REALES de caia-prod. Estética alta tecnología, identidad CAIA. Es la prueba del
> motor de dashboards unificado que luego reutilizan idworld, COSA, AyA, SteamFire.

## 0. Stack y dónde
- Next.js 14 (App Router) + TypeScript + Tailwind.
- Repo nuevo sugerido: `caia-dashboard` (o carpeta de prueba si preferís rápido).
- Desplegar en Vercel (team existente). Rama `main` para deploy, `dev` para preview.
- Secretos por variables de entorno, nunca en código.

## 1. Base de datos (REAL — ya verificada)
- Supabase **caia-prod**, ref `jmkkfmthysrvfkmkjtxf` (us-east-1).
- Conexión server-side con service key en env (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`).
- Datos reales disponibles AHORA:
  - `akasha.agentes` → **235 agentes** (cols: agente_id, nombre, tipo, estado,
    modelo_ia, proyecto, capa_logica, config_json, system_prompt, es_transversal...).
  - `kronos.sesiones` (59), `kronos.avances` (171), `kronos.decisiones` (99),
    `kronos.pendientes` (321), `kronos.glosario` (26).
  - `war_room.agentes` (45), `war_room.crisis` (7), war_room.kpis, .eventos, .radar.
  - `clima.*` (noaa_sst, sentinel2_ndvi, sentinel5p_so2), `vulcano.monitoreo_usgs`.
- **Inspeccioná columnas reales antes de codear** (information_schema). No asumas.

## 2. Qué debe mostrar (todo con dato real)
1. **KPIs arriba**: total de agentes (235), agentes por estado, nº de proyectos
   distintos (campo `proyecto`), sesiones KRONOS, pendientes abiertos, decisiones.
2. **Agentes por proyecto** (gráfico de barras): contar `akasha.agentes` agrupado por
   `proyecto` (iagri 118, davinci 16, cross 12, etc. — dato real).
3. **Mapa de capas/lógica**: distribución por `capa_logica` o `tipo`.
4. **Panel KRONOS**: últimas sesiones y avances (timeline), pendientes por estado.
5. **War Room**: KPIs de crisis activas, lista de eventos recientes.
6. **Explorador de agentes**: tabla filtrable/buscable de los 235 (nombre, proyecto,
   modelo, estado) con detalle al clic (mostrar system_prompt, config_json).
7. **DaVinci spotlight**: sección destacando los 16 agentes `proyecto='davinci'`
   con su disciplina y normas COVENIN (vienen en config_json).

## 3. Diseño (identidad CAIA)
- Tema oscuro: fondo #06080f, paneles glass #0b0f1a, acentos cyan #34e1d4,
  azul #4d9bff, violeta #9b8cff, ámbar #ffb84d.
- Tipografía: Chakra Petch (display) + Space Mono (datos) o IBM Plex.
- Topbar "CAIA · CENTRO DE COMANDO" + indicador EN VIVO pulsante.
- Logo: círculos concéntricos con núcleo glowing.
- Componentes reutilizables (KpiCard, BarChart, DataTable, Timeline) para que el
  mismo set sirva a idworld/COSA/AyA después.

## 4. Endpoints sugeridos (Next API routes, server-side)
- `/api/caia/overview` → KPIs agregados.
- `/api/caia/agentes?proyecto=&q=` → lista filtrable.
- `/api/caia/agente/[id]` → detalle.
- `/api/caia/kronos` → sesiones+avances+pendientes recientes.
- `/api/caia/warroom` → crisis+kpis+eventos.

## 5. Env

```
SUPABASE_URL=https://jmkkfmthysrvfkmkjtxf.supabase.co
SUPABASE_SERVICE_KEY=...    (server-side only)
```

## 6. Pasos
1. Crear proyecto Next + Tailwind. Conectar Supabase caia-prod (service key en env).
2. Inspeccionar columnas reales de las tablas listadas. Reportar antes de codear.
3. Construir endpoints con queries reales (no datos hardcodeados).
4. Construir UI con los componentes reutilizables y el tema CAIA.
5. `npm run dev`, verificar que los 235 agentes y KRONOS salen reales.
6. Deploy a Vercel. Reportar URL.

## 7. Aceptación
- [ ] KPIs reflejan datos reales (235 agentes, etc.).
- [ ] Barras de agentes por proyecto con datos de la BD.
- [ ] Explorador de 235 agentes filtrable, con detalle.
- [ ] Panel KRONOS y War Room con datos reales.
- [ ] Tema CAIA aplicado, componentes reutilizables.
- [ ] Ningún secreto en código. Deploy en Vercel funcionando.
