// Textos de prueba SIMULADOS (inventados para los tests; no son anuncios reales).
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeText, parseAmount } from '../docs/js/parse.js';
import { detectRisks, analyzeMoisture } from '../docs/js/risk.js';
import { computeCost, COST_ITEMS } from '../docs/js/cost.js';
import { scoreAd, concludeCompare, DEFAULT_SETTINGS } from '../docs/js/score.js';
import { validateUrl, normalizeUrl, fingerprint } from '../docs/js/util.js';

const DE = `SIMULADO Hymer Alkoven Wohnmobil auf Fiat Ducato, Baujahr 1998, 142.000 km, Diesel 94 PS.
4 Sitzplätze, 6 Schlafplätze. TÜV 05/2027. Scheckheft und Rechnungen vorhanden. Fahrzeugbrief vorhanden.
Keine Feuchtigkeit, Dichtheitsprüfung 2025 mit Protokoll. Dusche, WC, Truma Heizung, Kühlschrank. Preis: 5.400 €`;

test('parseAmount', () => {
  assert.equal(parseAmount('5.500'), 5500);
  assert.equal(parseAmount('5,500'), 5500);
  assert.equal(parseAmount('5.500,00'), 5500);
  assert.equal(parseAmount('5500'), 5500);
});

test('extrae datos de un texto alemán simulado', () => {
  const a = analyzeText(DE);
  assert.equal(a.fields.price, 5400);
  assert.equal(a.fields.year, 1998);
  assert.equal(a.fields.km, 142000);
  assert.equal(a.fields.seatsHomologated, 4);
  assert.equal(a.fields.seatsSleeping, 6);
  assert.equal(a.fields.brand, 'Hymer');
  assert.equal(a.fields.base, 'Fiat Ducato');
  assert.equal(a.fields.type, 'capuchina');
  assert.equal(a.docs, true);
  assert.equal(a.maintenance, true);
  assert.equal(a.itvMentioned, true);
  assert.equal(a.equipment.ducha, true);
  assert.equal(a.moisture.status, 'descartada_doc');
  assert.equal(a.flags.length, 0);
});

test('no inventa datos que no aparecen', () => {
  const a = analyzeText('Wohnmobil zu verkaufen, guter Zustand.');
  assert.equal(a.fields.price, null);
  assert.equal(a.fields.km, null);
  assert.equal(a.fields.seatsHomologated, null);
  assert.equal(a.equipment.bano, null);
  assert.equal(a.moisture.status, 'no_mencionada');
});

test('humedades: confirmadas, negadas, documentadas, no mencionadas', () => {
  assert.equal(analyzeMoisture('Leichter Wasserschaden im Dach').status, 'confirmada');
  assert.equal(analyzeMoisture('Infiltration au niveau de la capucine').status, 'confirmada');
  assert.equal(analyzeMoisture('Humedades en el suelo del baño').status, 'confirmada');
  assert.equal(analyzeMoisture('Geen lekkage, zonder vocht').status, 'vendedor_niega');
  assert.equal(analyzeMoisture('sans humidité').status, 'vendedor_niega');
  assert.equal(analyzeMoisture('Feuchtigkeitsmessung vom Fachbetrieb vorhanden').status, 'descartada_doc');
  assert.equal(analyzeMoisture('Muy buen estado, nevera trivalente').status, 'no_mencionada');
});

test('riesgos multilingües', () => {
  const ids = (t) => detectRisks(t).map((r) => r.id);
  assert.ok(ids('Motorschaden, nicht fahrbereit, ohne TÜV').includes('averia'));
  assert.ok(ids('Motorschaden, nicht fahrbereit, ohne TÜV').includes('sin_itv'));
  assert.ok(ids('camping-car non roulant, sans contrôle technique').includes('sin_itv'));
  assert.ok(ids('camper per ricambi, revisione scaduta').includes('piezas'));
  assert.ok(ids('camper zonder APK, voor onderdelen').includes('piezas'));
  assert.ok(ids('vendo para piezas, sin ITV, no arranca').includes('averia'));
  assert.ok(ids('Bitte Anzahlung per Western Union').includes('pago_anticipado'));
  assert.ok(ids('Ich bin im Ausland, Versand per Spedition').includes('extranjero'));
  assert.ok(ids('Unfallschaden vorne').includes('accidente'));
});

test('negaciones no disparan falsos positivos', () => {
  const ids = (t) => detectRisks(t).map((r) => r.id);
  assert.deepEqual(ids('unfallfrei, kein Rost, nicht abgemeldet? nein'), ids('unfallfrei, kein Rost, nicht abgemeldet? nein')); // estable
  assert.ok(!ids('unfallfrei, rostfrei').includes('accidente'));
  assert.ok(!ids('unfallfrei, rostfrei').includes('oxido'));
  assert.ok(!ids('kein Rost vorhanden').includes('oxido'));
  assert.ok(!ids('sans accident, sans rouille').includes('accidente'));
});

test('calculadora: sin datos no muestra total', () => {
  const r = computeCost({ price: 5000 }, { price: 5000 }, 7000);
  assert.equal(r.opt.total, null);
  assert.equal(r.status, 'PENDIENTE');
  assert.ok(r.missing.includes('taxes'));
});

