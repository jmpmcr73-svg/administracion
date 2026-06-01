# DaVinci Hídrico — portal AyA

Portal del producto **DaVinci Hídrico**: detección de fugas + monitoreo de
fuentes de agua para AyA (Costa Rica).

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (proyecto `move-idworld`, ref `zsmlntktqisiclzaxoky`) — datos en
  los schemas `davinci_fugas` y `davinci_fuentes`
- **Leaflet** con basemap **CARTO Positron (claro)**
- Webhook **Telegram** (`@hidrocr_bot`) y canal opcional **WhatsApp** (Twilio)
- Ingesta **Sentinel-2** (NDTI con rasterio) + **Vercel Cron** de alertas
- Deploy en **Vercel**

> ⚠️ Este código vive en el repo `administracion` por decisión explícita; el
> prompt original apuntaba al repo `aya`. Si en algún momento se mueve a `aya`,
> el contenido es portable tal cual.

---

## Arquitectura de datos (importante)

Las geometrías PostGIS no son legibles directo por `supabase-js`, y los schemas
`davinci_*` no están expuestos en PostgREST. Por eso toda la app accede a una
**capa de API en el schema `public`**, creada por las migraciones de
`supabase/migrations/`:

- **Vistas de lectura** `public.davinci_v_*` — proyectan `lat`/`lng` (ST_X/ST_Y),
  GeoJSON de zonas y los joins que el dashboard necesita.
- **Funciones `SECURITY DEFINER`** `public.davinci_*` — las escrituras del flujo
  de cuadrilla (confirmar/cerrar OT, evidencias, bitácora) y la ingesta
  (obs_satelital, alertas).

Todo el acceso es **server-side con la service role** (`lib/supabase/server.ts`,
marcado `server-only`). La service role **nunca** llega al cliente.

Las migraciones ya fueron aplicadas al proyecto `zsmlntktqisiclzaxoky`. Para
reaplicarlas en otro entorno: ejecutá los `.sql` de `supabase/migrations/` en
orden (`0001`, `0002`, `0003`).

---

## Estructura

```
app/
  fugas/         Vista Fugas: mapa POIs + KPIs + OT activa con materiales + lista
  fuentes/       Vista Fuentes: alertas vivas + turbidez + escena Sentinel-2
  cuadrillas/    Vista Cuadrillas: bitácora del flujo de OT + estado de OTs
  api/telegram/  Webhook del bot @hidrocr_bot (valida secret header)
  api/whatsapp/  Canal Twilio (reusa lib/flow)
  api/cron/fuentes/  Cron diario: reglas de alerta sobre fuentes
components/      Sidebar, mapas Leaflet (ssr:false), gráfico turbidez, UI
lib/
  supabase/server.ts   cliente service-role (server-only)
  davinci.ts           queries del dashboard
  flow.ts              lógica de cuadrilla (agnóstica al canal)
  telegram.ts          helpers Bot API
  types.ts, format.ts, config.ts
scripts/
  ingest_sentinel.py   ingesta Sentinel-2 (NDTI) + reglas de alerta
supabase/migrations/   capa de API en public (0001..0003)
```

---

## Variables de entorno

Copiá `.env.local.example` → `.env.local` (gitignored) y completá los valores.
En Vercel: **Settings → Environment Variables** (Production + Preview). **Nunca**
en el código.

| Variable | Uso |
|---|---|
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor** — bypassa RLS |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente (auth futura) |
| `SUPABASE_EVIDENCIAS_BUCKET` | bucket de Storage para evidencias (`evidencias`) |
| `TELEGRAM_BOT_TOKEN` | bot `@hidrocr_bot` — solo Vercel/.env.local |
| `TELEGRAM_WEBHOOK_SECRET` | random para validar el webhook |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` | WhatsApp opcional |
| `SUPERVISION_EMAIL` / `RESEND_API_KEY` | reporte de cierre por correo (opcional) |
| `CRON_SECRET` | autentica el Vercel Cron |

---

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local   # completar secretos
npm run dev                        # http://localhost:3000
npm run build                      # build de producción
npm run typecheck                  # tsc --noEmit
```

