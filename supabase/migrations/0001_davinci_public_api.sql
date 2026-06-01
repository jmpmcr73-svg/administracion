-- =============================================================================
-- DaVinci Hídrico — capa de API en el schema public
-- -----------------------------------------------------------------------------
-- Los schemas davinci_fugas / davinci_fuentes NO están expuestos en PostgREST y
-- sus geometrías PostGIS no son legibles directamente por supabase-js. Esta
-- migración crea, en el schema `public` (ya expuesto), una capa de:
--   * VISTAS de solo-lectura que proyectan lat/lng (ST_X/ST_Y) y hacen los joins
--     que el dashboard necesita.
--   * FUNCIONES SECURITY DEFINER para las escrituras del flujo de cuadrilla
--     (webhook de Telegram / WhatsApp), de modo que el servidor nunca necesite
--     exponer los schemas davinci_* ni la service role al cliente.
--
-- Todo es aditivo y reversible (DROP VIEW / DROP FUNCTION). No altera datos.
-- El acceso queda restringido al rol service_role (usado SOLO en el servidor).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- VISTAS DE LECTURA — FUGAS
-- ----------------------------------------------------------------------------

create or replace view public.davinci_v_poi_fugas as
select
  p.id,
  p.zona_id,
  z.nombre               as zona_nombre,
  p.prioridad,
  p.estado,
  p.fuente,
  p.score,
  p.caudal_est_lpm,
  p.fecha_deteccion,
  st_y(p.geom)           as lat,
  st_x(p.geom)           as lng
from davinci_fugas.poi_fugas p
left join davinci_fugas.zonas_piloto z on z.id = p.zona_id;

create or replace view public.davinci_v_zonas as
select
  z.id,
  z.nombre,
  z.operador,
  z.evento_ancla,
  st_asgeojson(z.geom)::jsonb as geojson
from davinci_fugas.zonas_piloto z;

create or replace view public.davinci_v_dashboard as
select
  (select count(*)                       from davinci_fugas.poi_fugas)                                as total_pois,
  (select count(*)                       from davinci_fugas.poi_fugas where prioridad = 'alta')       as pois_alta,
  (select count(*)                       from davinci_fugas.poi_fugas where prioridad = 'media')      as pois_media,
  (select count(*)                       from davinci_fugas.poi_fugas where prioridad = 'baja')       as pois_baja,
  (select coalesce(sum(caudal_est_lpm),0) from davinci_fugas.poi_fugas)                               as caudal_total_lpm,
  (select count(*)                       from davinci_fugas.ordenes_trabajo where estado <> 'cerrada') as ot_activas,
  (select count(*)                       from davinci_fugas.ordenes_trabajo where estado = 'cerrada')  as ot_cerradas,
  (select count(*)                       from davinci_fugas.evidencias)                               as evidencias_count,
  (select count(*)                       from davinci_fugas.zonas_piloto)                             as zonas_count;

create or replace view public.davinci_v_ordenes as
select
  o.id,
  o.poi_id,
  o.denuncia_id,
  o.cuadrilla_id,
  c.nombre               as cuadrilla_nombre,
  c.responsable          as cuadrilla_responsable,
  o.prioridad,
  o.estado,
  o.diagnostico,
  o.creada_at,
  o.despachada_at,
  o.cerrada_at,
  p.zona_id,
  z.nombre               as zona_nombre,
  st_y(p.geom)           as lat,
  st_x(p.geom)           as lng
from davinci_fugas.ordenes_trabajo o
left join davinci_fugas.cuadrillas   c on c.id = o.cuadrilla_id
left join davinci_fugas.poi_fugas    p on p.id = o.poi_id
left join davinci_fugas.zonas_piloto z on z.id = p.zona_id;

create or replace view public.davinci_v_ot_materiales as
select
  m.id,
  m.ot_id,
  m.material_id,
  mat.descripcion,
  mat.unidad,
  m.cant_plan,
  m.cant_usada,
  mat.costo_unit,
  round(coalesce(m.cant_usada, m.cant_plan, 0) * coalesce(mat.costo_unit, 0), 2) as subtotal
from davinci_fugas.ot_materiales m
left join davinci_fugas.materiales mat on mat.id = m.material_id;

create or replace view public.davinci_v_bitacora as
select
  b.id,
  b.ot_id,
  b.evento,
  b.detalle,
  b.actor,
  b.ts
from davinci_fugas.bitacora b;

create or replace view public.davinci_v_evidencias as
select
  e.id,
  e.ot_id,
  e.tipo,
  e.url,
  e.momento,
  e.capturada_at,
  e.subida_por,
  st_y(e.geom)           as lat,
  st_x(e.geom)           as lng
from davinci_fugas.evidencias e;

create or replace view public.davinci_v_cuadrillas as
select id, nombre, responsable, canal, chat_id, activa
from davinci_fugas.cuadrillas;

-- ----------------------------------------------------------------------------
-- VISTAS DE LECTURA — FUENTES
-- ----------------------------------------------------------------------------

create or replace view public.davinci_v_fuentes as
select
  f.id,
  f.nombre,
  f.tipo,
  f.planta_id,
  pl.nombre              as planta_nombre,
  st_y(f.geom)           as lat,
  st_x(f.geom)           as lng
from davinci_fuentes.fuentes f
left join davinci_fuentes.plantas pl on pl.id = f.planta_id;

create or replace view public.davinci_v_alertas_vivas as
select
  a.id,
  a.fuente_id,
  f.nombre               as fuente_nombre,
  a.planta_id,
  pl.nombre              as planta_nombre,
  a.tipo,
  a.parametro,
  a.severidad,
  a.horizonte_dias,
  a.mensaje,
  a.recomendacion,
  a.emitida_at,
  st_y(f.geom)           as lat,
  st_x(f.geom)           as lng
