/**
 * Map tiles, in one place.
 *
 * The knock map and the Storm Engine map both drew from CARTO's public
 * basemap. CARTO now requires an API key for that endpoint and, instead of
 * failing, serves a 200 with a 2KB image reading "API KEY REQUIRED". So the
 * tiles "loaded", no request errored, and the map was papered edge to edge
 * with the words API KEY REQUIRED. Nothing in the console said so.
 *
 * Esri's basemaps need no key and we already rely on them for the satellite
 * view of a roof, so this adds no new vendor. Light Gray is the closest match
 * to what the design assumed: quiet, so the hail and the doors are what you
 * see.
 *
 * Both maps now come through here. If a provider changes its terms again, it
 * changes in one file, not in however many components happen to draw a map.
 */

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

export const TILES = {
  /** Quiet street basemap, for anything with data plotted on top. */
  light: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
  /** Place and road labels, drawn over the light basemap. */
  lightLabels: `${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  /** Aerial, for looking at an actual roof. */
  satellite: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
  attribution: "Tiles &copy; Esri",
} as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Add the light basemap plus its labels to a Leaflet map.
 * `L` is passed in because every caller imports Leaflet dynamically.
 */
export function addLightBasemap(L: any, map: any, maxZoom = 19) {
  L.tileLayer(TILES.light, {
    maxZoom,
    maxNativeZoom: 16,
    attribution: TILES.attribution,
  }).addTo(map);
  L.tileLayer(TILES.lightLabels, {
    maxZoom,
    maxNativeZoom: 16,
    pane: "overlayPane",
  }).addTo(map);
}
