import {
  CATEGORY_CONTAINERS,
  METRICS,
  METRIC_GROUPS,
  TOTAL_WEIGHT,
} from "./metrics.js";
import { deleteEntry, initDatabase, loadEntries, saveEntry } from "./storage.js";
import { exportLogbook } from "./export.js";
import {
  formatYearMonth,
  initDatePicker,
  setPickerValue,
  shiftYear,
} from "./datepicker.js";
import { formatMonth, isoWeekToDate } from "./dates.js";

// Circumference of the r=40 score ring (2πr), used for stroke-dashoffset.
const ARC_LENGTH = 251.33;

let entries = [];
let sortMode = "date";
let editingId = null;

document.addEventListener("DOMContentLoaded", async () => {
  initDatePicker();
  buildSliders();
  try {
    await initDatabase();
    entries = await loadEntries();
  } catch (err) {
    console.error("DB init failed:", err);
    showToast("Database failed to initialize. See console.", "error");
  }
  updateBadge();
  setStatus(`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`);
});

// ── Entry form ──

function buildSliders() {
  METRICS.forEach((metric) => {
    const container = document.getElementById(CATEGORY_CONTAINERS[metric.cat]);
    if (!container) return;
    const item = document.createElement("div");
    item.className = "metric-item";
    item.innerHTML = `
      <div class="metric-header">
        <span class="metric-name">${metric.label}</span>
        <span class="metric-val" id="disp-${metric.id}">5<span class="denom">/10</span></span>
      </div>
      <div class="slider-wrap">
        <input type="range" class="metric-slider" id="sl-${metric.id}"
          min="1" max="10" value="5" step="1"
          data-metric="${metric.id}">
      </div>
      <div class="slider-footer">
        <div class="slider-ends">
          <span>${metric.lo}</span>
          <span>${metric.hi}</span>
        </div>
        <span class="slider-weight${metric.high ? " is-high" : ""}">×${metric.weight}</span>
      </div>`;
    container.appendChild(item);
    const slider = item.querySelector('input[type="range"]');
    slider.addEventListener("input", () => updateMetric(metric.id, slider.value));
    paintSliderTrack(slider, 5);
  });
}

function updateMetric(id, value) {
  value = parseInt(value);
  const display = document.getElementById(`disp-${id}`);
  const slider = document.getElementById(`sl-${id}`);
  display.innerHTML = `${value}<span class="denom">/10</span>`;
  if (value <= 3) display.className = "metric-val low-val";
  else if (value >= 8) display.className = "metric-val high-val";
  else display.className = "metric-val";
  slider.classList.toggle("is-low", value <= 3);
  slider.classList.toggle("is-high", value >= 8);
  paintSliderTrack(slider, value);
  updateScore();
}

function paintSliderTrack(slider, value) {
  const pct = (((value - 1) / 9) * 100).toFixed(2);
  const color = value <= 3 ? "#f87171" : value >= 8 ? "#9fb3a0" : "#d4a574";
  slider.style.background = `linear-gradient(to right, ${color} ${pct}%, rgba(68,64,60,0.4) ${pct}%)`;
}

function readRatings() {
  const ratings = {};
  METRICS.forEach((metric) => {
    ratings[metric.id] = parseInt(
      document.getElementById(`sl-${metric.id}`)?.value ?? 5,
    );
  });
  return ratings;
}

function computeScore(ratings) {
  let total = 0;
  METRICS.forEach((metric) => {
    total += (ratings[metric.id] ?? 5) * metric.weight;
  });
  return (total / (TOTAL_WEIGHT * 10)) * 100;
}

function updateScore() {
  const score = computeScore(readRatings());
  const offset = (ARC_LENGTH - (score / 100) * ARC_LENGTH).toFixed(2);
  document.getElementById("scoreDisplay").textContent = score.toFixed(1);
  const arc = document.getElementById("scoreArc");
  arc.setAttribute("stroke-dashoffset", offset);
  let color, description;
  if (score >= 85) {
    color = "#9fb3a0";
    description = "Exceptional — a serious contender.";
  } else if (score >= 72) {
    color = "#b8c9a0";
    description = "Strong — worth keeping an eye on.";
  } else if (score >= 58) {
    color = "#d4a574";
    description = "Decent — has its merits.";
  } else if (score >= 42) {
    color = "#c08050";
    description = "Mixed — notable drawbacks.";
  } else {
    color = "#f87171";
    description = "Challenging — may not suit you.";
  }
  arc.setAttribute("stroke", color);
  document.getElementById("scoreDesc").textContent = description;
  document.getElementById("scoreDesc").style.color = color;
}

