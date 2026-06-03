// Tipos alineados a las columnas REALES de caia-prod (verificadas via
// information_schema antes de codear). No inventar campos.

export interface Agente {
  agente_id: string;
  nombre: string | null;
  descripcion: string | null;
  tipo: string | null;
  estado: string | null;
  version: string | null;
  modelo_ia: string | null;
  proyecto: string | null;
  capa_logica: string | null;
  capa_codigo: string | null;
  objetivo: string | null;
  funcion_resumen: string | null;
  rol_completo: string | null;
  system_prompt: string | null;
  es_transversal: boolean | null;
  es_nuevo_v11: boolean | null;
  config_json: Record<string, unknown> | null;
  ultimo_run: string | null;
  updated_at: string | null;
}

export interface Conteo {
  label: string;
  n: number;
}

export interface OverviewData {
  total_agentes: number;
  agentes_activos: number;
  proyectos_distintos: number;
  por_proyecto: Conteo[];
  por_estado: Conteo[];
  por_capa: Conteo[];
  por_tipo: Conteo[];
  por_modelo: Conteo[];
  kronos: {
    sesiones: number | null;
    avances: number | null;
    decisiones: number | null;
    pendientes_total: number | null;
    pendientes_abiertos: number | null;
  };
  warroom: {
    crisis_total: number | null;
    crisis_activas: number | null;
    eventos: number | null;
  };
}

export interface Sesion {
  session_id: string;
  fecha_inicio: string | null;
  proyecto_activo: string | null;
  titulo: string | null;
  resumen_ejecutivo: string | null;
  estado: string | null;
  num_mensajes: number | null;
}

export interface Avance {
  avance_id: number;
  fecha: string | null;
  proyecto: string | null;
  modulo: string | null;
  descripcion: string | null;
  estado: string | null;
}

export interface Pendiente {
  pendiente_id: number;
  titulo: string | null;
  proyecto: string | null;
  prioridad: number | null;
  estado: string | null;
  asignado_a: string | null;
  fecha_creacion: string | null;
}

export interface KronosData {
  sesiones: Sesion[];
  avances: Avance[];
  pendientes_por_estado: Conteo[];
  pendientes_recientes: Pendiente[];
}

export interface Crisis {
  crisis_id: string;
  codigo: string | null;
  titulo: string;
  dimension: string;
  tipo_evento: string;
  descripcion: string | null;
  defcon: number | null;
  estado: string | null;
  capital_riesgo: number | null;
  capital_mitigado: number | null;
  timestamp_inicio: string | null;
}

export interface WarKpi {
  kpi_id: string;
  nombre: string;
  categoria: string | null;
  valor_actual: number | null;
  valor_meta: number | null;
  unidad: string | null;
  tendencia: string | null;
  alerta_activa: boolean | null;
  dimension: string | null;
}

export interface WarEvento {
  evento_id: string;
  origen_modulo: string | null;
  tipo_evento: string | null;
  severidad: string | null;
  titulo: string | null;
  descripcion: string | null;
  created_at: string | null;
}

export interface WarRoomData {
  crisis: Crisis[];
  crisis_activas: number;
  kpis: WarKpi[];
  eventos: WarEvento[];
}
