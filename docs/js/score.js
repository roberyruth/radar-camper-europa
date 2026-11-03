// Puntuación explicable 0-100. Es un filtro orientativo, NO una inspección mecánica.
import { PREFERRED_BRANDS } from './parse.js';

export const DEFAULT_SETTINGS = {
  budget: 7000,
  prefMin: 4500,
  prefMax: 5500,
  minSeats: 4,
  minSleep: 4,
  lowPrice: 1500,
};

const has = (v) => v !== null && v !== undefined && v !== '';

// A. Calidad del anuncio y de la información (0-100)
export function infoScore(a) {
  const parts = [];
  const add = (label, pts, max, why) => parts.push({ label, pts, max, why });
  const ph = Number(a.photos) || 0;
  add('Fotografías', ph >= 8 ? 20 : ph >= 4 ? 10 : ph >= 1 ? 4 : 0, 20, ph ? `${ph} fotos` : 'Sin fotos indicadas');
  const len = a.textLength || 0;
  add('Descripción', len >= 400 ? 15 : len >= 150 ? 8 : len > 0 ? 3 : 0, 15, `${len} caracteres`);
  add('Documentación mencionada', a.docs ? 15 : 0, 15, a.docs ? 'Se mencionan papeles' : 'No se mencionan');
  add('Mantenimiento acreditado', a.maintenance ? 15 : 0, 15, a.maintenance ? 'Se menciona historial/facturas' : 'No se menciona');
  add('Información de ITV/TÜV/APK', a.itvMentioned ? 10 : 0, 10, a.itvMentioned ? 'Se menciona (verificar fecha)' : 'No se menciona');
  const m = a.moisture;
  add('Información sobre humedades', m === 'descartada_doc' ? 15 : m === 'vendedor_niega' ? 8 : m === 'confirmada' ? 8 : 0, 15,
    m === 'descartada_doc' ? 'Comprobación mencionada' : m === 'vendedor_niega' ? 'Solo declaración del vendedor' : m === 'confirmada' ? 'Se informa (negativamente)' : 'No hay información');
  const known = [a.year, a.km, a.seatsHomologated, a.seatsSleeping, a.fuel].filter(has).length;
  add('Datos técnicos completos', known * 2, 10, `${known}/5 datos clave`);
  const total = parts.reduce((s, p) => s + p.pts, 0);
  return { total, parts };
}

