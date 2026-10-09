// ─── CALIBRATION ──────────────────────────────────────────────────
const GRID_START_COL = 3;
const GRID_START_ROW = 2;
const GRID_PIXEL_TOP_LEFT     = { x: 763,  y: 1105 }; // ← your values (y adjusted +200)
const GRID_PIXEL_BOTTOM_RIGHT = { x: 3383, y: 3671 }; // ← your bottom-right values
const VISIBLE_COLS = 19;
const VISIBLE_ROWS = 20;

function gridToPixel(gridX, gridY) {
  const relX = gridX - GRID_START_COL;
  const relY = gridY - GRID_START_ROW;
  const px = GRID_PIXEL_TOP_LEFT.x +
    (relX / (VISIBLE_COLS - 1)) *
    (GRID_PIXEL_BOTTOM_RIGHT.x - GRID_PIXEL_TOP_LEFT.x);
  const py = GRID_PIXEL_TOP_LEFT.y +
    (relY / (VISIBLE_ROWS - 1)) *
    (GRID_PIXEL_BOTTOM_RIGHT.y - GRID_PIXEL_TOP_LEFT.y);
  return { x: px, y: py };
}

// ─── DATA SOURCES ─────────────────────────────────────────────────
const PLANETS_JSON_URL =
  "https://raw.githubusercontent.com/parzivail/SWGalacticMap/refs/heads/master/planets.json";
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1cZ-JSc9zDIRn0VQt--rBtgoCZSJL3-wjxLfcsylrfeo/edit?usp=sharing"; // ← your Google Sheet CSV URL

// ─── IMAGE SETUP ──────────────────────────────────────────────────
const MAP_IMAGE = "galaxy.jpg";
const IMAGE_W = 4000; // ← your galaxy.jpg width in pixels
const IMAGE_H = 4000; // ← your galaxy.jpg height in pixels
const MAP_BOUNDS = [[0, 0], [IMAGE_H, IMAGE_W]];

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -3,
  maxZoom: 4,
  zoomSnap: 0.25,
  attributionControl: false,
});

L.imageOverlay(MAP_IMAGE, MAP_BOUNDS).addTo(map);
map.fitBounds(MAP_BOUNDS);

// ─── STATE ────────────────────────────────────────────────────────
let allPlanets    = [];
let allMarkers    = [];
let sheetData     = {};
let selectedMarker = null;

// ─── MARKER COLOR ─────────────────────────────────────────────────
function getMarkerClass(region) {
  const r = (region || "").toLowerCase();
  if (r.includes("deep core") || r.includes("core worlds")) return "marker-republic";
  if (r.includes("inner rim") || r.includes("colonies"))    return "marker-neutral";
  if (r.includes("outer rim"))                               return "marker-empire";
  if (r.includes("wild space") || r.includes("unknown"))    return "marker-unknown";
  if (r.includes("hutt"))                                    return "marker-hutt";
  return "marker-neutral";
}

// ─── HIGHLIGHT ────────────────────────────────────────────────────
function highlightMarker(marker) {
  // Remove previous highlight
  if (selectedMarker) {
    const prevEl = selectedMarker.getElement();
    if (prevEl) {
      const prevDot = prevEl.querySelector(".planet-marker");
      if (prevDot) prevDot.classList.remove("selected");
      const prevPulse = prevEl.querySelector(".planet-pulse");
      if (prevPulse) prevPulse.remove();
    }
  }
  // Apply new highlight
  selectedMarker = marker;
  const el = marker.getElement();
  if (el) {
    const dot = el.querySelector(".planet-marker");
    if (dot) dot.classList.add("selected");
    const pulse = document.createElement("div");
    pulse.className = "planet-pulse";
    const wrapper = el.querySelector(".planet-marker-wrapper");
    if (wrapper) wrapper.appendChild(pulse);
  }
}

