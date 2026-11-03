// Utilidades generales: escape HTML, validación de URLs, claves de duplicados, formato de euros.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtEur(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' }).format(n);
}

// Valida una URL escrita por el usuario. Solo http/https, sin credenciales,
// sin hosts internos ni direcciones IP (evita URLs manipuladas hacia la red interna).
export function validateUrl(raw) {
  let u;
  try {
    u = new URL(String(raw ?? '').trim());
  } catch {
    return { ok: false, reason: 'La URL no es válida' };
  }
  if (!['http:', 'https:'].includes(u.protocol)) return { ok: false, reason: 'Solo se admiten enlaces http o https' };
  if (u.username || u.password) return { ok: false, reason: 'La URL no puede contener usuario ni contraseña' };
  const h = u.hostname.toLowerCase();
  if (h.startsWith('[') || /^[\d.]+$/.test(h) || /^0x/i.test(h)) {
    return { ok: false, reason: 'No se admiten direcciones IP; usa el enlace normal del portal' };
  }
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost') || !h.includes('.')) {
    return { ok: false, reason: 'Dirección interna no permitida' };
  }
  return { ok: true, url: u.toString(), host: h.replace(/^www\./, '') };
}

// Normaliza una URL para detectar el mismo anuncio (quita utm, fbclid, hash...).
export function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    const drop = /^(utm_|fbclid|gclid|ref$|source$)/i;
    const params = [...u.searchParams.entries()].filter(([k]) => !drop.test(k)).sort(([a], [b]) => a.localeCompare(b));
    const q = params.map(([k, v]) => `${k}=${v}`).join('&');
    return `${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '').toLowerCase()}${q ? '?' + q : ''}`;
  } catch {
    return '';
  }
}

// Huella del texto del anuncio para detectar repetidos entre portales.
export function fingerprint(text) {
  const norm = String(text ?? '').toLowerCase().replace(/[^a-z0-9áéíóúüñàèìòùçäöß]/g, '').slice(0, 400);
  if (norm.length < 40) return '';
  let h = 5381;
  for (let i = 0; i < norm.length; i++) h = ((h << 5) + h + norm.charCodeAt(i)) | 0;
  return 'fp' + (h >>> 0).toString(36);
}

export function daysSince(dateStr, now = new Date()) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((now - d) / 86400000);
}

export function fmtNum(n) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' }).format(n);
}