async function handleSave() {
  const city = document.getElementById("inputCity").value.trim();
  const state = document.getElementById("inputState").value.trim();
  const date = document.getElementById("inputDate").value;
  const notes = document.getElementById("inputNotes").value.trim();
  if (!city) {
    showToast("Please enter a city name.", "error");
    return;
  }
  if (!state) {
    showToast("Please enter a state or country.", "error");
    return;
  }
  if (!date) {
    showToast("Please select a date.", "error");
    return;
  }

  const ratings = readRatings();
  const score = parseFloat(computeScore(ratings).toFixed(1));
  const entry = {
    id: editingId || Date.now().toString(36),
    city,
    state,
    date,
    score,
    ratings,
    notes,
    savedAt: new Date().toISOString(),
  };

  if (editingId) {
    const idx = entries.findIndex((e) => e.id === editingId);
    if (idx >= 0) {
      entries[idx] = { ...entries[idx], ...entry };
      showToast(`Updated: ${city}, ${state}.`, "success");
    }
  } else {
    const idx = entries.findIndex(
      (e) =>
        e.city.toLowerCase() === city.toLowerCase() &&
        e.state.toLowerCase() === state.toLowerCase() &&
        e.date === date,
    );
    if (idx >= 0) {
      entry.id = entries[idx].id;
      entries[idx] = { ...entries[idx], ...entry };
      showToast(`Updated existing entry: ${city}, ${state}.`, "success");
    } else {
      entries.push(entry);
      showToast(`Saved: ${city}, ${state} — ${score}/100`, "success");
    }
  }

  clearForm();
  updateBadge();
  try {
    await saveEntry(entry);
    setStatus(
      `${entries.length} ${entries.length === 1 ? "entry" : "entries"} · stored locally`,
      true,
    );
  } catch (err) {
    console.error("Save failed:", err);
    showToast("Save failed. See console.", "error");
  }
}

function clearForm() {
  document.getElementById("inputCity").value = "";
  document.getElementById("inputState").value = "";
  const now = new Date();
  setPickerValue(formatYearMonth(now.getFullYear(), now.getMonth()));
  document.getElementById("inputNotes").value = "";
  METRICS.forEach((metric) => {
    const slider = document.getElementById(`sl-${metric.id}`);
    if (slider) {
      slider.value = 5;
      updateMetric(metric.id, 5);
    }
  });
  document.getElementById("scoreDisplay").textContent = "—";
  document.getElementById("scoreArc").setAttribute("stroke-dashoffset", "251.33");
  document.getElementById("scoreDesc").textContent =
    "Rate the metrics below to calculate your score.";
  editingId = null;
  document.getElementById("btnSave").textContent = "Save Entry";
}

// ── Logbook ──

function setSort(mode) {
  sortMode = mode;
  ["date", "score", "city"].forEach((m) => {
    document
      .getElementById(`sort${capitalize(m)}`)
      .classList.toggle("active", m === mode);
  });
  renderLogbook();
}

