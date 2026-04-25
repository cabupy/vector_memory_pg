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

async function apiPost(path, body) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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

function classifyBadge(metadata) {
  if (!metadata) return '';
  const src = metadata.classification_source;
  if (src !== 'auto') return '';
  const conf = metadata.classification_confidence;
  const pct = conf != null ? ` ${Math.round(conf * 100)}%` : '';
  return `<span class="badge badge-auto" title="Clasificado automáticamente por IA${pct ? ' · confianza ' + pct : ''}">auto${pct}</span>`;
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
        ${classifyBadge(r.metadata)}
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

// ── View: Reflect ─────────────────────────────────────────────────────────────
async function doReflect() {
  const project = $('#reflect-project').value.trim() || null;
  const repo    = $('#reflect-repo').value.trim()    || null;
  const focus   = $('#reflect-focus').value.trim()   || null;
  const limit   = parseInt($('#reflect-limit').value) || 30;

  const container = $('#reflect-results');
  container.innerHTML = '<div class="spinner"></div>';
  $('#reflect-btn').disabled = true;

  try {
    const body = { limit };
    if (project) body.project   = project;
    if (repo)    body.repo_name = repo;
    if (focus)   body.focus     = focus;

    const data = await apiPost('/reflect', body);

    // La respuesta usa analyzed_count, findings[]{type,description,memory_ids,suggested_action},
    // suggested_new_memories[]{content,memory_type,criticality,tags},
    // suggested_deprecations[] de IDs (strings)
    const {
      analyzed_count = 0,
      summary = '',
      findings = [],
      suggested_new_memories = [],
      suggested_deprecations = [],
    } = data;

    const typeLabel = { contradiction: 'Contradicción', consolidation: 'Consolidar', outdated: 'Desactualizada', redundant: 'Redundante' };

    const findingsHtml = findings.length
      ? findings.map(f => {
          const label = typeLabel[f.type] || f.type || '';
          const ids   = Array.isArray(f.memory_ids) && f.memory_ids.length
            ? `<span class="reflect-ids">${f.memory_ids.map(id => `<span class="public-id" title="Click para copiar" onclick="copyId('${escHtml(id)}')">${escHtml(id)}</span>`).join(' ')}</span>`
            : '';
          const action = f.suggested_action ? `<span class="reflect-action">${escHtml(f.suggested_action)}</span>` : '';
          return `<li class="reflect-item reflect-finding">
            ${label ? `<span class="reflect-type-badge">${label}</span>` : ''}
            ${escHtml(f.description || '')}
            ${ids}${action}
          </li>`;
        }).join('')
      : `<li class="reflect-item reflect-empty">Sin hallazgos relevantes.</li>`;

    const newMemHtml = suggested_new_memories.length
      ? suggested_new_memories.map(m => {
          const meta = [m.memory_type, m.criticality].filter(Boolean).join(' · ');
          const tags = Array.isArray(m.tags) && m.tags.length ? `<div class="card-tags">${m.tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}</div>` : '';
          return `<li class="reflect-item reflect-new">
            ${meta ? `<span class="reflect-type-badge">${escHtml(meta)}</span>` : ''}
            ${escHtml(m.content || '')}
            ${tags}
          </li>`;
        }).join('')
      : `<li class="reflect-item reflect-empty">Sin sugerencias de nuevas memorias.</li>`;

    // suggested_deprecations puede ser array de IDs (strings) u objetos {id, reason}
    const deprHtml = suggested_deprecations.length
      ? suggested_deprecations.map(d => {
          const id     = typeof d === 'string' ? d : (d.id || '');
          const reason = typeof d === 'object' ? (d.reason || '') : '';
          const idHtml = id ? `<span class="public-id" title="Click para copiar" onclick="copyId('${escHtml(id)}')">${escHtml(id)}</span>` : '';
          return `<li class="reflect-item reflect-deprecate">${idHtml}${idHtml && reason ? ' — ' : ''}${escHtml(reason)}</li>`;
        }).join('')
      : `<li class="reflect-item reflect-empty">Sin deprecaciones sugeridas.</li>`;

    container.innerHTML = `
      <div class="reflect-summary">
        <span class="reflect-count">${analyzed_count}</span> memorias analizadas
        ${focus ? `· foco: <em>${escHtml(focus)}</em>` : ''}
        ${summary ? `<div class="reflect-summary-text">${escHtml(summary)}</div>` : ''}
      </div>

      <div class="reflect-section">
        <div class="reflect-section-title reflect-title-finding">Hallazgos (${findings.length})</div>
        <ul class="reflect-list">${findingsHtml}</ul>
      </div>

      <div class="reflect-section">
        <div class="reflect-section-title reflect-title-new">Memorias sugeridas (${suggested_new_memories.length})</div>
        <ul class="reflect-list">${newMemHtml}</ul>
      </div>

      <div class="reflect-section">
        <div class="reflect-section-title reflect-title-deprecate">Deprecaciones sugeridas (${suggested_deprecations.length})</div>
        <ul class="reflect-list">${deprHtml}</ul>
      </div>

      <p class="reflect-footer">Solo sugerencias — nada fue modificado.</p>`;

  } catch (err) {
    container.innerHTML = `<div class="empty"><b>Error</b>${escHtml(err.message)}</div>`;
  } finally {
    $('#reflect-btn').disabled = false;
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

  // Reflect
  $('#reflect-btn').addEventListener('click', doReflect);
  $$('#reflect-project, #reflect-repo, #reflect-focus').forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') doReflect(); });
  });

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
