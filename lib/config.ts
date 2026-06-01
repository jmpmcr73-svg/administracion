// Configuración del mapa.
//
// El prompt pide explícitamente basemap CLARO / Positron, fondo blanco
// ("no el dark"). Dejamos la URL como constante para poder alternar a la
// variante dark en una sola línea si se decide lo contrario.

export const BASEMAP = {
  // CARTO Positron (claro). Para dark: dark_all/{z}/{x}/{y}{r}.png
  url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 20,
};

// Centro por defecto (Gran Área Metropolitana, Costa Rica) y zoom.
export const MAP_DEFAULT = {
  center: [9.9368, -84.151] as [number, number],
  zoom: 13,
};
