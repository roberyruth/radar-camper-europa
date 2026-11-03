// Calculadora de coste final hasta Málaga.
// REGLA: no se inventa ningún importe legal ni fiscal. Todo lo que no se ha introducido
// queda como COSTE PENDIENTE DE VERIFICAR y no se muestra un total engañosamente preciso.

export const REGIMES = [
  { id: 'particular', label: 'Compra a particular' },
  { id: 'profesional_iva', label: 'Profesional, operación con IVA' },
  { id: 'profesional_rebu', label: 'Profesional, régimen REBU' },
  { id: 'otro', label: 'Sin determinar' },
];

export const COST_ITEMS = [
  { id: 'price', group: 'Compra', label: 'Precio de compra', required: true, derived: true },
  { id: 'travel', group: 'Adquisición', label: 'Viaje desde Málaga para inspeccionarlo (avión, tren o coche)', required: true },
  { id: 'lodging', group: 'Adquisición', label: 'Alojamiento (si hace falta)', required: false },
  { id: 'transfer', group: 'Adquisición', label: 'Traslado a Málaga: combustible, peajes y vuelta del conductor, o transporte profesional', required: true },
  { id: 'plates', group: 'Adquisición', label: 'Placas temporales', required: true },
  { id: 'insurance', group: 'Adquisición', label: 'Seguro temporal', required: true },
  { id: 'itv', group: 'Legalización', label: 'ITV de importación', required: true },
  { id: 'ficha', group: 'Legalización', label: 'Ficha técnica reducida o certificado de conformidad', required: true },
  { id: 'homologation', group: 'Legalización', label: 'Homologación (si es necesaria; pon 0 si no lo es)', required: true },
  { id: 'fees', group: 'Legalización', label: 'Matriculación y tasas administrativas', required: true },
  { id: 'taxes', group: 'Impuestos', label: 'Impuestos aplicables según régimen (IVA, ITP, impuesto de matriculación o exención)', required: true },
  { id: 'ivtm', group: 'Impuestos', label: 'IVTM (impuesto de circulación)', required: true },
  { id: 'other', group: 'Otros', label: 'Otros gastos previsibles', required: false },
];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function scenario(vals) {
  let subtotal = 0;
  const missing = [];
  for (const it of COST_ITEMS) {
    const v = vals[it.id];
    if (isNum(v)) subtotal += v;
    else if (it.required) missing.push(it.id);
  }
  return { subtotal, missing, total: missing.length ? null : subtotal };
}

export function computeCost(opt, cons, budget) {
  const o = scenario(opt || {});
  const c = scenario(cons || {});
  const inconsistencies = COST_ITEMS.filter((it) => isNum(opt?.[it.id]) && isNum(cons?.[it.id]) && cons[it.id] < opt[it.id]).map((it) => it.id);

  let status;
  if (c.total !== null && c.total <= budget) status = 'DENTRO';
  else if (o.total !== null && o.total > budget) status = 'SUPERA';
  else if (o.total !== null && c.total !== null) status = 'AJUSTADO';
  else if (o.subtotal > budget) status = 'SUPERA';
  else status = 'PENDIENTE';

  const missing = [...new Set([...o.missing, ...c.missing])];
  const margin = o.total !== null && c.total !== null ? c.total - o.total : null;
  return { opt: o, cons: c, status, missing, margin, inconsistencies, budget };
}

export const STATUS_TEXT = {
  DENTRO: 'DENTRO DEL PRESUPUESTO (incluso en el escenario conservador)',
  AJUSTADO: 'AJUSTADO: cabe solo en el escenario optimista',
  SUPERA: 'SUPERA EL PRESUPUESTO',
  PENDIENTE: 'COSTE PENDIENTE DE VERIFICAR',
};
