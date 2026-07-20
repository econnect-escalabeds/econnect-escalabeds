// Dashboard Escalarunners — lee en vivo la hoja de respuestas del Google Form
// Publicada como CSV. No requiere backend: cada carga de página trae los datos más recientes.

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTMcGW2fT8advta_pw3riL6VWtKq7kvpuj4OTRveeVkyXrnt4FRwKTKy5NDg7qK_5H_PhiY1dCIgpvO/pub?output=csv";
const META_KM = 300; // meta colectiva del mes — edítala aquí cuando cambie

function parseCSV(text) {
  // Parser simple que respeta comillas de CSV estándar de Google Sheets
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === '\r') { /* ignore */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ""));
}

function findCol(headers, keywords) {
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (keywords.some(k => h.includes(k))) return i;
  }
  return -1;
}

function parseDistance(raw) {
  if (!raw) return 0;
  const cleaned = raw.toString().replace(/[^\d.,]/g, "").replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

async function loadDashboard() {
  const rankEl = document.getElementById("rank-body");
  const progressFill = document.getElementById("progress-fill");
  const progressLabel = document.getElementById("progress-label");
  const emptyEl = document.getElementById("dash-empty");

  try {
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo leer la hoja");
    const text = await res.text();
    const rows = parseCSV(text);

    if (rows.length < 2) {
      showEmpty();
      return;
    }

    const headers = rows[0];
    const nameIdx = findCol(headers, ["nombre"]);
    const distIdx = findCol(headers, ["distancia", "km"]);

    if (nameIdx === -1 || distIdx === -1) {
      showEmpty("No se encontraron las columnas de nombre o distancia en la hoja.");
      return;
    }

    const totals = {};
    let groupTotal = 0;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const name = (r[nameIdx] || "").trim();
      const km = parseDistance(r[distIdx]);
      if (!name) continue;
      totals[name] = (totals[name] || 0) + km;
      groupTotal += km;
    }

    const ranked = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (ranked.length === 0) {
      showEmpty();
      return;
    }

    emptyEl.style.display = "none";
    rankEl.innerHTML = ranked.map(([name, km], idx) => `
      <tr>
        <td><span class="rank-pos">${idx + 1}</span></td>
        <td>${escapeHtml(name)}</td>
        <td>${km.toFixed(1)} km</td>
      </tr>
    `).join("");

    const pct = Math.min(100, (groupTotal / META_KM) * 100);
    progressFill.style.width = pct + "%";
    progressLabel.textContent = `${groupTotal.toFixed(1)} km de ${META_KM} km · ${pct.toFixed(0)}% de la meta del mes`;

  } catch (err) {
    console.error(err);
    showEmpty("No se pudo cargar el dashboard en este momento. Revisa tu conexión o vuelve a intentarlo.");
  }
}

function showEmpty(msg) {
  const emptyEl = document.getElementById("dash-empty");
  const rankEl = document.getElementById("rank-body");
  const progressFill = document.getElementById("progress-fill");
  const progressLabel = document.getElementById("progress-label");
  rankEl.innerHTML = "";
  progressFill.style.width = "0%";
  progressLabel.textContent = `0 km de ${META_KM} km · 0% de la meta del mes`;
  emptyEl.style.display = "block";
  emptyEl.textContent = msg || "Aún no hay registros. ¡Sé el primero en registrar tu resultado!";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", loadDashboard);