function renderLogbook() {
  const list = document.getElementById("entriesList");
  const query = document.getElementById("searchLogbook").value.toLowerCase();
  document.getElementById("logbookCount").textContent =
    `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;

  if (!entries.length) {
    list.innerHTML = `<div class="empty-state">
      <p class="empty-title">No cities logged yet.</p>
      <small>Rate a city in the New Entry tab to begin.</small>
    </div>`;
    return;
  }

  let visible = entries;
  if (query) {
    visible = entries.filter(
      (e) =>
        e.city.toLowerCase().includes(query) ||
        e.state.toLowerCase().includes(query) ||
        (e.notes && e.notes.toLowerCase().includes(query)),
    );
  }
  if (!visible.length) {
    list.innerHTML = `<div class="empty-state">
      <p class="empty-title">No matches found.</p>
      <small>Try adjusting your search.</small>
    </div>`;
    return;
  }

  const sorted = [...visible].sort((a, b) =>
    sortMode === "date"
      ? new Date(b.date) - new Date(a.date)
      : sortMode === "score"
        ? b.score - a.score
        : a.city.localeCompare(b.city),
  );
  list.innerHTML = sorted.map((e) => renderEntryCard(e)).join("");
}

function renderEntryCard(entry) {
  const offset = (ARC_LENGTH - (entry.score / 100) * ARC_LENGTH).toFixed(2);
  const color =
    entry.score >= 75 ? "#9fb3a0" : entry.score >= 58 ? "#d4a574" : "#f87171";
  const breakdown = METRIC_GROUPS.map(
    (group) => `
    <div class="mini-cat-label">${group.label}</div>
    ${group.ids
      .map((id) => {
        const metric = METRICS.find((m) => m.id === id);
        const rating = entry.ratings[id] ?? 0;
        const barColor = metric.high ? "#d4a574" : "#9fb3a0";
        return `<div class="mini-row">
        <span class="mini-name">${metric.label}</span>
        <div class="mini-bar-bg">
          <div class="mini-bar-fill" style="width:${rating * 10}%;background:${barColor};"></div>
        </div>
        <span class="mini-val">${rating}/10</span>
      </div>`;
      })
      .join("")}`,
  ).join("");
  const notesBlock = entry.notes
    ? `<div class="entry-notes-block">
        <div class="entry-notes-label">Notes</div>
        <div class="entry-notes-text">${escapeHtml(entry.notes).replace(/\n/g, "<br/>")}</div>
       </div>`
    : "";

  return `<div class="entry-card" id="card-${entry.id}">
    <div class="entry-card-header" data-action="toggle" data-id="${entry.id}">
      <svg class="entry-score-svg" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="40" stroke="rgba(68,64,60,0.25)" stroke-width="6"/>
        <circle cx="50" cy="50" r="40" stroke="${color}" stroke-width="6"
          stroke-dasharray="${ARC_LENGTH}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(-90 50 50)"/>
        <text x="50" y="56" text-anchor="middle"
          font-family="ui-monospace,monospace" font-size="22" fill="${color}">${entry.score}</text>
      </svg>
      <div class="entry-city-block">
        <div class="entry-city-name">${escapeHtml(entry.city)}<span style="color:var(--text-dim);font-size:1rem;">, ${escapeHtml(entry.state)}</span></div>
        <div class="entry-meta">${formatMonth(entry.date)}</div>
      </div>
      <svg class="entry-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
    <div class="entry-detail">
      ${breakdown}
      ${notesBlock}
      <div class="entry-card-actions">
        <button class="btn btn-ghost"  data-action="edit"   data-id="${entry.id}">Edit / Load into Form</button>
        <button class="btn btn-danger" data-action="delete" data-id="${entry.id}">Delete</button>
      </div>
    </div>
  </div>`;
}

function toggleCard(id) {
  document.getElementById(`card-${id}`)?.classList.toggle("open");
}

function loadForEditing(id) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  let date = entry.date;
  if (date && date.includes("-W")) date = isoWeekToDate(date);
  document.getElementById("inputCity").value = entry.city;
  document.getElementById("inputState").value = entry.state;
  setPickerValue(date);
  document.getElementById("inputNotes").value = entry.notes ?? "";
  METRICS.forEach((metric) => {
    const slider = document.getElementById(`sl-${metric.id}`);
    if (slider) {
      slider.value = entry.ratings[metric.id] ?? 5;
      updateMetric(metric.id, slider.value);
    }
  });
  editingId = id;
  document.getElementById("btnSave").textContent = "Update Entry";
  switchView("new");
  showToast(`Loaded: ${entry.city}, ${entry.state} for editing`, "success");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function handleDelete(id) {
  const entry = entries.find((e) => e.id === id);
  if (!entry || !confirm(`Delete entry for ${entry.city}, ${entry.state}?`)) {
    return;
  }
  entries = entries.filter((e) => e.id !== id);
  updateBadge();
  renderLogbook();
  try {
    await deleteEntry(id);
    setStatus(
      `${entries.length} ${entries.length === 1 ? "entry" : "entries"} · stored locally`,
      true,
    );
    showToast("Entry deleted.", "");
  } catch (err) {
    console.error("Delete failed:", err);
    showToast("Delete failed. See console.", "error");
  }
}

async function handleExport() {
  if (!entries.length) {
    showToast("Nothing to export yet.", "error");
    return;
  }
  await exportLogbook(entries, showToast);
}

// ── Chrome: tabs, status bar, toast ──

function updateBadge() {
  document.getElementById("entryBadge").textContent = entries.length;
}

function switchView(view) {
  const isNew = view === "new";
  document.getElementById("viewNew").style.display = isNew ? "block" : "none";
  document.getElementById("viewLogbook").style.display = isNew ? "none" : "block";
  document.getElementById("tabNew").classList.toggle("active", isNew);
  document.getElementById("tabLogbook").classList.toggle("active", !isNew);
  if (!isNew) renderLogbook();
}

// `persisted` is passed by callers but never read.
function setStatus(text, persisted) {
  document.getElementById("fileStatus").textContent = text;
  document.getElementById("fileStatus").className = "file-status connected";
  document.getElementById("fileDot").className = "file-dot connected";
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

let toastTimer;
function showToast(message, type) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show${type ? " " + type : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnExport").addEventListener("click", handleExport);
  document.getElementById("tabNew").addEventListener("click", () => switchView("new"));
  document
    .getElementById("tabLogbook")
    .addEventListener("click", () => switchView("logbook"));
  document.getElementById("dpPrevYear").addEventListener("click", () => shiftYear(-1));
  document.getElementById("dpNextYear").addEventListener("click", () => shiftYear(1));
  document.getElementById("btnSave").addEventListener("click", handleSave);
  document.getElementById("btnClear").addEventListener("click", clearForm);
  document.getElementById("searchLogbook").addEventListener("input", renderLogbook);
  document.getElementById("sortDate").addEventListener("click", () => setSort("date"));
  document.getElementById("sortScore").addEventListener("click", () => setSort("score"));
  document.getElementById("sortCity").addEventListener("click", () => setSort("city"));
  document.getElementById("entriesList").addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    const { id, action } = target.dataset;
    if (action === "toggle") toggleCard(id);
    if (action === "edit") loadForEditing(id);
    if (action === "delete") handleDelete(id);
  });
});
