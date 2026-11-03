// Almacenamiento local (en este navegador/móvil). Más adelante se sincronizará con la base de datos.
import { DEFAULT_SETTINGS } from './score.js';

const KEY_ADS = 'rce.ads.v1';
const KEY_SET = 'rce.settings.v1';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const store = {
  loadAds: () => (Array.isArray(read(KEY_ADS, [])) ? read(KEY_ADS, []) : []),
  saveAds: (ads) => write(KEY_ADS, ads),
  loadSettings: () => ({ ...DEFAULT_SETTINGS, ...read(KEY_SET, {}) }),
  saveSettings: (s) => write(KEY_SET, s),
  clearAll: () => { try { localStorage.removeItem(KEY_ADS); localStorage.removeItem(KEY_SET); } catch { /* ignorar */ } },
};
