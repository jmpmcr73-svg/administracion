-- =============================================================================
-- DaVinci Hídrico — inserción de observación satelital desde la ingesta.
-- Usado por scripts/ingest_sentinel.py vía PostgREST RPC (service role).
-- Aditivo y reversible.
-- =============================================================================

create or replace function public.davinci_obs_insert(
  p_fuente_id     text,
  p_scene_id      text,
  p_fecha         date,
  p_ndti          double precision default null,
  p_clorofila_a   double precision default null,
  p_area_agua_m2  double precision default null,
  p_nubosidad_pct double precision default null
) returns bigint
language plpgsql
security definer
set search_path = davinci_fuentes, public
as $$
declare new_id bigint;
begin
  insert into davinci_fuentes.obs_satelital
    (fuente_id, scene_id, fecha, ndti, clorofila_a, area_agua_m2, nubosidad_pct)
  values
    (p_fuente_id, p_scene_id, p_fecha, p_ndti, p_clorofila_a, p_area_agua_m2, p_nubosidad_pct)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.davinci_obs_insert(text, text, date, double precision, double precision, double precision, double precision) from public;
grant  execute on function public.davinci_obs_insert(text, text, date, double precision, double precision, double precision, double precision) to service_role;
