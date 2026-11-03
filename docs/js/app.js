// RADAR CAMPER EUROPA · interfaz (modo local). Todo el contenido dinámico pasa por esc() antes de pintarse.
import { analyzeText, TYPES } from './parse.js';
import { MOISTURE_LABELS } from './risk.js';
import { COST_ITEMS, REGIMES, computeCost, STATUS_TEXT } from './cost.js';
import { scoreAd, concludeCompare, DEFAULT_SETTINGS } from './score.js';
import { esc, fmtEur, fmtNum, validateUrl, normalizeUrl, fingerprint } from './util.js';
import { store } from './store.js';

const state = { tab: 'analizar', draft: newDraft(), ads: [], settings: { ...DEFAULT_SETTINGS }, compare: [], filter: 'todos' };
export const getState = () => state;

function newDraft() {
  return { id: null, url: '', title: '', text: '', photos: '', posted: '', regime: 'otro', costOpt: {}, costCons: {}, f: null, analysis: null };
}

const $ = (s, r = document) => r.querySelector(s);
const NS = 'NO ESPECIFICADO';
const val = (v) => (v === null || v === undefined || v === '' ? NS : esc(v));

function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 3200);
}

function compute(d) {
  const opt = { ...d.costOpt, price: d.f.price };
  const cons = { ...d.costCons, price: d.f.price };
  const cost = computeCost(opt, cons, state.settings.budget);
  const result = scoreAd({ fields: { ...d.f, photos: Number(d.photos) || 0 }, analysis: d.analysis, cost, settings: state.settings });
  return { cost, result };
}

const adName = (a) => [a.f.brand || 'Marca NO ESPECIFICADA', a.f.base, a.f.year].filter(Boolean).join(' · ');

// ---------- Vistas ----------
function viewAnalizar() {
  const d = state.draft;
  return `<h2>Analizar un anuncio</h2>
  <div class="card">
    <label>Enlace del anuncio (opcional)</label>
    <input data-bind="url" inputmode="url" autocomplete="off" placeholder="https://..." value="${esc(d.url)}">
    <label>Título (opcional)</label>
    <input data-bind="title" autocomplete="off" value="${esc(d.title)}">
    <label>Texto completo del anuncio (cópialo del portal, en cualquier idioma)</label>
    <textarea data-bind="text" placeholder="Pega aquí el texto del anuncio...">${esc(d.text)}</textarea>
    <div class="grid2">
      <div><label>Nº de fotos</label><input data-bind="photos" type="number" min="0" inputmode="numeric" value="${esc(d.photos)}"></div>
      <div><label>Fecha de publicación</label><input data-bind="posted" type="date" value="${esc(d.posted)}"></div>
    </div>
    <div class="row"><button data-act="analyze">Analizar</button><button class="sec" data-act="reset">Limpiar</button></div>
    <p class="mut small">Analizo solo el texto que pegues; no accedo al portal. El enlace sirve para abrir el anuncio original.</p>
  </div>
  <div id="result">${d.analysis ? viewResultShell() : ''}</div>`;
}