---

## Flujo de cuadrilla (Telegram)

El bot matchea la cuadrilla por `chat_id` en `davinci_fugas.cuadrillas`.

- `/ot` → lista las OTs asignadas con botones **Confirmar recepción** / **Cerrar OT**.
- Botón *Confirmar recepción* → `estado='recibida'` + bitácora.
- Foto/video/documento → se descarga de Telegram, se sube a Supabase Storage e
  inserta en `davinci_fugas.evidencias` (geo si viene `location`, + timestamp).
- `/cerrar <OT>` → `estado='cerrada'`, `cerrada_at=now()`, marca el POI como
  `verificado` y dispara el reporte de cierre a supervisión.

El webhook valida el header `X-Telegram-Bot-Api-Secret-Token` contra
`TELEGRAM_WEBHOOK_SECRET`. **WhatsApp** (`/api/whatsapp`) reusa la misma lógica
(`lib/flow.ts`) vía comandos de texto.

> Necesitás un bucket de Storage llamado `evidencias` (o el que definas en
> `SUPABASE_EVIDENCIAS_BUCKET`).

---

## Ingesta Sentinel-2

`scripts/ingest_sentinel.py` consulta el STAC abierto de Element84
(`sentinel-2-l2a`, `eo:cloud_cover < 30`) por la escena más reciente sobre el AOI
de cada fuente, calcula **NDTI = (B04−B03)/(B04+B03)** con rasterio promediando
sobre píxeles de agua (`SCL==6`), inserta en `obs_satelital` y genera alertas.

```bash
pip install -r scripts/requirements.txt
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
python scripts/ingest_sentinel.py
# Detrás de proxy con MITM SSL: export GDAL_HTTP_UNSAFESSL=YES  (en local/Vercel NO hace falta)
```

> Vercel functions no pueden correr rasterio/GDAL. Programá el script con
> **GitHub Actions** o cron de servidor. La route **`/api/cron/fuentes`**
> (Vercel Cron diario, ver `vercel.json`) aplica las **reglas de alerta** sobre
> lo que el script deja en `obs_satelital` — eso sí corre en Vercel.

---

## Deploy

1. `vercel link` al proyecto.
2. Cargá **todas** las env vars en Vercel (Production + Preview).
3. Deploy a producción (`vercel --prod` o push a la branch conectada).
4. Registrá el webhook de Telegram **desde tu terminal** (no dejes secretos en el repo):
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://<app>.vercel.app/api/telegram&secret_token=$TELEGRAM_WEBHOOK_SECRET"
   ```
5. (WhatsApp) configurá el webhook del sandbox de Twilio → `https://<app>.vercel.app/api/whatsapp`.

---

## Seguridad (criterio maestro)

- 🔴 **RLS está deshabilitado** en las 16 tablas de `davinci_fugas`/`davinci_fuentes`.
  Con la anon key cualquiera puede leer/escribir. **Definí políticas RLS por
  rol/tenant antes de producción.** La app no depende de la anon key (usa service
  role server-side), pero la base sigue expuesta. SQL de remediación en
  `supabase/migrations/` / abajo.
- La **service role** vive solo en el servidor (`server-only`).
- Después del demo: **revocá el token del bot en BotFather (`/revoke`)** y generá
  uno nuevo — el anterior se compartió fuera de un canal seguro.
- Primer commit verificado: sin secretos trackeados.

### Habilitar RLS (revisar antes de correr — bloquea acceso hasta agregar policies)

```sql
ALTER TABLE davinci_fugas.poi_fugas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE davinci_fugas.ordenes_trabajo ENABLE ROW LEVEL SECURITY;
-- ... (las 16 tablas; ver el advisory de Supabase) ...
-- y agregar las policies por rol/tenant correspondientes.
```
