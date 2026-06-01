-- =============================================================================
-- DaVinci Hídrico — soporte para generación de alertas (fuentes)
--   * Vista de lectura de clima.
--   * Función SECURITY DEFINER para insertar alertas desde el servidor.
-- Aditivo y reversible.
-- =============================================================================

create or replace view public.davinci_v_clima as
select c.id, c.fuente_id, f.nombre as fuente_nombre, c.fecha, c.precip_mm, c.spi, c.hum_suelo
from davinci_fuentes.clima c
left join davinci_fuentes.fuentes f on f.id = c.fuente_id
order by c.fecha desc;

grant select on public.davinci_v_clima to service_role;

create or replace function public.davinci_alerta_insert(
  p_fuente_id      text,
  p_planta_id      text default null,
  p_tipo           text default 'general',
  p_parametro      text default null,
  p_severidad      text default 'media',
  p_horizonte_dias integer default null,
  p_mensaje        text default null,
  p_recomendacion  text default null
) returns bigint
language plpgsql
security definer
set search_path = davinci_fuentes, public
as $$
declare new_id bigint;
begin
  insert into davinci_fuentes.alertas
    (fuente_id, planta_id, tipo, parametro, severidad, horizonte_dias, mensaje, recomendacion)
  values
    (p_fuente_id, p_planta_id, p_tipo, p_parametro, p_severidad, p_horizonte_dias, p_mensaje, p_recomendacion)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.davinci_alerta_insert(text, text, text, text, text, integer, text, text) from public;
grant  execute on function public.davinci_alerta_insert(text, text, text, text, text, integer, text, text) to service_role;
