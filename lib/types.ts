// Tipos que reflejan las vistas public.davinci_v_* (capa de API sobre los
// schemas davinci_fugas / davinci_fuentes).

export type Prioridad = "alta" | "media" | "baja" | string;
export type Severidad = "critica" | "alta" | "media" | "baja" | string;

export interface PoiFuga {
  id: string;
  zona_id: string | null;
  zona_nombre: string | null;
  prioridad: Prioridad;
  estado: string | null;
  fuente: string | null;
  score: number | null;
  caudal_est_lpm: number | null;
  fecha_deteccion: string | null;
  lat: number | null;
  lng: number | null;
}

export interface Zona {
  id: string;
  nombre: string;
  operador: string | null;
  evento_ancla: string | null;
  geojson: GeoJSON.Geometry | null;
}

export interface DashboardKpis {
  total_pois: number;
  pois_alta: number;
  pois_media: number;
  pois_baja: number;
  caudal_total_lpm: number;
  ot_activas: number;
  ot_cerradas: number;
  evidencias_count: number;
  zonas_count: number;
}

export interface OrdenTrabajo {
  id: string;
  poi_id: string | null;
  denuncia_id: string | null;
  cuadrilla_id: string | null;
  cuadrilla_nombre: string | null;
  cuadrilla_responsable: string | null;
  prioridad: Prioridad;
  estado: string | null;
  diagnostico: string | null;
  creada_at: string | null;
  despachada_at: string | null;
  cerrada_at: string | null;
  zona_id: string | null;
  zona_nombre: string | null;
  lat: number | null;
  lng: number | null;
}

export interface OtMaterial {
  id: number;
  ot_id: string;
  material_id: string | null;
  descripcion: string | null;
  unidad: string | null;
  cant_plan: number | null;
  cant_usada: number | null;
  costo_unit: number | null;
  subtotal: number | null;
}

export interface BitacoraEntry {
  id: number;
  ot_id: string | null;
  evento: string | null;
  detalle: Record<string, unknown> | null;
  actor: string | null;
  ts: string | null;
}

export interface Fuente {
  id: string;
  nombre: string;
  tipo: string | null;
  planta_id: string | null;
  planta_nombre: string | null;
  lat: number | null;
  lng: number | null;
}

export interface AlertaViva {
  id: number;
  fuente_id: string | null;
  fuente_nombre: string | null;
  planta_id: string | null;
  planta_nombre: string | null;
  tipo: string | null;
  parametro: string | null;
  severidad: Severidad;
  horizonte_dias: number | null;
  mensaje: string | null;
  recomendacion: string | null;
  emitida_at: string | null;
  lat: number | null;
  lng: number | null;
}

export interface Medicion {
  id: number;
  fuente_id: string | null;
  fuente_nombre: string | null;
  ce_us_cm: number | null;
  ph: number | null;
  turbidez_ntu: number | null;
  od_mg_l: number | null;
  caudal_lps: number | null;
  medido_at: string | null;
}

export interface ObsSatelital {
  id: number;
  fuente_id: string | null;
  fuente_nombre: string | null;
  scene_id: string | null;
  fecha: string | null;
  ndti: number | null;
  clorofila_a: number | null;
  area_agua_m2: number | null;
  nubosidad_pct: number | null;
}
