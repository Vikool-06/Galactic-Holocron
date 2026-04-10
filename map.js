// ─── CONFIGURATION ────────────────────────────────────────────────
// Replace this URL with your published Google Sheet CSV link (see Phase 3)
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRAxR3uxRhpB6obol0IRpbWOkK4ocG3NrKwa6fiQ8V1R59Wd6Em6cQ_jbWKZcIC8MvcR8OCS6xY6Tr/pub?gid=0&single=true&output=csv";

// The galaxy map image (you'll host this in your repo — see Phase 2 Step 4)
const MAP_IMAGE = "galaxy.jpg";

// Map bounds — these match Bernberg's coordinate system
const MAP_BOUNDS = [[0, 0], [8192, 8192]];

// ─── INITIALIZE MAP ───────────────────────────────────────────────
const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -3,
  maxZoom: 3,
  zoomSnap: 0.25,
  attributionControl: false,
});

L.imageOverlay(MAP_IMAGE, MAP_BOUNDS).addTo(map);
map.fitBounds(MAP_BOUNDS);

// ─── AFFILIATION → MARKER COLOR ───────────────────────────────────
function getMarkerClass(affiliation) {
  const a = (affiliation || "").toLowerCase();
  if (a.includes("republic") || a.includes("jedi")) return "marker-republic";
  if (a.includes("empire") || a.includes("imperial"))  return "marker-empire";
  if (a.includes("sith"))   return "marker-sith";
  if (a.includes("hutt"))   return "marker-hutt";
  if (a.includes("neutral") || a.includes("independent")) return "marker-neutral";
  return "marker-unknown";
}

// ─── OPEN INFO PANEL ──────────────────────────────────────────────
function openPanel(p) {
  document.getElementById("panel-region").textContent     = p.Region || "";
  document.getElementById("panel-name").textContent       = p.Name || "Unknown";
  document.getElementById("panel-sector").textContent     = p.Sector || "—";
  document.getElementById("panel-system").textContent     = p.System || "—";
  document.getElementById("panel-grid").textContent       = p.GridRef || "—";
  document.getElementById("panel-affiliation").textContent = p.Affiliation || "—";
  document.getElementById("panel-climate").textContent    = p.Climate || "—";
  document.getElementById("panel-terrain").textContent    = p.Terrain || "—";
  document.getElementById("panel-population").textContent = p.Population || "—";
  document.getElementById("panel-gravity").textContent    = p.Gravity || "—";
  document.getElementById("panel-lore").textContent       = p.Lore || "No data available.";
  document.getElementById("panel-events").textContent     = p.Events || "—";

  // Tags
  const tagsEl = document.getElementById("panel-tags");
  tagsEl.innerHTML = "";
  if (p.Tags) {
    p.Tags.split(",").forEach(t => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = t.trim();
      tagsEl.appendChild(span);
    });
  }

  // Wookieepedia link
  const wookieeLink = document.getElementById("panel-wookiee");
  const wookieeName = encodeURIComponent(p.Name || "");
  wookieeLink.href = `https://starwars.fandom.com/wiki/${wookieeName}`;

  document.getElementById("infopanel").classList.remove("hidden");
}

document.getElementById("close-panel").addEventListener("click", () => {
  document.getElementById("infopanel").classList.add("hidden");
});

// ─── LOAD PLANETS FROM GOOGLE SHEET ───────────────────────────────
let allPlanets = [];

Papa.parse(SHEET_CSV_URL, {
  download: true,
  header: true,
  complete: function(results) {
    allPlanets = results.data;
    allPlanets.forEach(planet => {
      if (!planet.X || !planet.Y) return;

      const markerClass = getMarkerClass(planet.Affiliation);
      const icon = L.divIcon({
        className: "",
        html: `<div class="planet-marker ${markerClass}" title="${planet.Name}"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });

      const marker = L.marker([parseFloat(planet.Y), parseFloat(planet.X)], { icon });
      marker.on("click", () => openPanel(planet));
      marker.addTo(map);
    });
  }
});

// ─── SEARCH BAR ───────────────────────────────────────────────────
document.getElementById("search").addEventListener("input", function () {
  const query = this.value.toLowerCase().trim();
  if (!query) return;
  const match = allPlanets.find(p =>
    (p.Name || "").toLowerCase().includes(query) ||
    (p.Sector || "").toLowerCase().includes(query) ||
    (p.System || "").toLowerCase().includes(query)
  );
  if (match && match.X && match.Y) {
    map.setView([parseFloat(match.Y), parseFloat(match.X)], 1, { animate: true });
    openPanel(match);
  }
});