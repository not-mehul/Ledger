// ============================================================
// Main app
// Mirrors the behavior of the original single-file web app, but
//   - reads/writes via db.js (SQLite native, localStorage in dev)
//   - exports via exporter.js (Downloads/logbook.md on Android)
//   - drops the File System Access API code (irrelevant on Android)
// ============================================================

import { METRICS, CAT_CONTAINERS, CATEGORIES, TOTAL_WEIGHT } from './config.js';
import { initDb, getAllEntries, upsertEntry, deleteEntryById, isNativeApp } from './db.js';
import { exportLogbook } from './exporter.js';

// =====================================================
// STATE
// =====================================================
let entries          = [];
let sortMode         = 'date';
let currentEditingId = null;

// =====================================================
// CUSTOM DATE PICKER (unchanged from original)
// =====================================================
const dpInput = () => document.getElementById('inputDate');
const dpPopup = () => document.getElementById('dpPopup');
const dpGrid  = () => document.getElementById('dpGrid');

let dpViewYear      = new Date().getFullYear();
let dpSelectedMonth = new Date().getMonth();
let dpSelectedYear  = new Date().getFullYear();

function initDatePicker() {
  dpInput().value = formatInputDate(dpSelectedYear, dpSelectedMonth);
  renderCalendar();

  dpInput().addEventListener('click', (e) => {
    dpPopup().classList.toggle('open');
    e.stopPropagation();
  });

  document.addEventListener('click', (e) => {
    if (!dpPopup().contains(e.target) && e.target !== dpInput()) {
      dpPopup().classList.remove('open');
    }
  });
}

function renderCalendar() {
  const grid = dpGrid();
  grid.innerHTML = '';
  document.getElementById('dpYearLabel').textContent = dpViewYear;

  const monthNames   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const currentMonth = new Date().getMonth();
  const currentYear  = new Date().getFullYear();

  monthNames.forEach((m, idx) => {
    const el = document.createElement('div');
    el.className = 'dp-month-btn';
    el.textContent = m;

    const isSelected = dpSelectedYear === dpViewYear && dpSelectedMonth === idx;
    const isCurrent  = currentYear   === dpViewYear && currentMonth    === idx;

    if (isSelected)             el.classList.add('selected');
    if (isCurrent && !isSelected) el.classList.add('current');

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      dpSelectedYear  = dpViewYear;
      dpSelectedMonth = idx;
      dpInput().value = formatInputDate(dpSelectedYear, dpSelectedMonth);
      dpPopup().classList.remove('open');
      renderCalendar();
    });

    grid.appendChild(el);
  });
}

function changeYear(offset) {
  dpViewYear += offset;
  renderCalendar();
}

function formatInputDate(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function setCustomDate(dateStr) {
  if (!dateStr) return;
  if (dateStr.includes('-W')) dateStr = weekToDateStr(dateStr);
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    dpSelectedYear  = parseInt(parts[0]);
    dpSelectedMonth = parseInt(parts[1]) - 1;
    dpViewYear      = dpSelectedYear;
    dpInput().value = formatInputDate(dpSelectedYear, dpSelectedMonth);
    renderCalendar();
  }
}

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
  initDatePicker();
  buildSliders();

  try {
    await initDb();
    entries = await getAllEntries();
  } catch (e) {
    console.error('DB init failed:', e);
    toast('Database failed to initialize. See console.', 'error');
  }

  refreshBadge();
  setStatus(
    `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`,
    true
  );
});

// =====================================================
// SLIDER BUILDER  (unchanged)
// =====================================================
function buildSliders() {
  METRICS.forEach(m => {
    const wrap = document.getElementById(CAT_CONTAINERS[m.cat]);
    if (!wrap) return;

    const el = document.createElement('div');
    el.className = 'metric-item';
    el.innerHTML = `
      <div class="metric-header">
        <span class="metric-name">${m.label}</span>
        <span class="metric-val" id="disp-${m.id}">5<span class="denom">/10</span></span>
      </div>
      <div class="slider-wrap">
        <input type="range" class="metric-slider" id="sl-${m.id}"
          min="1" max="10" value="5" step="1"
          data-metric="${m.id}">
      </div>
      <div class="slider-footer">
        <div class="slider-ends">
          <span>${m.lo}</span>
          <span>${m.hi}</span>
        </div>
        <span class="slider-weight${m.high ? ' is-high' : ''}">×${m.weight}</span>
      </div>`;
    wrap.appendChild(el);

    const slider = el.querySelector('input[type="range"]');
    slider.addEventListener('input', () => onSlider(m.id, slider.value));
    setFill(slider, 5);
  });
}