from davinci_fuentes.alertas a
left join davinci_fuentes.fuentes f  on f.id = a.fuente_id
left join davinci_fuentes.plantas pl on pl.id = a.planta_id
where a.emitida_at >= now() - interval '30 days'
order by a.emitida_at desc;

create or replace view public.davinci_v_mediciones as
select
  m.id,
  m.fuente_id,
  f.nombre               as fuente_nombre,
  m.ce_us_cm,
  m.ph,
  m.turbidez_ntu,
  m.od_mg_l,
  m.caudal_lps,
  m.medido_at
from davinci_fuentes.mediciones_calidad m
left join davinci_fuentes.fuentes f on f.id = m.fuente_id
order by m.medido_at;

create or replace view public.davinci_v_obs_satelital as
select
  o.id,
  o.fuente_id,
  f.nombre               as fuente_nombre,
  o.scene_id,
  o.fecha,
  o.ndti,
  o.clorofila_a,
  o.area_agua_m2,
  o.nubosidad_pct
from davinci_fuentes.obs_satelital o
left join davinci_fuentes.fuentes f on f.id = o.fuente_id
order by o.fecha desc;

-- ----------------------------------------------------------------------------
-- FUNCIONES DE ESCRITURA (flujo de cuadrilla)  — SECURITY DEFINER
-- ----------------------------------------------------------------------------

-- Confirmar recepción de una OT: estado='recibida' + entrada en bitácora.
create or replace function public.davinci_ot_confirmar(p_ot text, p_actor text default 'telegram')
returns davinci_fugas.ordenes_trabajo
language plpgsql
security definer
set search_path = davinci_fugas, public
as $$
declare r davinci_fugas.ordenes_trabajo;
begin
  update davinci_fugas.ordenes_trabajo
     set estado = 'recibida'
   where id = p_ot
  returning * into r;

  if r.id is not null then
    insert into davinci_fugas.bitacora (ot_id, evento, detalle, actor)
    values (p_ot, 'recepcion_confirmada', jsonb_build_object('estado', 'recibida'), p_actor);
  end if;

  return r;
end;
$$;

-- Cerrar OT: estado='cerrada', cerrada_at=now(), marca el POI como verificado,
-- registra en bitácora. Devuelve la OT cerrada.
create or replace function public.davinci_ot_cerrar(p_ot text, p_actor text default 'telegram')
returns davinci_fugas.ordenes_trabajo
language plpgsql
security definer
set search_path = davinci_fugas, public
as $$
declare r davinci_fugas.ordenes_trabajo;
begin
  update davinci_fugas.ordenes_trabajo
     set estado = 'cerrada', cerrada_at = now()
   where id = p_ot
  returning * into r;

  if r.id is not null then
    update davinci_fugas.poi_fugas
       set estado = 'verificado'
     where id = r.poi_id;

    insert into davinci_fugas.bitacora (ot_id, evento, detalle, actor)
    values (p_ot, 'ot_cerrada', jsonb_build_object('estado', 'cerrada'), p_actor);
  end if;

  return r;
end;
$$;

-- Insertar evidencia (foto/video) con geo opcional.
create or replace function public.davinci_evidencia_insert(
  p_ot      text,
  p_tipo    text,
  p_url     text,
  p_lat     double precision default null,
  p_lng     double precision default null,
  p_momento text default null,
  p_actor   text default 'telegram'
) returns bigint
language plpgsql
security definer
set search_path = davinci_fugas, public
as $$
declare new_id bigint;
begin
  insert into davinci_fugas.evidencias (ot_id, tipo, url, geom, momento, subida_por)
  values (
    p_ot, p_tipo, p_url,
    case when p_lat is not null and p_lng is not null
         then st_setsrid(st_makepoint(p_lng, p_lat), 4326) end,
    p_momento, p_actor
  )
  returning id into new_id;

  insert into davinci_fugas.bitacora (ot_id, evento, detalle, actor)
  values (p_ot, 'evidencia_recibida',
          jsonb_build_object('tipo', p_tipo, 'url', p_url), p_actor);

  return new_id;
end;
$$;

-- Registrar un evento genérico en bitácora.
create or replace function public.davinci_bitacora_insert(
  p_ot      text,
  p_evento  text,
  p_detalle jsonb default '{}'::jsonb,
  p_actor   text default 'telegram'
) returns bigint
language plpgsql
security definer
set search_path = davinci_fugas, public
as $$
declare new_id bigint;
begin
  insert into davinci_fugas.bitacora (ot_id, evento, detalle, actor)
  values (p_ot, p_evento, p_detalle, p_actor)
  returning id into new_id;
  return new_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- PERMISOS — restringir todo al rol service_role (servidor)
-- ----------------------------------------------------------------------------
do $$
declare v record;
begin
  for v in
    select table_name from information_schema.views
    where table_schema = 'public' and table_name like 'davinci_v_%'
  loop
    execute format('grant select on public.%I to service_role;', v.table_name);
  end loop;
end $$;

revoke execute on function public.davinci_ot_confirmar(text, text)                                          from public;
revoke execute on function public.davinci_ot_cerrar(text, text)                                             from public;
revoke execute on function public.davinci_evidencia_insert(text, text, text, double precision, double precision, text, text) from public;
revoke execute on function public.davinci_bitacora_insert(text, text, jsonb, text)                          from public;

grant execute on function public.davinci_ot_confirmar(text, text)                                          to service_role;
grant execute on function public.davinci_ot_cerrar(text, text)                                             to service_role;
grant execute on function public.davinci_evidencia_insert(text, text, text, double precision, double precision, text, text) to service_role;
grant execute on function public.davinci_bitacora_insert(text, text, jsonb, text)                          to service_role;
