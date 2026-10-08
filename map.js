// ─── CALIBRATION ──────────────────────────────────────────────────
// YOUR MAP STARTS AT COLUMN C (=3) AND ROW 2
// So we tell the function to offset accordingly

const GRID_START_COL = 3;  // C is the 3rd letter (A=1, B=2, C=3)
const GRID_START_ROW = 2;  // your map's first visible row is row 2

// Pixel position of the TOP-LEFT grid corner visible on your image
// = where Column C meets Row 2
// → hover over that intersection in Photopea with Info panel open
const GRID_PIXEL_TOP_LEFT     = { x: 763, y: 905 };  // ← replace with your values

// Pixel position of the BOTTOM-RIGHT grid corner visible on your image
// = the last column and last row you can see (looks like U and row 21)
const GRID_PIXEL_BOTTOM_RIGHT = { x: 3383, y: 3671 }; // ← replace with your values

// How many columns and rows are VISIBLE on your image
// C to U = 19 columns, rows 2 to 21 = 20 rows
const VISIBLE_COLS = 19;
const VISIBLE_ROWS = 20;

function gridToPixel(gridX, gridY) {
  // Shift coordinates relative to where your image actually starts
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

// ─── YOUR DATA SOURCES ────────────────────────────────────────────
// Source 1: parzivail's dataset → planet positions (WHERE the dots go)
const PLANETS_JSON_URL =
  "https://raw.githubusercontent.com/parzivail/SWGalacticMap/refs/heads/master/planets.json";

// Source 2: Your Google Sheet → lore & info panel content (WHAT shows on click)
// Replace this with your published Google Sheet CSV URL
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1cZ-JSc9zDIRn0VQt--rBtgoCZSJL3-wjxLfcsylrfeo/edit?usp=sharing";

// ─── IMAGE SETUP ──────────────────────────────────────────────────
const MAP_IMAGE = "galaxy.jpg";
const IMAGE_W = 4000; // ← replace with your galaxy.jpg actual width in pixels
const IMAGE_H = 4000; // ← replace with your galaxy.jpg actual height in pixels
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

// ─── MARKER COLOR BY REGION ───────────────────────────────────────
function getMarkerClass(region) {
  const r = (region || "").toLowerCase();
  if (r.includes("deep core") || r.includes("core worlds")) return "marker-republic";
  if (r.includes("inner rim") || r.includes("colonies"))    return "marker-neutral";
  if (r.includes("outer rim"))                               return "marker-empire";
  if (r.includes("wild space") || r.includes("unknown"))    return "marker-unknown";
  if (r.includes("hutt"))                                    return "marker-hutt";
  return "marker-neutral";
}

// ─── LOAD BOTH SOURCES, THEN BUILD MAP ────────────────────────────
let allPlanets   = []; // from parzivail  → coordinates
let sheetData    = {}; // from your Sheet → lore, keyed by planet name (lowercase)

// Helper: load parzivail JSON
function loadPositions() {
  return fetch(PLANETS_JSON_URL).then(r => r.json());
}

// Helper: load your Google Sheet CSV
function loadSheet() {
  return new Promise(resolve => {
    Papa.parse(SHEET_CSV_URL, {
      download: true,
      header: true,
      complete: results => resolve(results.data),
    });
  });
}

// Run both loads in parallel, then place markers
Promise.all([loadPositions(), loadSheet()]).then(([planets, rows]) => {
  allPlanets = planets;

  // Index your sheet rows by planet name for fast lookup
  rows.forEach(row => {
    if (row.Name) sheetData[row.Name.toLowerCase().trim()] = row;
  });

  // Place a dot for every planet in parzivail's dataset
  planets.forEach(planet => {
    const gx = (planet.X || 0) + (planet.SubGridX || 0);
    const gy = (planet.Y || 0) + (planet.SubGridY || 0);
    if (!gx || !gy) return;

    const px = gridToPixel(gx, gy);
    const markerClass = getMarkerClass(planet.Region);

    const icon = L.divIcon({
      className: "",
      html: `<div class="planet-marker ${markerClass}" title="${planet.Name}"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });

    const marker = L.marker([px.y, px.x], { icon });
    marker.on("click", () => openPanel(planet));
    marker.addTo(map);
  });
});

// ─── OPEN INFO PANEL ──────────────────────────────────────────────
function openPanel(planetPos) {
  // Look up this planet's name in your Google Sheet
  const key  = (planetPos.Name || "").toLowerCase().trim();
  const sheet = sheetData[key] || {}; // empty object if not in your sheet yet

  // Name & region always come from parzivail (reliable)
  document.getElementById("panel-region").textContent = planetPos.Region || "";
  document.getElementById("panel-name").textContent   = planetPos.Name   || "Unknown";

  // Grid ref & physical stats from parzivail
  document.getElementById("panel-grid").textContent   = planetPos.Coord  || "—";
  document.getElementById("panel-gravity").textContent =
    planetPos.Gravity ? planetPos.Gravity + "G" : "—";

  // Sector: prefer your Sheet, fall back to parzivail
  document.getElementById("panel-sector").textContent =
    sheet.Sector || planetPos.Sector || "—";

  // Everything below: your Sheet only (you fill these in over time)
  document.getElementById("panel-system").textContent =
    sheet.System || planetPos.SunName || "—";
  document.getElementById("panel-affiliation").textContent =
    sheet.Affiliation || "—";
  document.getElementById("panel-climate").textContent =
    sheet.Climate || "—";
  document.getElementById("panel-terrain").textContent =
    sheet.Terrain || "—";
  document.getElementById("panel-population").textContent =
    sheet.Population || "—";

  // Physical facts always from parzivail
  document.getElementById("panel-lore").textContent =
    sheet.Lore ||
    `Diameter: ${planetPos.Diameter ? planetPos.Diameter.toLocaleString() + " km" : "Unknown"} · ` +
    `Suns: ${planetPos.Suns ?? "?"} · Moons: ${planetPos.Moons ?? "?"} · ` +
    `Day: ${planetPos.LengthDay ? planetPos.LengthDay + " std. hours" : "Unknown"} · ` +
    `Year: ${planetPos.LengthYear ? planetPos.LengthYear + " std. days" : "Unknown"}`;

  document.getElementById("panel-events").textContent =
    sheet.Events || "No data yet — add it to your Google Sheet!";

  // Tags: combine region (parzivail) + custom tags (your Sheet)
  const tagsEl = document.getElementById("panel-tags");
  tagsEl.innerHTML = "";
  const tags = [
    planetPos.Region,
    planetPos.Sector,
    planetPos.Coord,
    ...(sheet.Tags ? sheet.Tags.split(",") : [])
  ].filter(Boolean);
  tags.forEach(t => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = t.trim();
    tagsEl.appendChild(span);
  });

  // Wookieepedia link
  document.getElementById("panel-wookiee").href =
    `https://starwars.fandom.com/wiki/${encodeURIComponent(planetPos.Name || "")}`;

  document.getElementById("infopanel").classList.remove("hidden");
}

document.getElementById("close-panel").addEventListener("click", () => {
  document.getElementById("infopanel").classList.add("hidden");
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
  }
});