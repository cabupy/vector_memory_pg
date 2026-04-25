// app.js — vector-memory UI (vanilla JS, sin dependencias)

const API = '';  // mismo origen

// ── Estado ────────────────────────────────────────────────────────────────────
let currentView = 'search';
let searchResults = [];
let recentResults = [];
let timelineData  = [];
let statsData     = null;

// ── DOM helpers ───────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function show(viewId) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.nav-tab').forEach(t => t.classList.remove('active'));
  $(`#view-${viewId}`)?.classList.add('active');
  $(`[data-view="${viewId}"]`)?.classList.add('active');
  currentView = viewId;
}

function toast(msg, duration = 2000) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── API calls ─────────────────────────────────────────────────────────────────
async function apiFetch(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Badges ────────────────────────────────────────────────────────────────────
function statusBadge(status) {
  const s = status || 'active';
  return `<span class="badge badge-${s}">${s}</span>`;
}

function critBadge(crit) {
  if (!crit || crit === 'normal') return '';
  return `<span class="badge badge-${crit}">${crit}</span>`;
}

function typeBadge(type) {
  if (!type) return '';
  return `<span class="badge badge-type">${type}</span>`;
}

function scoreBadge(score) {
  if (score == null) return '';
  const pct = Math.min(100, Math.round(score * 100));
  return `
    <span class="score-bar">
      <span class="score-bar-fill"><span style="width:${pct}%"></span></span>
      ${score}
    </span>`;
}

function tagsHtml(tags) {
  if (!tags || tags.length === 0) return '';
  return `<div class="card-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`;
}

function formatDate(iso) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

// ── Memory card ───────────────────────────────────────────────────────────────
let cardCount = 0;

function memoryCard(r, showScore = false) {
  const id = `card-${cardCount++}`;
  const content = r.content || r.snippet || '';
  const isLong = content.length > 200;
  const contextParts = [r.project, r.repo_name].filter(Boolean);
  const context = contextParts.length ? `<span style="color:var(--muted);font-size:11px">${contextParts.join(' / ')}</span>` : '';

  return `
    <div class="memory-card">
      <div class="card-header">
        <span class="public-id" title="Click para copiar" onclick="copyId('${r.public_id || r.id}')">${r.public_id || r.id || '—'}</span>
        ${typeBadge(r.memory_type || r.source_type)}
        ${statusBadge(r.status)}
        ${critBadge(r.criticality)}
        ${showScore && r.score != null ? scoreBadge(r.score) : ''}
        ${context}
        <span class="card-meta">${formatDate(r.created_at)}</span>
      </div>
      <div class="card-content ${isLong ? 'collapsed' : ''}" id="${id}-content">${escHtml(content)}</div>
      ${isLong ? `<button class="card-expand" onclick="toggleExpand('${id}')">▼ ver más</button>` : ''}
      ${tagsHtml(r.tags)}
    </div>`;
}

function toggleExpand(id) {
  const el = $(`#${id}-content`);
  const btn = el?.nextElementSibling;
  if (!el) return;
  if (el.classList.toggle('collapsed')) {
    btn.textContent = '▼ ver más';
  } else {
    btn.textContent = '▲ ver menos';
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function copyId(id) {
  navigator.clipboard.writeText(id).then(() => toast(`Copiado: ${id}`));
}

// ── Stats pill ────────────────────────────────────────────────────────────────
async function loadStatsPill() {
  try {
    const s = await apiFetch('/stats');
    $('#stats-pill').innerHTML = `<b>${s.total_chunks}</b> memorias · ${s.db_size}`;
  } catch { /* silencioso */ }
}

// ── View: Search ──────────────────────────────────────────────────────────────
async function doSearch() {
  const q = $('#search-input').value.trim();
  if (!q) return;

  const limit  = $('#search-limit').value  || 10;
  const status = $('#search-status').value || '';
  const mtype  = $('#search-type').value   || '';

  let url = `/query?q=${encodeURIComponent(q)}&limit=${limit}`;
  if (status) url += `&status=${status}`;
  if (mtype)  url += `&memory_type=${mtype}`;

  const container = $('#search-results');
  container.innerHTML = '<div class="spinner"></div>';
  $('#search-btn').disabled = true;

  try {
    const data = await apiFetch(url);
    searchResults = data.results || [];
    cardCount = 0;

    if (searchResults.length === 0) {
      container.innerHTML = `<div class="empty"><b>Sin resultados</b>No se encontraron memorias para "${escHtml(q)}"</div>`;
    } else {
      container.innerHTML = `
        <p class="result-meta">${searchResults.length} resultado(s) para "<b>${escHtml(q)}</b>"</p>
        ${searchResults.map(r => memoryCard(r, true)).join('')}`;
    }
  } catch (err) {
    container.innerHTML = `<div class="empty"><b>Error</b>${escHtml(err.message)}</div>`;
  } finally {
    $('#search-btn').disabled = false;
  }
}

// ── View: Recent ──────────────────────────────────────────────────────────────
async function loadRecent() {
  const limit = $('#recent-limit').value || 20;
  const container = $('#recent-results');
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const data = await apiFetch(`/recent?limit=${limit}`);
    recentResults = data.results || [];
    cardCount = 0;

    if (recentResults.length === 0) {
      container.innerHTML = `<div class="empty"><b>Sin memorias</b>No hay memorias guardadas aún.</div>`;
    } else {
      container.innerHTML = `
        <p class="result-meta">${recentResults.length} memorias más recientes</p>
        ${recentResults.map(r => memoryCard(r)).join('')}`;
    }
  } catch (err) {
    container.innerHTML = `<div class="empty"><b>Error</b>${escHtml(err.message)}</div>`;
  }
}

// ── View: Timeline ────────────────────────────────────────────────────────────
async function loadTimeline() {
  const limit = $('#timeline-limit').value || 100;
  const from  = $('#timeline-from').value  || '';
  const to    = $('#timeline-to').value    || '';
  const container = $('#timeline-results');
  container.innerHTML = '<div class="spinner"></div>';

  let url = `/timeline?limit=${limit}`;
  if (from) url += `&from=${from}`;
  if (to)   url += `&to=${to}`;

  try {
    const data = await apiFetch(url);
    timelineData = data.timeline || [];
    cardCount = 0;

    if (timelineData.length === 0) {
      container.innerHTML = `<div class="empty"><b>Sin datos</b>No hay memorias en el período.</div>`;
    } else {
      container.innerHTML = timelineData.map(group => `
        <div class="timeline-group">
          <div class="timeline-date">${group.date} <span>${group.count} memori${group.count === 1 ? 'a' : 'as'}</span></div>
          ${group.memories.map(r => memoryCard(r)).join('')}
        </div>`).join('');
    }
  } catch (err) {
    container.innerHTML = `<div class="empty"><b>Error</b>${escHtml(err.message)}</div>`;
  }
}

// ── View: Stats ───────────────────────────────────────────────────────────────
async function loadStats() {
  const container = $('#stats-content');
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const s = await apiFetch('/stats');
    statsData = s;

    const byType = s.by_type || {};
    const maxCount = Math.max(1, ...Object.values(byType));

    const typeBars = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `
        <div class="type-row">
          <span class="type-name">${type}</span>
          <div class="type-bar"><span style="width:${Math.round(count/maxCount*100)}%"></span></div>
          <span class="type-count">${count}</span>
        </div>`).join('');

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total memorias</div>
          <div class="stat-value">${s.total_chunks}</div>
          <div class="stat-sub">${s.with_embeddings} con embedding</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tamaño DB</div>
          <div class="stat-value" style="font-size:22px">${s.db_size}</div>
          <div class="stat-sub">PostgreSQL + pgvector</div>
        </div>
        <div class="stat-card" style="grid-column: span 2">
          <div class="stat-label" style="margin-bottom:14px">Distribución por tipo</div>
          <div class="type-bars">${typeBars || '<span style="color:var(--muted)">Sin datos</span>'}</div>
        </div>
      </div>`;
  } catch (err) {
    container.innerHTML = `<div class="empty"><b>Error</b>${escHtml(err.message)}</div>`;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Nav tabs
  $$('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const v = tab.dataset.view;
      show(v);
      if (v === 'recent')   loadRecent();
      if (v === 'timeline') loadTimeline();
      if (v === 'stats')    loadStats();
    });
  });

  // Search form
  $('#search-btn').addEventListener('click', doSearch);
  $('#search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });

  // Recent refresh
  $('#recent-refresh').addEventListener('click', loadRecent);
  $('#recent-limit').addEventListener('change', loadRecent);

  // Timeline refresh
  $('#timeline-refresh').addEventListener('click', loadTimeline);

  // Stats refresh
  $('#stats-refresh').addEventListener('click', loadStats);

  // Keyboard shortcut: / → focus search
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      show('search');
      $('#search-input').focus();
    }
  });

  // Init
  loadStatsPill();
  show('search');
  $('#search-input').focus();
});

// Expose for inline onclick
window.copyId = copyId;
window.toggleExpand = toggleExpand;