function onSlider(id, v) {
  v = parseInt(v);
  const disp   = document.getElementById(`disp-${id}`);
  const slider = document.getElementById(`sl-${id}`);
  disp.innerHTML = `${v}<span class="denom">/10</span>`;

  if (v <= 3)      disp.className = 'metric-val low-val';
  else if (v >= 8) disp.className = 'metric-val high-val';
  else             disp.className = 'metric-val';

  slider.classList.toggle('is-low',  v <= 3);
  slider.classList.toggle('is-high', v >= 8);

  setFill(slider, v);
  updateScore();
}

function setFill(slider, v) {
  const pct   = ((v - 1) / 9 * 100).toFixed(2);
  const color = v <= 3 ? '#f87171' : v >= 8 ? '#9fb3a0' : '#d4a574';
  slider.style.background =
    `linear-gradient(to right, ${color} ${pct}%, rgba(68,64,60,0.4) ${pct}%)`;
}

// =====================================================
// SCORE CALCULATION
// =====================================================
function getRatings() {
  const r = {};
  METRICS.forEach(m => {
    r[m.id] = parseInt(document.getElementById(`sl-${m.id}`)?.value ?? 5);
  });
  return r;
}

function calcScore(ratings) {
  let ws = 0;
  METRICS.forEach(m => { ws += (ratings[m.id] ?? 5) * m.weight; });
  return (ws / (TOTAL_WEIGHT * 10)) * 100;
}

function updateScore() {
  const ratings = getRatings();
  const score   = calcScore(ratings);
  const pct     = score / 100;
  const circ    = 251.33;
  const offset  = (circ - pct * circ).toFixed(2);

  document.getElementById('scoreDisplay').textContent = score.toFixed(1);
  const arc = document.getElementById('scoreArc');
  arc.setAttribute('stroke-dashoffset', offset);

  let color, desc;
  if      (score >= 85) { color = '#9fb3a0'; desc = 'Exceptional — a serious contender.'; }
  else if (score >= 72) { color = '#b8c9a0'; desc = 'Strong — worth keeping an eye on.'; }
  else if (score >= 58) { color = '#d4a574'; desc = 'Decent — has its merits.'; }
  else if (score >= 42) { color = '#c08050'; desc = 'Mixed — notable drawbacks.'; }
  else                  { color = '#f87171'; desc = 'Challenging — may not suit you.'; }

  arc.setAttribute('stroke', color);
  document.getElementById('scoreDesc').textContent  = desc;
  document.getElementById('scoreDesc').style.color  = color;
}

// =====================================================
// SAVE ENTRY
// =====================================================
async function saveEntry() {
  const city  = document.getElementById('inputCity').value.trim();
  const state = document.getElementById('inputState').value.trim();
  const date  = document.getElementById('inputDate').value;
  const notes = document.getElementById('inputNotes').value.trim();

  if (!city)  { toast('Please enter a city name.', 'error'); return; }
  if (!state) { toast('Please enter a state or country.', 'error'); return; }
  if (!date)  { toast('Please select a date.', 'error'); return; }

  const ratings = getRatings();
  const score   = parseFloat(calcScore(ratings).toFixed(1));

  const entry = {
    id: currentEditingId || Date.now().toString(36),
    city, state, date, score, ratings, notes,
    savedAt: new Date().toISOString()
  };

  if (currentEditingId) {
    const idx = entries.findIndex(e => e.id === currentEditingId);
    if (idx >= 0) {
      entries[idx] = { ...entries[idx], ...entry };
      toast(`Updated: ${city}, ${state}.`, 'success');
    }
  } else {
    // De-duplicate by city/state/date so re-saving the same trip updates rather than duplicates
    const idx = entries.findIndex(e =>
      e.city.toLowerCase()  === city.toLowerCase()  &&
      e.state.toLowerCase() === state.toLowerCase() &&
      e.date === date
    );
    if (idx >= 0) {
      entry.id     = entries[idx].id;
      entries[idx] = { ...entries[idx], ...entry };
      toast(`Updated existing entry: ${city}, ${state}.`, 'success');
    } else {
      entries.push(entry);
      toast(`Saved: ${city}, ${state} — ${score}/100`, 'success');
    }
  }

  resetForm();
  refreshBadge();

  try {
    await upsertEntry(entry);
    setStatus(`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · stored locally`, true);
  } catch (e) {
    console.error('Save failed:', e);
    toast('Save failed. See console.', 'error');
  }
}