function selectOpts(map, cur, withBlank) {
  return (withBlank ? `<option value="">${NS}</option>` : '') + Object.entries(map).map(([k, v]) => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
}

function viewResultShell() {
  const d = state.draft;
  const f = d.f;
  const num = (k) => `<input data-f="${k}" type="number" inputmode="numeric" placeholder="${NS}" value="${esc(f[k] ?? '')}">`;
  const costRows = COST_ITEMS.map((it) => {
    if (it.derived) return `<div class="cost-row"><div class="nm"><b>${esc(it.label)}</b> <span class="mut small">(del anuncio)</span></div><div class="in"><b id="priceShow">${fmtEur(f.price)}</b></div></div>`;
    return `<div class="cost-row" data-row="${it.id}"><div class="nm">${esc(it.label)}${it.required ? '' : ' <span class="mut small">(opcional)</span>'}</div>
      <div class="in"><input data-cost="opt" data-id="${it.id}" type="number" inputmode="decimal" min="0" placeholder="Optimista €" value="${esc(d.costOpt[it.id] ?? '')}">
      <input data-cost="cons" data-id="${it.id}" type="number" inputmode="decimal" min="0" placeholder="Conservador €" value="${esc(d.costCons[it.id] ?? '')}">
      <button class="sec small" data-act="copycons" data-id="${it.id}" title="Copiar optimista a conservador">↔</button></div></div>`;
  }).join('');
  return `<div class="card"><h3>Datos extraídos (corrígelos si hace falta)</h3>
    <div class="grid2">
      <div><label>Precio de venta (€)</label>${num('price')}</div>
      <div><label>Año</label>${num('year')}</div>
      <div><label>Kilómetros</label>${num('km')}</div>
      <div><label>Marca</label><input data-f="brand" placeholder="${NS}" value="${esc(f.brand ?? '')}"></div>
      <div><label>Plazas homologadas para viajar</label>${num('seatsHomologated')}</div>
      <div><label>Plazas para dormir</label>${num('seatsSleeping')}</div>
    </div>
    <label>Tipo de vehículo</label><select data-f="type">${selectOpts(TYPES, f.type, true)}</select>
    <label>Humedades</label><select data-f="moisture">${selectOpts(MOISTURE_LABELS, f.moisture, false)}</select>
    <p class="mut small">Base: ${val(f.base)} · Combustible: ${val(f.fuel)} · Potencia: ${f.power ? esc(f.power) + ' CV' : NS}</p>
    <p class="mut small">Equipamiento mencionado: ${equipText(d.analysis.equipment)}</p>
    ${d.analysis.notes.map((n) => `<div class="alert info">${esc(n)}</div>`).join('')}
  </div>
  <div class="card"><h3>Calculadora de coste hasta Málaga</h3>
    <label>Régimen de compra</label><select data-regime>${selectOpts(Object.fromEntries(REGIMES.map((r) => [r.id, r.label])), d.regime, false)}</select>
    <p class="mut small">No relleno importes legales ni fiscales por ti. Introduce lo que sepas; lo que falte queda como PENDIENTE. Verifica los importes definitivos con una gestoría, la ITV, la DGT y la AEAT antes de comprar.</p>
    <div class="cost-row"><div class="nm mut small">Concepto</div><div class="in mut small"><span>Optimista</span><span>Conservador</span></div></div>
    ${costRows}
  </div>
  <div id="summary"></div>`;
}

function equipText(e) {
  const names = { bano: 'baño', ducha: 'ducha', calefaccion: 'calefacción', nevera: 'frigorífico', solar: 'placa solar', aire: 'aire acondicionado' };
  const yes = Object.entries(names).filter(([k]) => e[k]).map(([, n]) => n);
  return yes.length ? esc(yes.join(', ')) + ` · el resto: ${NS}` : NS;
}

function costBlock(cost) {
  const { opt, cons } = cost;
  let big;
  let sub = 'PRECIO TOTAL ESTIMADO EN MÁLAGA';
  if (opt.total !== null && cons.total !== null) big = `${fmtEur(opt.total)} – ${fmtEur(cons.total)}`;
  else if (cons.total !== null) { big = fmtEur(cons.total); sub += ' (solo escenario conservador)'; }
  else if (opt.total !== null) { big = fmtEur(opt.total); sub += ' (solo escenario optimista)'; }
  else { big = 'COSTE PENDIENTE DE VERIFICAR'; sub = `Subtotal ya introducido: ${fmtEur(opt.subtotal)} · faltan ${cost.missing.length} partida(s)`; }
  const cls = { DENTRO: 'ok', AJUSTADO: 'warn', SUPERA: 'bad', PENDIENTE: 'warn' }[cost.status];
  const ref = opt.total ?? cons.total ?? opt.subtotal;
  const pct = Math.min(100, Math.round((ref / cost.budget) * 100));
  return `<div class="big ${cost.status === 'PENDIENTE' ? 'warn' : cls}">${big}</div><div class="mut small">${sub}</div>
    <p class="${cls}"><b>${STATUS_TEXT[cost.status]}</b> · límite ${fmtEur(cost.budget)}</p>
    <div class="bar"><i style="width:${pct}%"></i></div>
    ${cost.margin !== null ? `<p class="small">Margen de incertidumbre entre escenarios: <b>${fmtEur(cost.margin)}</b></p>` : ''}
    ${cost.inconsistencies.length ? `<div class="alert media">En algún concepto el conservador es menor que el optimista: revísalo.</div>` : ''}
    ${cost.missing.length ? `<details><summary>Qué falta por verificar (${cost.missing.length})</summary><ul class="small">${cost.missing.map((id) => `<li>${esc(COST_ITEMS.find((i) => i.id === id).label)}</li>`).join('')}</ul></details>` : ''}`;
}

function updateSummary() {
  const box = $('#summary');
  if (!box || !state.draft.f) return;
  const d = state.draft;
  const { cost, result } = compute(d);
  const ps = $('#priceShow');
  if (ps) ps.textContent = fmtEur(d.f.price);
  const flags = d.analysis.flags;
  const moStatus = d.f.moisture;
  const moCls = { confirmada: '', descartada_doc: 'info', vendedor_niega: 'media', no_mencionada: 'media', desconocida: 'media' }[moStatus];
  const v = d.url.trim() ? validateUrl(d.url) : null;
  box.innerHTML = `<div class="card">
    <div class="row"><span class="badge b-${result.label}">${result.label}</span><b>Puntuación ${result.total}/100</b><span class="mut small">Calidad del anuncio ${result.info.total}/100</span></div>
    ${result.discard.map((x) => `<div class="alert">⛔ ${esc(x)}</div>`).join('')}
    ${flags.map((fl) => `<div class="alert ${fl.sev === 'alta' ? '' : 'media'}">⚠️ ${esc(fl.label)}${fl.evidence ? ` <span class="mut small">("${esc(fl.evidence)}")</span>` : ''}</div>`).join('')}
    <div class="alert ${moCls}">💧 Humedades: <b>${esc(MOISTURE_LABELS[moStatus])}</b></div>
    ${result.warnings.map((x) => `<div class="alert info">ℹ️ ${esc(x)}</div>`).join('')}
  </div>
  <div class="card">${costBlock(cost)}</div>
  <div class="card"><details><summary>Por qué esta puntuación</summary>
    <table><tr><th>Apartado</th><th>Pts</th><th>Motivo</th></tr>${result.parts.map((p) => `<tr><td>${esc(p.label)}</td><td>${p.pts}/${p.max}</td><td>${esc(p.why)}</td></tr>`).join('')}</table>
    <h3>Calidad del anuncio</h3>
    <table>${result.info.parts.map((p) => `<tr><td>${esc(p.label)}</td><td>${p.pts}/${p.max}</td><td>${esc(p.why)}</td></tr>`).join('')}</table>
  </details>
  <div class="row"><button data-act="save">Guardar</button>
    ${v && v.ok ? `<a class="btn sec" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">Ver anuncio original</a>` : ''}
    ${d.text.trim() ? `<a class="btn sec" href="https://translate.google.com/?sl=auto&tl=es&op=translate&text=${encodeURIComponent(d.text.slice(0, 1800))}" target="_blank" rel="noopener noreferrer">Traducir (Google)</a>` : ''}</div>
  ${v && !v.ok ? `<div class="alert media">Enlace no válido: ${esc(v.reason)}</div>` : ''}
  <p class="disc">Puntuación orientativa basada solo en el texto del anuncio. No sustituye a una inspección mecánica ni a la revisión de la célula. Verifica costes con gestoría, ITV, DGT y AEAT antes de comprar. El botón Traducir envía el texto a Google solo si lo pulsas.</p></div>`;
}

function filtered() {
  const rows = state.ads.map((a) => ({ ad: a, ...compute(a) }));
  const f = state.filter;
  return rows.filter((r) => f === 'todos' || (f === 'favoritos' && r.ad.favorite) || (f === 'dentro' && r.cost.status === 'DENTRO') || r.result.label === f)
    .sort((a, b) => Number(b.ad.favorite) - Number(a.ad.favorite) || b.result.total - a.result.total);
}

function viewGuardados() {
  const rows = filtered();
  const opts = { todos: 'Todos', favoritos: 'Favoritos', dentro: 'Dentro de presupuesto', OPORTUNIDAD: 'OPORTUNIDAD', INTERESANTE: 'INTERESANTE', SEGUIR: 'SEGUIR', DESCARTAR: 'DESCARTAR' };
  const cards = rows.map(({ ad, cost, result }) => {
    const cmp = state.compare.includes(ad.id);
    const price = ad.f.price;
    const changed = ad.history.length > 1;
    const totalTxt = cost.opt.total !== null && cost.cons.total !== null ? `${fmtEur(cost.opt.total)} – ${fmtEur(cost.cons.total)}` : 'COSTE PENDIENTE DE VERIFICAR';
    return `<div class="card" data-ad="${esc(ad.id)}">
      <div class="row" style="justify-content:space-between"><b>${esc(adName(ad))}</b><button class="star ${ad.favorite ? 'on' : ''}" data-act="fav" data-id="${esc(ad.id)}" aria-label="Favorito">${ad.favorite ? '★' : '☆'}</button></div>
      <div class="row"><span class="badge b-${result.label}">${result.label}</span><b>${result.total}/100</b>${ad.active ? '' : '<span class="badge b-DESCARTAR">NO DISPONIBLE</span>'}</div>
      <p class="small">Precio: <b>${fmtEur(price)}</b>${changed ? ` <span class="mut">(inicial ${fmtEur(ad.firstPrice)})</span>` : ''} · Total estimado en Málaga: <b>${totalTxt}</b></p>
      <p class="small mut">${val(ad.f.km)} km · plazas viaje ${val(ad.f.seatsHomologated)} · dormir ${val(ad.f.seatsSleeping)} · ${esc(MOISTURE_LABELS[ad.f.moisture])}</p>
      ${ad.analysis.flags.map((fl) => `<div class="alert ${fl.sev === 'alta' ? '' : 'media'}">⚠️ ${esc(fl.label)}</div>`).join('')}
      <details><summary>Historial y notas</summary>
        <p class="small mut">Primera vez: ${esc(ad.createdAt.slice(0, 10))} · Última comprobación: ${esc(ad.lastChecked.slice(0, 10))}</p>
        <ul class="small">${ad.history.map((h) => `<li>${esc(h.date.slice(0, 10))}: ${fmtEur(h.price)}</li>`).join('')}</ul>
        <label>Notas personales</label><textarea data-note="${esc(ad.id)}" style="min-height:70px">${esc(ad.notes || '')}</textarea>
        <label>Registrar nuevo precio (€)</label><div class="row"><input type="number" inputmode="numeric" data-newprice="${esc(ad.id)}" style="max-width:150px"><button class="sec small" data-act="newprice" data-id="${esc(ad.id)}">Registrar</button></div>
      </details>
      <div class="row">
        <label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" style="width:auto" data-act="cmp" data-id="${esc(ad.id)}" ${cmp ? 'checked' : ''}> Comparar</label>
        <button class="sec small" data-act="load" data-id="${esc(ad.id)}">Abrir análisis</button>
        <button class="sec small" data-act="toggleactive" data-id="${esc(ad.id)}">${ad.active ? 'Marcar no disponible' : 'Marcar disponible'}</button>
        ${ad.url ? `<a class="btn sec small" href="${esc(ad.url)}" target="_blank" rel="noopener noreferrer">Original</a>` : ''}
        <button class="danger small" data-act="del" data-id="${esc(ad.id)}">Eliminar</button>
      </div></div>`;
  }).join('');
  return `<h2>Anuncios guardados (${state.ads.length})</h2>
    <label>Mostrar</label><select data-filter>${selectOpts(opts, state.filter, false)}</select>
    ${cards || '<div class="card mut">No hay anuncios guardados con este filtro. Analiza un anuncio y pulsa Guardar.</div>'}
    ${state.compare.length ? `<div class="row"><button data-act="gocompare">Comparar ${state.compare.length} seleccionado(s)</button></div>` : ''}`;
}

function bestSet(vals, mode) {
  const nums = vals.filter((v) => typeof v === 'number');
  if (nums.length < 2) return new Set();
  const target = mode === 'min' ? Math.min(...nums) : Math.max(...nums);
  return new Set(vals.map((v, i) => (v === target ? i : -1)).filter((i) => i >= 0));
}

function viewComparar() {
  const rows = state.compare.map((id) => state.ads.find((a) => a.id === id)).filter(Boolean).map((ad) => ({ ad, name: adName(ad), ...compute(ad) }));
  if (rows.length < 2) return `<h2>Comparador</h2><div class="card mut">Selecciona entre 2 y 4 anuncios en Guardados (casilla “Comparar”).</div>`;
  const line = (label, cells, best = new Set()) => `<tr><th>${esc(label)}</th>${cells.map((c, i) => `<td class="${best.has(i) ? 'best' : ''}">${c}</td>`).join('')}</tr>`;
  const num = (v, fmt = (x) => x) => (typeof v === 'number' ? fmt(v) : NS);
  const T = rows.map((r) => r.cost.cons.total);
  const html = `<h2>Comparador</h2><div class="card" style="overflow-x:auto"><table>
    <tr><th></th>${rows.map((r) => `<th>${esc(r.name)}</th>`).join('')}</tr>
    ${line('Precio', rows.map((r) => num(r.ad.f.price, fmtEur)), bestSet(rows.map((r) => r.ad.f.price), 'min'))}
    ${line('Total estimado en Málaga', rows.map((r) => (r.cost.opt.total !== null && r.cost.cons.total !== null ? `${fmtEur(r.cost.opt.total)} – ${fmtEur(r.cost.cons.total)}` : 'PENDIENTE DE VERIFICAR')), bestSet(T, 'min'))}
    ${line('Estado del coste', rows.map((r) => esc(r.cost.status)))}
    ${line('Año', rows.map((r) => num(r.ad.f.year)), bestSet(rows.map((r) => r.ad.f.year), 'max'))}
    ${line('Kilómetros', rows.map((r) => num(r.ad.f.km, fmtNum)), bestSet(rows.map((r) => r.ad.f.km), 'min'))}
    ${line('Combustible / potencia', rows.map((r) => `${val(r.ad.f.fuel)} / ${r.ad.f.power ? esc(r.ad.f.power) + ' CV' : NS}`))}
    ${line('Plazas para viajar', rows.map((r) => num(r.ad.f.seatsHomologated)), bestSet(rows.map((r) => r.ad.f.seatsHomologated), 'max'))}
    ${line('Plazas para dormir', rows.map((r) => num(r.ad.f.seatsSleeping)), bestSet(rows.map((r) => r.ad.f.seatsSleeping), 'max'))}
    ${line('Equipamiento', rows.map((r) => equipText(r.ad.analysis.equipment)))}
    ${line('ITV / TÜV / APK', rows.map((r) => (r.ad.analysis.itvMentioned ? 'Mencionada (verificar fecha)' : NS)))}
    ${line('Humedades', rows.map((r) => esc(MOISTURE_LABELS[r.ad.f.moisture])))}
    ${line('Riesgos', rows.map((r) => (r.ad.analysis.flags.length ? esc(r.ad.analysis.flags.map((x) => x.label).join('; ')) : 'Ninguno detectado en el texto')))}
    ${line('Puntuación', rows.map((r) => `${r.result.total}/100`), bestSet(rows.map((r) => r.result.total), 'max'))}
    ${line('Clasificación', rows.map((r) => `<span class="badge b-${r.result.label}">${r.result.label}</span>`))}
  </table></div>
  <div class="card"><b>Conclusión automática</b><p>${esc(concludeCompare(rows))}</p></div>`;
  return html;
}

function viewAjustes() {
  const s = state.settings;
  const inp = (k, label) => `<div><label>${label}</label><input data-set="${k}" type="number" inputmode="numeric" value="${esc(s[k])}"></div>`;
  return `<h2>Tus condiciones de compra</h2><div class="card"><div class="grid2">
    ${inp('budget', 'Presupuesto máximo total (€)')}${inp('lowPrice', 'Aviso de precio sospechosamente bajo (€)')}
    ${inp('prefMin', 'Compra preferente desde (€)')}${inp('prefMax', 'Compra preferente hasta (€)')}
    ${inp('minSeats', 'Mín. plazas homologadas')}${inp('minSleep', 'Mín. plazas para dormir')}</div>
    <div class="row"><button data-act="saveset">Guardar ajustes</button></div></div>
  <h2>Estado del sistema</h2><div class="card small">
    <p><b>Búsqueda automática:</b> <span class="bad">NO DISPONIBLE</span> todavía. Última búsqueda: —. Próxima: —.</p>
    <p><b>Fuentes integradas:</b> ninguna (todas pendientes de comprobar). Mientras tanto: importación manual (pegar texto) y búsqueda manual en los portales.</p>
    <p class="mut">Búsqueda manual (abren el portal en otra pestaña; busca “Wohnmobil”, “camping-car”, “camper”…):</p>
    <p>${[['mobile.de', 'https://www.mobile.de/'], ['AutoScout24', 'https://www.autoscout24.de/'], ['Kleinanzeigen', 'https://www.kleinanzeigen.de/'], ['Leboncoin', 'https://www.leboncoin.fr/'], ['Subito', 'https://www.subito.it/'], ['Marktplaats', 'https://www.marktplaats.nl/'], ['Wallapop', 'https://es.wallapop.com/'], ['Milanuncios', 'https://www.milanuncios.com/']].map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${n}</a>`).join(' · ')}</p></div>
  <h2>Datos</h2><div class="card"><div class="row">
    <button class="sec" data-act="export">Exportar copia (JSON)</button>
    <label class="btn sec" style="margin:0">Importar copia<input type="file" accept="application/json" data-import style="display:none"></label>
    <button class="danger" data-act="clearall">Borrar todo</button></div>
    <p class="mut small">Los datos están solo en este navegador. Si borras los datos del navegador, se pierden: exporta una copia de vez en cuando.</p></div>`;
}

// ---------- Render y eventos ----------
function render() {
  const v = $('#view');
  v.innerHTML = { analizar: viewAnalizar, guardados: viewGuardados, comparar: viewComparar, ajustes: viewAjustes }[state.tab]();
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
  if (state.tab === 'analizar') updateSummary();
}

function go(tab) { state.tab = tab; render(); window.scrollTo?.(0, 0); }

const toNum = (v) => (v === '' || v === null || Number.isNaN(Number(v)) ? null : Number(v));

function snapshot(d, url, keys) {
  return JSON.parse(JSON.stringify({ url, title: d.title, text: d.text, photos: d.photos, posted: d.posted, regime: d.regime, costOpt: d.costOpt, costCons: d.costCons, f: d.f, analysis: d.analysis, keys }));
}

function saveDraft() {
  const d = state.draft;
  if (!d.analysis) return;
  let url = '';
  if (d.url.trim()) {
    const v = validateUrl(d.url);
    if (!v.ok) { toast(v.reason); return; }
    url = v.url;
  }
  const keys = [url ? normalizeUrl(url) : '', fingerprint(d.text)].filter(Boolean);
  const now = new Date().toISOString();
  const existing = state.ads.find((a) => (d.id && a.id === d.id) || a.keys.some((k) => keys.includes(k)));
  if (existing) {
    const oldPrice = existing.f.price;
    const keep = { id: existing.id, createdAt: existing.createdAt, favorite: existing.favorite, notes: existing.notes, history: existing.history, firstPrice: existing.firstPrice };
    Object.assign(existing, snapshot(d, url || existing.url, [...new Set([...existing.keys, ...keys])]), keep);
    if (oldPrice !== d.f.price) existing.history.push({ date: now, price: d.f.price });
    existing.lastChecked = now;
    existing.active = true;
    d.id = existing.id;
    toast(oldPrice !== d.f.price ? 'Ya estaba guardado (posible duplicado): precio actualizado en el historial' : 'Ya estaba guardado (posible duplicado): datos actualizados');
  } else {
    const id = (globalThis.crypto?.randomUUID?.() || `ad${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
    state.ads.push({ id, createdAt: now, lastChecked: now, favorite: false, active: true, notes: '', firstPrice: d.f.price, history: [{ date: now, price: d.f.price }], ...snapshot(d, url, keys) });
    d.id = id;
    toast('Guardado');
  }
  if (!store.saveAds(state.ads)) toast('No se pudo guardar en este navegador (¿modo privado o sin espacio?)');
}

function onClick(e) {
  const tabBtn = e.target.closest('#tabs button');
  if (tabBtn) return go(tabBtn.dataset.tab);
  const el = e.target.closest('[data-act]');
  if (!el || el.type === 'checkbox') return;
  const id = el.dataset.id;
  const ad = id ? state.ads.find((a) => a.id === id) : null;
  switch (el.dataset.act) {
    case 'analyze': {
      const d = state.draft;
      if (d.text.trim().length < 20) return toast('Pega primero el texto del anuncio');
      d.analysis = analyzeText(d.text, { title: d.title, postedDate: d.posted });
      d.f = { ...d.analysis.fields, moisture: d.analysis.moisture.status };
      d.costOpt = {}; d.costCons = {}; d.id = null;
      render();
      $('#result')?.scrollIntoView?.({ behavior: 'smooth' });
      break;
    }
    case 'reset': state.draft = newDraft(); render(); break;
    case 'save': saveDraft(); break;
    case 'copycons': {
      const o = $(`[data-cost="opt"][data-id="${id}"]`); const c = $(`[data-cost="cons"][data-id="${id}"]`);
      if (o && c) { c.value = o.value; c.dispatchEvent(new Event('input', { bubbles: true })); }
      break;
    }
    case 'fav': if (ad) { ad.favorite = !ad.favorite; store.saveAds(state.ads); render(); } break;
    case 'del': if (ad && globalThis.confirm?.('¿Eliminar este anuncio guardado?') !== false) { state.ads = state.ads.filter((a) => a !== ad); state.compare = state.compare.filter((x) => x !== id); store.saveAds(state.ads); render(); } break;
    case 'toggleactive': if (ad) { ad.active = !ad.active; ad.lastChecked = new Date().toISOString(); store.saveAds(state.ads); render(); } break;
    case 'newprice': {
      const inp = $(`[data-newprice="${id}"]`); const p = toNum(inp?.value);
      if (!ad || p === null || p <= 0) return toast('Escribe un precio válido');
      if (p !== ad.f.price) { const bajada = p < ad.f.price; ad.history.push({ date: new Date().toISOString(), price: p }); ad.f.price = p; toast(bajada ? 'Bajada de precio registrada' : 'Cambio de precio registrado'); }
      ad.lastChecked = new Date().toISOString(); store.saveAds(state.ads); render(); break;
    }
    case 'load': if (ad) { state.draft = { ...newDraft(), ...JSON.parse(JSON.stringify(ad)), id: ad.id }; go('analizar'); } break;
    case 'gocompare': go('comparar'); break;
    case 'saveset': {
      const s = {};
      document.querySelectorAll('[data-set]').forEach((i) => { const n = toNum(i.value); if (n !== null && n >= 0) s[i.dataset.set] = n; });
      state.settings = { ...state.settings, ...s }; store.saveSettings(state.settings); toast('Ajustes guardados'); break;
    }
    case 'export': {
      const blob = new Blob([JSON.stringify({ app: 'radar-camper-europa', version: 1, settings: state.settings, ads: state.ads }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `radar-camper-copia-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000); break;
    }
    case 'clearall': if (globalThis.confirm?.('Se borrarán todos los anuncios y ajustes de este móvil. ¿Continuar?') !== false) { store.clearAll(); state.ads = []; state.compare = []; state.settings = store.loadSettings(); state.draft = newDraft(); render(); toast('Datos borrados'); } break;
    default:
  }
}

function onInput(e) {
  const t = e.target;
  const d = state.draft;
  if (t.dataset.bind) { d[t.dataset.bind] = t.value; if (['url', 'title', 'photos', 'posted'].includes(t.dataset.bind) && d.analysis) updateSummary(); }
  else if (t.dataset.f && d.f) { d.f[t.dataset.f] = t.tagName === 'SELECT' || t.dataset.f === 'brand' ? (t.value || null) : toNum(t.value); updateSummary(); }
  else if (t.dataset.cost) { const map = t.dataset.cost === 'opt' ? d.costOpt : d.costCons; const n = toNum(t.value); if (n === null) delete map[t.dataset.id]; else map[t.dataset.id] = n; updateSummary(); }
  else if (t.dataset.note !== undefined) { const ad = state.ads.find((a) => a.id === t.dataset.note); if (ad) { ad.notes = t.value; store.saveAds(state.ads); } }
}

function onChange(e) {
  const t = e.target;
  if (t.dataset.regime !== undefined) state.draft.regime = t.value;
  else if (t.dataset.filter !== undefined) { state.filter = t.value; render(); }
  else if (t.dataset.act === 'cmp') {
    const id = t.dataset.id;
    if (t.checked) { if (state.compare.length >= 4) { t.checked = false; return toast('Máximo 4 vehículos'); } state.compare.push(id); }
    else state.compare = state.compare.filter((x) => x !== id);
    render();
  } else if (t.dataset.import !== undefined && t.files?.[0]) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (data.app !== 'radar-camper-europa' || !Array.isArray(data.ads)) throw new Error('formato');
        const ok = data.ads.filter((a) => a && typeof a.id === 'string' && a.f && a.analysis && Array.isArray(a.history) && Array.isArray(a.keys));
        const ids = new Set(state.ads.map((a) => a.id));
        ok.forEach((a) => { if (!ids.has(a.id)) state.ads.push(a); });
        store.saveAds(state.ads); render(); toast(`Importados ${ok.length} anuncio(s)`);
      } catch { toast('El archivo no es una copia válida'); }
    };
    rd.readAsText(t.files[0]);
  }
}

export function start() {
  state.ads = store.loadAds();
  state.settings = store.loadSettings();
  const root = document.body;
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  render();
}

if (typeof document !== 'undefined' && document.getElementById('view') && !globalThis.__RCE_NO_AUTOSTART) start();