// ─── INFO PANEL ───────────────────────────────────────────────────
function openPanel(planetPos) {
  const key   = (planetPos.Name || "").toLowerCase().trim();
  const sheet = sheetData[key] || {};

  document.getElementById("panel-region").textContent     = planetPos.Region || "";
  document.getElementById("panel-name").textContent       = planetPos.Name   || "Unknown";
  document.getElementById("panel-grid").textContent       = planetPos.Coord  || "—";
  document.getElementById("panel-gravity").textContent    = planetPos.Gravity ? planetPos.Gravity + "G" : "—";
  document.getElementById("panel-sector").textContent     = sheet.Sector     || planetPos.Sector || "—";
  document.getElementById("panel-system").textContent     = sheet.System     || planetPos.SunName || "—";
  document.getElementById("panel-affiliation").textContent = sheet.Affiliation || "—";
  document.getElementById("panel-climate").textContent    = sheet.Climate    || "—";
  document.getElementById("panel-terrain").textContent    = sheet.Terrain    || "—";
  document.getElementById("panel-population").textContent = sheet.Population || "—";
  document.getElementById("panel-lore").textContent       = sheet.Lore ||
    `Diameter: ${planetPos.Diameter ? planetPos.Diameter.toLocaleString() + " km" : "Unknown"} · ` +
    `Suns: ${planetPos.Suns ?? "?"} · Moons: ${planetPos.Moons ?? "?"} · ` +
    `Day: ${planetPos.LengthDay ? planetPos.LengthDay + " std. hours" : "Unknown"} · ` +
    `Year: ${planetPos.LengthYear ? planetPos.LengthYear + " std. days" : "Unknown"}`;
  document.getElementById("panel-events").textContent     = sheet.Events || "No data yet — add it to your Google Sheet!";

  const tagsEl = document.getElementById("panel-tags");
  tagsEl.innerHTML = "";
  const tags = [planetPos.Region, planetPos.Sector, planetPos.Coord,
    ...(sheet.Tags ? sheet.Tags.split(",") : [])].filter(Boolean);
  tags.forEach(t => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = t.trim();
    tagsEl.appendChild(span);
  });

  document.getElementById("panel-wookiee").href =
    `https://starwars.fandom.com/wiki/${encodeURIComponent(planetPos.Name || "")}`;
  document.getElementById("infopanel").classList.remove("hidden");
}

document.getElementById("close-panel").addEventListener("click", () => {
  document.getElementById("infopanel").classList.add("hidden");
});

// ─── LOAD DATA & BUILD MAP ────────────────────────────────────────
function loadPositions() {
  return fetch(PLANETS_JSON_URL).then(r => r.json());
}

function loadSheet() {
  return new Promise(resolve => {
    if (!SHEET_CSV_URL || SHEET_CSV_URL.includes("YOUR_GOOGLE")) {
      resolve([]);
      return;
    }
    Papa.parse(SHEET_CSV_URL, {
      download: true,
      header: true,
      complete: results => resolve(results.data),
    });
  });
}

Promise.all([loadPositions(), loadSheet()]).then(([planets, rows]) => {
  allPlanets = planets;

  rows.forEach(row => {
    if (row.Name) sheetData[row.Name.toLowerCase().trim()] = row;
  });

  planets.forEach(planet => {
    const gx = (planet.X || 0) + (planet.SubGridX || 0);
    const gy = (planet.Y || 0) + (planet.SubGridY || 0);
    if (!gx || !gy) return;

    const px = gridToPixel(gx, gy);
    const markerClass = getMarkerClass(planet.Region);

    const icon = L.divIcon({
      className: "",
      html: `<div class="planet-marker-wrapper">
               <div class="planet-marker ${markerClass}" title="${planet.Name}"></div>
             </div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });

    const marker = L.marker([px.y, px.x], { icon });
    marker.planetName = planet.Name;
    marker.on("click", () => {
      highlightMarker(marker);
      openPanel(planet);
    });
    marker.addTo(map);
    allMarkers.push(marker);
  });
});

// ─── SEARCH ───────────────────────────────────────────────────────
document.getElementById("search").addEventListener("input", function () {
  const query = this.value.toLowerCase().trim();
  if (!query) return;

  const match = allPlanets.find(p =>
    (p.Name   || "").toLowerCase().includes(query) ||
    (p.Sector || "").toLowerCase().includes(query) ||
    (p.Coord  || "").toLowerCase().includes(query)
  );

  if (match) {
    const gx = (match.X || 0) + (match.SubGridX || 0);
    const gy = (match.Y || 0) + (match.SubGridY || 0);
    const px = gridToPixel(gx, gy);
    map.setView([px.y, px.x], 1, { animate: true });
    openPanel(match);
    const marker = allMarkers.find(m =>
      (m.planetName || "").toLowerCase() === (match.Name || "").toLowerCase()
    );
    if (marker) highlightMarker(marker);
  }
});