// =====================================================
// LOGBOOK VIEW
// =====================================================
function sortBy(mode) {
  sortMode = mode;
  ['date','score','city'].forEach(s => {
    document.getElementById(`sort${cap(s)}`).classList.toggle('active', s === mode);
  });
  renderEntries();
}

function renderEntries() {
  const list        = document.getElementById('entriesList');
  const searchQuery = document.getElementById('searchLogbook').value.toLowerCase();

  document.getElementById('logbookCount').textContent =
    `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;

  if (!entries.length) {
    list.innerHTML = `<div class="empty-state">
      <p class="empty-title">No cities logged yet.</p>
      <small>Rate a city in the New Entry tab to begin.</small>
    </div>`;
    return;
  }

  let filtered = entries;
  if (searchQuery) {
    filtered = entries.filter(e =>
      e.city.toLowerCase().includes(searchQuery) ||
      e.state.toLowerCase().includes(searchQuery) ||
      (e.notes && e.notes.toLowerCase().includes(searchQuery))
    );
  }

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">
      <p class="empty-title">No matches found.</p>
      <small>Try adjusting your search.</small>
    </div>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'date')  return new Date(b.date) - new Date(a.date);
    if (sortMode === 'score') return b.score - a.score;
    return a.city.localeCompare(b.city);
  });

  list.innerHTML = sorted.map(e => cardHTML(e)).join('');
}

function cardHTML(e) {
  const circ   = 251.33;
  const offset = (circ - (e.score / 100) * circ).toFixed(2);
  const color  = e.score >= 75 ? '#9fb3a0' : e.score >= 58 ? '#d4a574' : '#f87171';

  const metricsHTML = CATEGORIES.map(cat => `
    <div class="mini-cat-label">${cat.label}</div>
    ${cat.ids.map(id => {
      const m   = METRICS.find(x => x.id === id);
      const val = e.ratings[id] ?? 0;
      const c   = m.high ? '#d4a574' : '#9fb3a0';
      return `<div class="mini-row">
        <span class="mini-name">${m.label}</span>
        <div class="mini-bar-bg">
          <div class="mini-bar-fill" style="width:${val * 10}%;background:${c};"></div>
        </div>
        <span class="mini-val">${val}/10</span>
      </div>`;
    }).join('')}`).join('');

  const notesHTML = e.notes
    ? `<div class="entry-notes-block">
        <div class="entry-notes-label">Notes</div>
        <div class="entry-notes-text">${esc(e.notes).replace(/\n/g, '<br/>')}</div>
       </div>` : '';

  return `<div class="entry-card" id="card-${e.id}">
    <div class="entry-card-header" data-action="toggle" data-id="${e.id}">
      <svg class="entry-score-svg" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="40" stroke="rgba(68,64,60,0.25)" stroke-width="6"/>
        <circle cx="50" cy="50" r="40" stroke="${color}" stroke-width="6"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(-90 50 50)"/>
        <text x="50" y="56" text-anchor="middle"
          font-family="ui-monospace,monospace" font-size="22" fill="${color}">${e.score}</text>
      </svg>
      <div class="entry-city-block">
        <div class="entry-city-name">${esc(e.city)}<span style="color:var(--text-dim);font-size:1rem;">, ${esc(e.state)}</span></div>
        <div class="entry-meta">${fmtDateDisplay(e.date)}</div>
      </div>
      <svg class="entry-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
    <div class="entry-detail">
      ${metricsHTML}
      ${notesHTML}
      <div class="entry-card-actions">
        <button class="btn btn-ghost"  data-action="edit"   data-id="${e.id}">Edit / Load into Form</button>
        <button class="btn btn-danger" data-action="delete" data-id="${e.id}">Delete</button>
      </div>
    </div>
  </div>`;
}

function toggleCard(id) {
  document.getElementById(`card-${id}`)?.classList.toggle('open');
}

function loadIntoForm(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;

  let dateVal = e.date;
  if (dateVal && dateVal.includes('-W')) dateVal = weekToDateStr(dateVal);

  document.getElementById('inputCity').value  = e.city;
  document.getElementById('inputState').value = e.state;
  setCustomDate(dateVal);
  document.getElementById('inputNotes').value = e.notes ?? '';

  METRICS.forEach(m => {
    const sl = document.getElementById(`sl-${m.id}`);
    if (!sl) return;
    sl.value = e.ratings[m.id] ?? 5;
    onSlider(m.id, sl.value);
  });

  currentEditingId = id;
  document.getElementById('btnSave').textContent = 'Update Entry';

  switchTab('new');
  toast(`Loaded: ${e.city}, ${e.state} for editing`, 'success');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteEntry(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  if (!confirm(`Delete entry for ${e.city}, ${e.state}?`)) return;

  entries = entries.filter(x => x.id !== id);
  refreshBadge();
  renderEntries();

  try {
    await deleteEntryById(id);
    setStatus(`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · stored locally`, true);
    toast('Entry deleted.', '');
  } catch (err) {
    console.error('Delete failed:', err);
    toast('Delete failed. See console.', 'error');
  }
}

// =====================================================
// EXPORT
// =====================================================
async function doExport() {
  if (!entries.length) {
    toast('Nothing to export yet.', 'error');
    return;
  }
  await exportLogbook(entries, toast);
}

// =====================================================
// HELPERS
// =====================================================
function refreshBadge() {
  document.getElementById('entryBadge').textContent = entries.length;
}

function resetForm() {
  document.getElementById('inputCity').value  = '';
  document.getElementById('inputState').value = '';

  const today = new Date();
  setCustomDate(formatInputDate(today.getFullYear(), today.getMonth()));

  document.getElementById('inputNotes').value = '';
  METRICS.forEach(m => {
    const sl = document.getElementById(`sl-${m.id}`);
    if (!sl) return;
    sl.value = 5;
    onSlider(m.id, 5);
  });
  document.getElementById('scoreDisplay').textContent = '—';
  document.getElementById('scoreArc').setAttribute('stroke-dashoffset', '251.33');
  document.getElementById('scoreDesc').textContent = 'Rate the metrics below to calculate your score.';

  currentEditingId = null;
  document.getElementById('btnSave').textContent = 'Save Entry';
}

function switchTab(tab) {
  const isNew = tab === 'new';
  document.getElementById('viewNew').style.display     = isNew ? 'block' : 'none';
  document.getElementById('viewLogbook').style.display = isNew ? 'none'  : 'block';
  document.getElementById('tabNew').classList.toggle('active', isNew);
  document.getElementById('tabLogbook').classList.toggle('active', !isNew);
  if (!isNew) renderEntries();
}

function setStatus(msg, ok) {
  document.getElementById('fileStatus').textContent = msg;
  document.getElementById('fileStatus').className   = ok ? 'file-status connected' : 'file-status';
  document.getElementById('fileDot').className      = ok ? 'file-dot connected'    : 'file-dot';
}

function weekToDateStr(weekStr) {
  const [yearStr, wPart] = weekStr.split('-W');
  const year      = parseInt(yearStr);
  const week      = parseInt(wPart);
  const jan4      = new Date(year, 0, 4);
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (week - 1) * 7);
  return weekStart.toISOString().split('T')[0];
}

function fmtDateDisplay(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('-W')) dateStr = weekToDateStr(dateStr);
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }
  return dateStr;
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

let toastTimer;
function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast show${type ? ' ' + type : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

// =====================================================
// EVENT WIRING
// (Replaces the original inline `onclick="..."` attributes —
//  with ES modules, those globals don't exist by default.)
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  // Top bar
  document.getElementById('btnExport').addEventListener('click', doExport);

  // Tabs
  document.getElementById('tabNew').addEventListener('click',     () => switchTab('new'));
  document.getElementById('tabLogbook').addEventListener('click', () => switchTab('logbook'));

  // Date picker year nav
  document.getElementById('dpPrevYear').addEventListener('click', () => changeYear(-1));
  document.getElementById('dpNextYear').addEventListener('click', () => changeYear(1));

  // Save / reset
  document.getElementById('btnSave').addEventListener('click',  saveEntry);
  document.getElementById('btnClear').addEventListener('click', resetForm);

  // Logbook controls
  document.getElementById('searchLogbook').addEventListener('input', renderEntries);
  document.getElementById('sortDate').addEventListener('click',  () => sortBy('date'));
  document.getElementById('sortScore').addEventListener('click', () => sortBy('score'));
  document.getElementById('sortCity').addEventListener('click',  () => sortBy('city'));

  // Delegated handlers for dynamically-rendered entry cards
  document.getElementById('entriesList').addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-action]');
    if (!t) return;
    const id     = t.dataset.id;
    const action = t.dataset.action;
    if (action === 'toggle') toggleCard(id);
    if (action === 'edit')   loadIntoForm(id);
    if (action === 'delete') deleteEntry(id);
  });
});