test('calculadora: estados DENTRO / AJUSTADO / SUPERA', () => {
  const fill = (base, v) => Object.fromEntries(COST_ITEMS.map((i) => [i.id, i.id === 'price' ? base : v]));
  const dentro = computeCost(fill(5000, 100), fill(5000, 150), 7000); // opt 6200, cons 6800
  assert.equal(dentro.status, 'DENTRO');
  assert.equal(dentro.opt.total, 5000 + 100 * 12);
  assert.equal(dentro.margin, 600);
  const ajustado = computeCost(fill(5000, 100), fill(5000, 300), 7000); // opt 6200, cons 8600
  assert.equal(ajustado.status, 'AJUSTADO');
  const supera = computeCost(fill(6500, 100), fill(6500, 200), 7000);
  assert.equal(supera.status, 'SUPERA');
});

test('calculadora: incompleto pero ya supera el presupuesto', () => {
  const r = computeCost({ price: 6900, travel: 300 }, { price: 6900 }, 7000);
  assert.equal(r.status, 'SUPERA');
  assert.equal(r.opt.total, null);
});

test('puntuación: OPORTUNIDAD solo con coste dentro y datos confirmados', () => {
  const a = analyzeText(DE);
  const full = Object.fromEntries(COST_ITEMS.map((i) => [i.id, i.id === 'price' ? 5400 : 50]));
  const cost = computeCost(full, full, 7000);
  const res = scoreAd({ fields: { ...a.fields, moisture: a.moisture.status, photos: 10 }, analysis: a, cost, settings: DEFAULT_SETTINGS });
  assert.equal(res.label, 'OPORTUNIDAD');
  assert.ok(res.total >= 70);
  assert.ok(res.parts.every((p) => p.why));
});

test('puntuación: barato no es oportunidad automáticamente', () => {
  const a = analyzeText('Wohnmobil Hymer 1999 für 2.000 €');
  const cost = computeCost({ price: 2000 }, { price: 2000 }, 7000);
  const res = scoreAd({ fields: { ...a.fields, moisture: a.moisture.status }, analysis: a, cost, settings: DEFAULT_SETTINGS });
  assert.notEqual(res.label, 'OPORTUNIDAD');
  assert.ok(res.warnings.some((w) => /NO CONFIRMADO/.test(w)));
});

test('puntuación: descarta humedades, averías y plazas insuficientes', () => {
  const mk = (t, extra = {}) => {
    const a = analyzeText(t);
    const cost = computeCost({ price: 3000 }, { price: 3000 }, 7000);
    return scoreAd({ fields: { ...a.fields, moisture: a.moisture.status, ...extra }, analysis: a, cost, settings: DEFAULT_SETTINGS });
  };
  assert.equal(mk('Alkoven Wohnmobil 4 Sitzplätze 4 Schlafplätze mit Wasserschaden im Dach').label, 'DESCARTAR');
  assert.equal(mk('Wohnmobil Motorschaden 4 Sitzplätze 4 Schlafplätze').label, 'DESCARTAR');
  assert.equal(mk('Wohnmobil 2 Sitzplätze 2 Schlafplätze').label, 'DESCARTAR');
});

test('comparador: elige por coste y riesgo, no solo precio', () => {
  const full = (p) => Object.fromEntries(COST_ITEMS.map((i) => [i.id, i.id === 'price' ? p : 100]));
  const mk = (name, text, price) => {
    const a = analyzeText(text);
    const cost = computeCost(full(price), full(price), 7000);
    return { name, cost, result: scoreAd({ fields: { ...a.fields, moisture: a.moisture.status, price }, analysis: a, cost, settings: DEFAULT_SETTINGS }) };
  };
  const barato = mk('Barato', 'Wohnmobil 4 Sitzplätze 4 Schlafplätze Motorschaden', 2500);
  const bueno = mk('Bueno', DE, 5400);
  assert.match(concludeCompare([barato, bueno]), /Mejor candidato: Bueno/);
  assert.match(concludeCompare([barato]), /Ninguno/);
});

test('URLs: validación y normalización', () => {
  assert.equal(validateUrl('https://www.mobile.de/x?id=1').ok, true);
  for (const bad of ['javascript:alert(1)', 'http://localhost/x', 'http://127.0.0.1/', 'http://192.168.1.1/', 'http://[::1]/', 'http://2130706433/', 'https://user:pw@mobile.de/', 'file:///etc/passwd', 'http://intranet/x', 'texto']) {
    assert.equal(validateUrl(bad).ok, false, bad);
  }
  assert.equal(normalizeUrl('https://www.x.de/a/?utm_source=z&id=5#h'), normalizeUrl('https://x.de/a?id=5'));
});

test('huella de texto detecta el mismo anuncio repetido', () => {
  assert.equal(fingerprint(DE), fingerprint(DE.toUpperCase() + '  '));
  assert.notEqual(fingerprint(DE), fingerprint(DE.replace('Hymer', 'Knaus Sun Traveller largo texto diferente en el principio')));
  assert.equal(fingerprint('corto'), '');
});
