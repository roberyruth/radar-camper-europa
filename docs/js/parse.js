// Extracción de datos de un anuncio pegado como texto. No inventa nada: lo que no aparece es null.
import { detectRisks, analyzeMoisture } from './risk.js';
import { daysSince } from './util.js';

export const BRANDS = [
  ['Hymer', /hymer/i], ['Bürstner', /b[üu]e?rstner/i], ['Dethleffs', /dethleffs/i], ['Knaus', /knaus/i],
  ['Pilote', /pilote/i], ['Eura Mobil', /eura\s*mobil/i], ['Adria', /\badria\b/i], ['Chausson', /chausson/i],
  ['Challenger', /challenger/i], ['Rapido', /rapido/i], ['Benimar', /benimar/i], ['Rimor', /rimor/i],
  ['Elnagh', /elnagh/i], ['Carado', /carado/i], ['Sunlight', /sunlight/i], ['Weinsberg', /weinsberg/i],
  ['LMC', /\blmc\b/i], ['Tabbert', /tabbert/i], ['Hobby', /\bhobby\b/i], ['Fendt', /fendt/i], ['Carthago', /carthago/i],
  ['Laika', /laika/i], ['McLouis', /mc\s?louis/i], ['Mobilvetta', /mobilvetta/i], ['Roller Team', /roller\s*team/i],
  ['Frankia', /frankia/i], ['Pössl', /p[öo]e?ssl/i], ['Globecar', /globecar/i], ['Westfalia', /westfalia/i],
  ['Ci', /\bci\s+(?:riviera|carioca|magis)/i], ['Bavaria', /bavaria/i], ['Autostar', /autostar/i], ['Ahorn', /ahorn/i],
];
// Marcas que has marcado como interesantes (el resto puntúa 0 en este apartado, pero NO se descarta).
export const PREFERRED_BRANDS = ['Hymer', 'Bürstner', 'Dethleffs', 'Knaus', 'Pilote', 'Eura Mobil', 'Adria', 'Chausson', 'Challenger', 'Rapido'];

const BASES = [
  ['Fiat Ducato', /ducato/i], ['Peugeot Boxer', /boxer/i], ['Citroën Jumper', /jumper/i], ['Ford Transit', /transit/i],
  ['Mercedes Sprinter', /sprinter/i], ['Renault Master', /\bmaster\b/i], ['VW T4/T5/T6/LT', /\b(?:vw|volkswagen)?\s*(?:t4|t5|t6|lt\s?3[15])\b/i],
];

export const TYPES = {
  capuchina: 'Capuchina',
  perfilada: 'Perfilada',
  integral: 'Integral',
  camper: 'Furgoneta camper',
  autocaravana: 'Autocaravana (tipo sin especificar)',
};

const TYPE_RES = [
  ['capuchina', /alkoven|alcove|capucine|mansardat|alkoof|capuchin|overcab/i],
  ['perfilada', /teilintegriert|profil[ée]|semintegral|halfintegraal|perfilad|semi-?integrated/i],
  ['integral', /vollintegriert|int[ée]gral\b|integraal|\bintegral/i],
  ['camper', /kastenwagen|camper\s*van|campervan|fourgon|furgonato|furgoneta|bus-?camper|van\s*conversion/i],
];

