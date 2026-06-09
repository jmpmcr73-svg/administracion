# Sistema de Reportes Web → PDF (iAgri Portal)

> **Ubicación:** estos archivos pertenecen al repo **`iagri-portal`** (Next.js App Router),
> no a `administracion`. Se entregan aquí como _scaffolding listo para copiar_ porque
> `iagri-portal` no está en el alcance de esta sesión. Copia el árbol `src/...` tal cual
> a la raíz de `iagri-portal` y haz commit allí.

## Archivos

```
src/lib/supabase/server.ts                       # cliente Supabase (service role) server-side
src/app/reportes/page.tsx                         # listado de reportes del usuario + filtros
src/app/reportes/[reporte_id]/page.tsx            # reporte individual + botones PDF/Compartir
src/app/reportes/[reporte_id]/ReporteAcciones.tsx # botones cliente (descargar/compartir)
src/app/api/reportes/generar/route.ts             # POST: crea registro + dispara edge function
src/app/api/reportes/pdf/[reporte_id]/route.ts    # GET: genera PDF server-side (@react-pdf/renderer)
```

## Dependencias

```bash
npm install @react-pdf/renderer @supabase/supabase-js jspdf html2canvas
```

## Variables de entorno (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://crfghwtfqaplzsmwylxe.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role de iAgri>
NEXT_PUBLIC_SITE_URL=https://agri.pro
```

## Schema

La tabla `public.caia_reportes` **ya existe** en el proyecto iAgri
(`crfghwtfqaplzsmwylxe`). Columnas relevantes: `reporte_id, usuario_id, wa_numero,
tipo, subtipo, titulo, pais_id, parametros, contenido, estado, error_msg,
url_publica, generado_por, agente_id, created_at, completado_at`.

La edge function `generar-reporte` (en Supabase) procesa los datos satelitales y
actualiza `caia_reportes.contenido`/`estado`. Si aún no existe, el endpoint
`/api/reportes/generar` crea el registro en estado `generando` igualmente.

## Flujo

```
WA: "Generá reporte NDVI de mis lotes Coopedota"
  → Akasha → POST /api/reportes/generar {tipo: satelital_ndvi, pais: CR}
  → caia_reportes (estado: generando)
  → edge function generar-reporte procesa datos satelitales
  → caia_reportes (estado: listo, contenido: {...})
  → Akasha envía WA: "✅ Reporte listo → https://agri.pro/reportes/UUID"
  → Usuario abre link → ve reporte web → descarga PDF
```
