# CAIA · Centro de Comando — Dashboard

Dashboard ejecutivo del cerebro **CAIA**, con datos **reales** de `caia-prod`
(Supabase ref `jmkkfmthysrvfkmkjtxf`). Es la prueba del motor de dashboards
unificado que luego reutilizan idworld, COSA, AyA y SteamFire.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind CSS.
- Acceso a datos **server-side** vía `@supabase/supabase-js` con la **service
  role key** (bypassa RLS). La key nunca llega al navegador.

## Variables de entorno
Copiá `.env.local.example` a `.env.local` y completá:

```
SUPABASE_URL=https://jmkkfmthysrvfkmkjtxf.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>   # SOLO server-side, sin NEXT_PUBLIC_
```

En Vercel: agregá estas dos variables en *Project → Settings → Environment
Variables* (no uses prefijo `NEXT_PUBLIC_`).

## Desarrollo
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de producción
```

## ⚠️ Requisito: exponer los schemas en la Data API
Las tablas viven en schemas **`akasha`, `kronos`, `war_room`** (no en `public`).
Para que la API REST de Supabase los sirva, hay que agregarlos en
**Supabase → Settings → API → Exposed schemas**.

### Nota de seguridad (importante)
El advisory de Supabase reporta que las 6 tablas de **`kronos.*` tienen RLS
deshabilitado**. Si exponés el schema `kronos` en la Data API, la **anon key**
podría leer/escribir esos datos.

Este dashboard mitiga el riesgo accediendo **solo con la service key
server-side** (en los Route Handlers de `app/api/**`), que nunca se expone al
cliente. Aun así, antes de exponer `kronos` públicamente, considerá habilitar
RLS con políticas adecuadas:

```sql
ALTER TABLE kronos.avances           ENABLE ROW LEVEL SECURITY;
ALTER TABLE kronos.contexto_vigente  ENABLE ROW LEVEL SECURITY;
ALTER TABLE kronos.decisiones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kronos.glosario          ENABLE ROW LEVEL SECURITY;
ALTER TABLE kronos.pendientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kronos.sesiones          ENABLE ROW LEVEL SECURITY;
-- + políticas: habilitar RLS sin políticas bloquea TODO acceso anon/authenticated
-- (la service key sigue funcionando porque bypassa RLS).
```

> Decisión tuya: no se aplicó automáticamente. Doc:
> https://supabase.com/docs/guides/database/postgres/row-level-security

## Endpoints (Route Handlers, server-side)
| Endpoint | Devuelve |
|---|---|
| `GET /api/caia/overview` | KPIs agregados + distribuciones (proyecto, capa, tipo, estado, modelo) |
| `GET /api/caia/agentes?proyecto=&q=` | Lista filtrable de agentes (campos ligeros) |
| `GET /api/caia/agente/[id]` | Detalle completo (incluye `system_prompt` y `config_json`) |
| `GET /api/caia/davinci` | Los 16 agentes `proyecto='davinci'` con su `config_json` (COVENIN, etc.) |
| `GET /api/caia/kronos` | Sesiones + avances + pendientes (recientes y por estado) |
| `GET /api/caia/warroom` | Crisis + KPIs + eventos |

## Componentes reutilizables
`KpiCard`, `BarChart`, `DataTable`, `Timeline`, `Panel`, `Badge`, `Logo`,
`Topbar`. Pensados para reutilizar en idworld/COSA/AyA cambiando solo el
data-layer y el tema.

## Tema (identidad CAIA)
Fondo `#06080f`, paneles glass `#0b0f1a`, acentos cyan `#34e1d4`, azul
`#4d9bff`, violeta `#9b8cff`, ámbar `#ffb84d`. Tipografías Chakra Petch
(display) + Space Mono (datos).