export function parseAmount(str) {
  let s = String(str).trim().replace(/\s/g, '');
  if (!s) return null;
  if (/[.,]\d{2}$/.test(s) && /[.,].*[.,]\d{2}$/.test(s)) s = s.replace(/[.,]\d{2}$/, '');
  else if (/,\d{2}$/.test(s) && !/\./.test(s)) s = s.replace(/,\d{2}$/, '');
  s = s.replace(/[.,]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function firstMatch(text, regs) {
  for (const r of regs) {
    const m = r.exec(text);
    if (m) return m;
  }
  return null;
}

export function extractPrice(text) {
  const m = firstMatch(text, [
    /(?:€|eur(?:o|os)?\b)\s*(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?|\d{3,6})/i,
    /(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?|\d{3,6})\s*(?:€|eur(?:o|os)?\b)/i,
    /\b(?:preis|prix|prezzo|prijs|precio|vb|price)\s*[:=]?\s*(\d{1,3}(?:[.,\s]\d{3})+|\d{3,6})/i,
  ]);
  return m ? parseAmount(m[1]) : null;
}

export function extractYear(text) {
  const labeled = /(?:baujahr|\bbj\.?|erstzulassung|\bez\b|ann[ée]e|mise\s+en\s+circulation|\banno\b|immatricolazione|bouwjaar|a[ñn]o|matriculaci[oó]n|first\s+registration|\byear)\D{0,14}((?:19[7-9]\d|20[0-2]\d))/i.exec(text);
  if (labeled) return { value: Number(labeled[1]), inferred: false };
  const any = /(?<![\d.,])((?:19[7-9]\d|20[0-2]\d))(?![\d])/.exec(text);
  return any ? { value: Number(any[1]), inferred: true } : { value: null, inferred: false };
}

export function extractKm(text) {
  const m = firstMatch(text, [
    /(?:kilometerstand|km-?stand|laufleistung|kilom[ée]trage|kilometraje|chilometraggio|kilometers?tand)\D{0,8}(\d{1,3}(?:[.,\s]\d{3})+|\d{3,6})/i,
    /(\d{1,3}(?:[.,\s]\d{3})+|\d{4,6})\s*(?:km|kms|kilom)/i,
  ]);
  return m ? parseAmount(m[1]) : null;
}

export function extractSeats(text) {
  const homol = firstMatch(text, [
    /(?:sitzpl[aä]tze|zugelassene\s+personen|zul[aä]ssige\s+personenanzahl|places\s+(?:carte\s+grise|assises|homologu[ée]es)|posti\s+(?:omologati|a\s+sedere)|zitplaatsen|plazas\s+(?:homologadas|de\s+viaje|sentadas)|personas\s+homologadas)\s*[:=]?\s*(\d)\b/i,
    /\b(\d)\s*(?:sitzpl[aä]tze|sitzplatz|places\s+(?:carte\s+grise|assises|homologu[ée]es|route)|posti\s+(?:omologati|a\s+sedere)|zitplaatsen|plazas\s+(?:homologadas|de\s+viaje|sentadas)|seats\s+with\s+belts|belted\s+seats)/i,
  ]);
  const sleep = firstMatch(text, [
    /(?:schlafpl[aä]tze|couchages|posti\s+letto|slaapplaatsen|plazas\s+(?:para\s+dormir|de\s+dormir|nocturnas)|sleeps|berths)\s*[:=]?\s*(\d)\b/i,
    /\b(\d)\s*(?:schlafpl[aä]tze|schlafplatz|couchages?|posti\s+letto|slaapplaatsen|plazas\s+(?:para\s+dormir|de\s+dormir)|camas|betten|berths|personen\s+schlafen)/i,
  ]);
  return { homologated: homol ? Number(homol[1]) : null, sleeping: sleep ? Number(sleep[1]) : null };
}

const EQUIP = {
  bano: /\b(?:wc|toilette|toilet|bad\b|ba[ñn]o|salle\s+de\s+bain|bagno|badkamer|cassette)/i,
  ducha: /\b(?:dusche|douche|doccia|ducha|shower)/i,
  calefaccion: /\b(?:truma|webasto|eberspächer|standheizung|chauffage|riscaldamento|verwarming|calefacci[oó]n|heating)/i,
  nevera: /\b(?:k[üu]hlschrank|r[ée]frig[ée]rateur|frigo|frigorifero|koelkast|nevera|frigor[ií]fico|fridge)/i,
  solar: /\b(?:solar|photovoltaik|zonnepane)/i,
  aire: /\b(?:klima|climatisation|climatizzat|airco|aire\s+acondicionado|air\s*con)/i,
};

const DOCS = /fahrzeugbrief|fahrzeugschein|zulassungsbescheinigung|carte\s+grise|certificat\s+de\s+cession|libretto\s+di\s+circolazione|kenteken|tenaamstelling|ficha\s+t[eé]cnica|permiso\s+de\s+circulaci[oó]n|papeles\s+en\s+regla|documentaci[oó]n\s+(?:en\s+regla|completa)|\bcoc\b|certificate\s+of\s+conformity|papiere\s+vorhanden|papiers\s+en\s+r[eè]gle/i;
const MAINT = /scheckheft|serviceheft|wartungsnachweis|rechnungen\s+vorhanden|carnet\s+d['’]entretien|factures|tagliand[oi]|onderhoudsboek|onderhoudshistorie|libro\s+de\s+mantenimiento|facturas\s+de|service\s+history|maintenance\s+records|zahnriemen\s+(?:neu|gewechselt|erneuert)|courroie\s+(?:neuve|chang[ée]e)|cambio\s+de\s+correa|revisiones\s+al\s+d[ií]a/i;
const ITV = /t[üu]v\s*(?:bis\s*)?(?:neu\s*)?\d{1,2}[\/.]\d{2,4}|\bhu\s*(?:bis\s*)?\d{1,2}[\/.]\d{2,4}|t[üu]v\s+neu|\bhu\s+neu|contr[oô]le\s+technique\s+(?:ok|vierge|valide)|\bct\s+(?:ok|vierge)|revisione\s+(?:fino|valida|ok)|apk\s+(?:tot|geldig|nieuw)|nieuwe\s+apk|itv\s+(?:hasta|en\s+vigor|vigente|pasada|reci[eé]n)|itv\s+\d{1,2}[\/.]\d{2,4}/i;

const FUEL = [['Diésel', /diesel|di[eé]sel|gasoil|gasolio|gazole/i], ['Gasolina', /benzin|essence|benzina|gasolina|petrol|benzine/i]];

export function analyzeText(text, opts = {}) {
  const t = String(text ?? '');
  const title = String(opts.title ?? '');
  const all = `${title}\n${t}`;

  const price = extractPrice(all);
  const year = extractYear(all);
  const km = extractKm(all);
  const seats = extractSeats(all);

  let brand = null;
  for (const [name, re] of BRANDS) if (re.test(all)) { brand = name; break; }
  let base = null;
  for (const [name, re] of BASES) if (re.test(all)) { base = name; break; }
  let type = null;
  for (const [id, re] of TYPE_RES) if (re.test(all)) { type = id; break; }
  if (!type && /wohnmobil|reisemobil|camping-?car|autocaravana|motorhome|camper|kampeerauto/i.test(all)) type = 'autocaravana';

  let fuel = null;
  for (const [name, re] of FUEL) if (re.test(all)) { fuel = name; break; }
  const power = /(\d{2,3})\s*(?:ps|cv|ch|hp|pk)\b/i.exec(all) || null;

  const equipment = {};
  for (const [k, re] of Object.entries(EQUIP)) equipment[k] = re.test(all) ? true : null; // null = no especificado (no se deduce)

  const flags = detectRisks(all);
  const moisture = analyzeMoisture(all);

  const notes = [];
  if (year.inferred && year.value) notes.push('El año se ha deducido del texto: compruébalo.');

  // Discrepancias título/descripción
  if (title) {
    const ty = extractYear(title);
    const dy = extractYear(t);
    const tp = extractPrice(title);
    const dp = extractPrice(t);
    if ((ty.value && dy.value && ty.value !== dy.value) || (tp && dp && tp !== dp)) {
      flags.push({ id: 'titulo_distinto', sev: 'media', label: 'El título y la descripción no coinciden (año o precio): REQUIERE VERIFICACIÓN', discard: false, scam: false, evidence: '' });
    }
  }
  // Anuncio antiguo
  if (opts.postedDate) {
    const d = daysSince(opts.postedDate, opts.now);
    if (d !== null && d > 90) flags.push({ id: 'anuncio_antiguo', sev: 'media', label: `Anuncio publicado hace ${d} días: puede estar vendido o estancado`, discard: false, scam: false, evidence: '' });
  }

  return {
    fields: {
      price, year: year.value, km,
      seatsHomologated: seats.homologated, seatsSleeping: seats.sleeping,
      brand, base, type, fuel, power: power ? Number(power[1]) : null,
    },
    equipment,
    docs: DOCS.test(all) ? true : null,
    maintenance: MAINT.test(all) ? true : null,
    itvMentioned: ITV.test(all) ? true : null,
    flags,
    moisture,
    notes,
    textLength: t.trim().length,
  };
}