// B. Calidad potencial del vehículo (0-100) + clasificación
export function scoreAd({ fields: f, analysis, cost, settings }) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const parts = [];
  const add = (label, pts, max, why) => parts.push({ label, pts, max, why });
  const warnings = [];
  const discard = [];

  // 1. Coste total vs presupuesto (35)
  const costStatus = cost.status;
  if (costStatus === 'DENTRO') add('Coste final en Málaga', 35, 35, 'Cabe en el presupuesto incluso en el escenario conservador');
  else if (costStatus === 'AJUSTADO') add('Coste final en Málaga', 20, 35, 'Solo cabe en el escenario optimista');
  else if (costStatus === 'SUPERA') { add('Coste final en Málaga', 0, 35, 'Supera el presupuesto'); discard.push('El coste estimado supera tu presupuesto'); }
  else {
    const p = f.price;
    const pts = !has(p) ? 0 : p <= s.prefMax ? 12 : p <= s.prefMax + 500 ? 7 : 3;
    add('Coste final en Málaga', pts, 35, 'PROVISIONAL: faltan costes por verificar; solo se valora el precio de compra (máx. 12 de 35)');
    warnings.push('Coste final pendiente de verificar: la puntuación es provisional.');
  }

  // 2. Plazas (20)
  const seat = (v, min, label) => {
    if (!has(v)) { warnings.push(`${label}: DATO NO CONFIRMADO`); return [3, 'DATO NO CONFIRMADO']; }
    if (v >= min) return [10, `${v} (mínimo ${min})`];
    discard.push(`${label}: ${v} (mínimo ${min})`);
    return [0, `${v}: por debajo del mínimo ${min}`];
  };
  const [h, hw] = seat(f.seatsHomologated, s.minSeats, 'Plazas homologadas para viajar');
  const [z, zw] = seat(f.seatsSleeping, s.minSleep, 'Plazas para dormir');
  add('Plazas homologadas', h, 10, hw);
  add('Plazas para dormir', z, 10, zw);

  // 3. Humedad (15)
  const mo = f.moisture || 'no_mencionada';
  const moPts = { descartada_doc: 15, vendedor_niega: 8, no_mencionada: 5, desconocida: 4, confirmada: 0 }[mo] ?? 4;
  add('Riesgo de humedad', moPts, 15, { descartada_doc: 'Comprobación mencionada (pide el informe)', vendedor_niega: 'Solo palabra del vendedor', no_mencionada: 'No mencionada: no se asume que esté libre', desconocida: 'Estado desconocido', confirmada: 'Humedad mencionada en el anuncio' }[mo]);
  if (mo === 'confirmada') discard.push('Se mencionan humedades');
  else if (mo !== 'descartada_doc') warnings.push('Humedades sin comprobación documentada: revisar en persona (techo, capuchina, esquinas, ventanas, suelo, baño).');

  // 4. Riesgos (15)
  let rp = 15;
  for (const fl of analysis.flags) {
    rp -= fl.sev === 'alta' ? 8 : 3;
    if (fl.discard) discard.push(fl.label);
  }
  rp = Math.max(0, rp);
  add('Señales de riesgo', rp, 15, analysis.flags.length ? `${analysis.flags.length} alerta(s)` : 'Ninguna detectada en el texto');

  // 5. Tipo y marca (5)
  let tp = 0;
  if (['capuchina', 'perfilada', 'camper'].includes(f.type)) tp += 3;
  else if (has(f.type)) tp += 1;
  if (PREFERRED_BRANDS.includes(f.brand)) tp += 2;
  add('Tipo y marca', tp, 5, `${f.type || 'tipo NO ESPECIFICADO'}${f.brand ? ', ' + f.brand : ''}`);

  // 6. Mantenimiento e ITV (5)
  add('Mantenimiento e inspección', (analysis.maintenance ? 3 : 0) + (analysis.itvMentioned ? 2 : 0), 5,
    `${analysis.maintenance ? 'Mantenimiento mencionado' : 'Sin mantenimiento acreditado'}; ${analysis.itvMentioned ? 'ITV mencionada' : 'ITV sin información'}`);
  if (!analysis.docs) warnings.push('No se mencionan los papeles: pedir documentación completa antes de nada.');

  // 7. Equipamiento (5)
  const e = analysis.equipment || {};
  add('Equipamiento declarado', (e.bano ? 2 : 0) + (e.ducha ? 1 : 0) + (e.calefaccion ? 1 : 0) + (e.nevera ? 1 : 0), 5, 'Solo lo que aparece en el anuncio');

  const total = parts.reduce((x, p) => x + p.pts, 0);
  const strongRisk = analysis.flags.some((x) => x.sev === 'alta');
  const scam = analysis.flags.some((x) => x.scam);
  if (f.price !== null && f.price !== undefined && f.price < s.lowPrice) warnings.push(`Precio anormalmente bajo (menos de ${s.lowPrice} €): REQUIERE VERIFICACIÓN`);

  let label;
  if (discard.length) label = 'DESCARTAR';
  else if (costStatus === 'DENTRO' && has(f.seatsHomologated) && has(f.seatsSleeping) && !strongRisk && !scam && mo !== 'confirmada' && total >= 70) label = 'OPORTUNIDAD';
  else if (total >= 55 && costStatus !== 'PENDIENTE') label = 'INTERESANTE';
  else label = 'SEGUIR';

  return { total, parts, warnings, discard, label, info: infoScore({ ...f, ...analysis, moisture: mo, textLength: analysis.textLength, photos: f.photos }) };
}

const COST_RANK = { DENTRO: 0, AJUSTADO: 1, PENDIENTE: 2, SUPERA: 3 };

// Conclusión automática del comparador: considera coste total y riesgos, no solo el precio.
export function concludeCompare(rows) {
  const ok = rows.filter((r) => r.result.label !== 'DESCARTAR');
  if (!ok.length) return 'Ninguno de los vehículos comparados es recomendable: todos tienen riesgos o costes incompatibles con tus condiciones.';
  ok.sort((a, b) => (COST_RANK[a.cost.status] - COST_RANK[b.cost.status]) || (b.result.total - a.result.total));
  const best = ok[0];
  const why = [];
  why.push(best.cost.status === 'DENTRO' ? 'cabe en el presupuesto incluso en el escenario conservador' : best.cost.status === 'AJUSTADO' ? 'cabe en el escenario optimista' : 'tiene el mejor equilibrio con los datos disponibles');
  why.push(`puntuación ${best.result.total}/100`);
  if (!best.result.warnings.length) why.push('sin advertencias pendientes');
  let txt = `Mejor candidato: ${best.name}, porque ${why.join(', ')}.`;
  if (best.cost.status === 'PENDIENTE') txt += ' Atención: su coste final sigue pendiente de verificar.';
  if (best.result.warnings.length) txt += ` Pendiente de comprobar: ${best.result.warnings.length} aviso(s).`;
  return txt + ' Es una ayuda para decidir, no una inspección del vehículo.';
}
