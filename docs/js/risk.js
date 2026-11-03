// Detector de riesgos multilingüe (ES, EN, DE, FR, IT, NL).
// Nunca declara estafa: usa "REQUIERE VERIFICACIÓN" / "SOSPECHOSO".

const NEG = /(kein(?:e|en|er|es|em)?|ohne|nicht|\bno|\bsin|\bsans|pas\s+d[e'’]|aucun(?:e)?|nessun(?:a|o)?|senza|geen|zonder|free\s+of|without|libre\s+de|nunca|never)\s*$/i;
const NEG_AFTER = /^(?:s)?[\s-]*(?:frei|libre|free|vrij|gratis\s+de|exento|behoben|repar)/i;

export function isNegated(text, idx, len) {
  const before = text.slice(Math.max(0, idx - 28), idx);
  const after = text.slice(idx + len, idx + len + 14);
  return NEG.test(before) || NEG_AFTER.test(after);
}

// discard: motivo de descarte automático según tus condiciones (restauración, accidentado, sin motor, sin documentación).
export const RISKS = [
  { id: 'sin_itv', sev: 'alta', label: 'Sin ITV / TÜV / APK vigente', re: /ohne\s+(?:t[üu]v|hu\b)|t[üu]v\s+(?:abgelaufen|f[äa]llig|überf[äa]llig)|sans\s+contr[oô]le\s+technique|\bct\s+(?:p[ée]rim[ée]|[àa]\s+refaire)|revisione\s+scaduta|senza\s+revisione|zonder\s+apk|apk\s+(?:verlopen|afgekeurd)|sin\s+itv|itv\s+(?:caducada|vencida)|without\s+(?:mot|inspection)|no\s+itv/gi },
  { id: 'averia', sev: 'alta', discard: true, label: 'Avería de motor/caja o no arranca', re: /nicht\s+fahrbereit|motorschaden|getriebeschaden|defekt(?:er)?\s+motor|motor\s+defekt|springt\s+nicht\s+an|non\s+roulant|ne\s+d[ée]marre\s+pas|moteur\s+hs|panne\s+moteur|non\s+marciante|motore\s+(?:rotto|fuso|grippato)|non\s+parte|rijdt\s+niet|motorschade|start\s+niet|no\s+arranca|motor\s+(?:averiado|roto|gripado)|caja\s+de\s+cambios\s+(?:averiada|defectuosa)|averiad[oa]|not\s+running|engine\s+(?:failure|damage)|broken\s+engine|getriebe\s+defekt|gearbox\s+(?:broken|faulty)/gi },
  { id: 'piezas', sev: 'alta', discard: true, label: 'Para piezas / proyecto de restauración', re: /bastler(?:fahrzeug)?|ausschlachten|ersatzteil(?:tr[äa]ger|spender)|zum\s+schlachten|pour\s+pi[eè]ces|[àa]\s+restaurer|projet\s+de\s+restauration|per\s+ricambi|da\s+restaurare|voor\s+onderdelen|restauratieproject|para\s+piezas|para\s+despiece|proyecto\s+de\s+restauraci[oó]n|a\s+restaurar|for\s+parts|restoration\s+project|project\s+vehicle/gi },
  { id: 'accidente', sev: 'alta', discard: true, label: 'Accidente / siniestro', re: /unfall(?!frei)(?:schaden|fahrzeug|wagen)?|accident[ée]|sinistr[ée]|incidentat[oa]|\bschade(?!\s*vrij|vrij)|accidentad[oa]|siniestro|accident\b|crash/gi },
  { id: 'sin_docs', sev: 'alta', discard: true, label: 'Sin documentación', re: /ohne\s+(?:papiere|fahrzeugbrief|unterlagen|kfz-?brief)|sans\s+(?:papiers|carte\s+grise|documents)|senza\s+(?:documenti|libretto)|zonder\s+(?:papieren|kenteken)|sin\s+(?:papeles|documentaci[oó]n|ficha\s+t[eé]cnica|permiso\s+de\s+circulaci[oó]n)|no\s+papers|without\s+(?:papers|documents)/gi },
  { id: 'oxido_estructural', sev: 'alta', label: 'Óxido estructural', re: /durchgerostet|durchrostet|rouille\s+structurelle|chassis\s+rouill|ruggine\s+strutturale|[oó]xido\s+estructural|rotten\s+frame|rust\s+holes?|rostlöcher/gi },
  { id: 'oxido', sev: 'media', label: 'Óxido / corrosión mencionados', re: /\brost(?!frei)\w*|corrosion|rouill[ée]|ruggine|\broest\b|[oó]xido|oxidaci[oó]n|corros\w+|\brust(?:y)?\b/gi },
  { id: 'sin_matricular', sev: 'media', label: 'Sin matricular / dado de baja', re: /nicht\s+zugelassen|ohne\s+zulassung|abgemeldet|non\s+immatricul[ée]|pas\s+immatricul|non\s+immatricolat|niet\s+gekeurd|sin\s+matricular|baja\s+definitiva|dado\s+de\s+baja|unregistered/gi },
  { id: 'no_homologada', sev: 'media', label: 'Reforma no homologada o no inscrita', re: /nicht\s+eingetragen|umbau\s+nicht|ohne\s+eintragung|non\s+homologu[ée]|non\s+omologat[oa]|reforma\s+no\s+homologada|sin\s+homologar|no\s+homologad|not\s+homologated/gi },
  { id: 'sobrecarga', sev: 'media', label: 'Posible sobrecarga (MMA)', re: /[uü]berladen|[uü]berlast|surcharge|sovraccaric|overbelad|sobrecarg|overloaded/gi },
  { id: 'pago_anticipado', sev: 'media', scam: true, label: 'Menciona pago anticipado, señal o envío: REQUIERE VERIFICACIÓN', re: /vorkasse|anzahlung|vorauszahlung|acompte|paiement\s+d['’]avance|\banticipo|caparra|vooruitbetaling|aanbetaling|western\s*union|moneygram|paysafe|gift\s*card|bitcoin|crypto|pago\s+por\s+adelantado|prepayment|escrow|\bse[ñn]al\b/gi },
  { id: 'extranjero', sev: 'media', scam: true, label: 'El vendedor dice estar fuera / enviar por agencia: SOSPECHOSO, verificar', re: /ich\s+bin\s+(?:derzeit\s+)?im\s+ausland|je\s+suis\s+[àa]\s+l['’][ée]tranger|sono\s+all['’]estero|estoy\s+en\s+el\s+extranjero|currently\s+abroad|versand\s+per\s+spedition|livraison\s+par\s+transporteur|agent\s+will\s+(?:pick|deliver)/gi },
];

export function detectRisks(text) {
  const found = [];
  for (const r of RISKS) {
    r.re.lastIndex = 0;
    let m;
    let hit = null;
    while ((m = r.re.exec(text)) !== null) {
      if (m[0].length === 0) { r.re.lastIndex++; continue; }
      if (!isNegated(text, m.index, m[0].length)) { hit = m[0]; break; }
    }
    if (hit) found.push({ id: r.id, sev: r.sev, label: r.label, discard: !!r.discard, scam: !!r.scam, evidence: hit.trim() });
  }
  return found;
}

// --- Humedades ---
const MOIST = /\b(?:feuchtigkeit\w*|feuchte[nrs]?|feuchtschaden|wasserschaden|wassereintritt|wassereinbruch|undicht\w*|nässe|humidit[ée]\w*|infiltrations?|infiltrazion[ei]|umidit[àa]|vocht\w*|lekkage|lekt|humedad(?:es)?|filtraci[oó]n(?:es)?|goteras?|da[ñn]os?\s+por\s+agua|moisture|water\s+damage|leaks?|leakage|damp)/gi;
const PROOF = /dichtheitspr[üu]fung|dichtigkeitspr[üu]fung|dichtheitsbescheinigung|dichtheitstest|feuchtigkeitsmessung|feuchtemessung|test\s+d['’][ée]tanch[ée]it[ée]|contr[oô]le\s+d['’][ée]tanch[ée]it[ée]|controllo\s+infiltrazioni|prova\s+di\s+tenuta|dichtheidstest|dichtheidscontrole|prueba\s+de\s+estanqueidad|informe\s+de\s+humedad|medici[oó]n\s+de\s+humedad|leak\s+test|damp\s+(?:test|report|check)|moisture\s+(?:test|report|check|reading)/gi;
const DRY = /\b(?:garantiert\s+dicht|absolut\s+dicht|alles\s+dicht|dicht\b|trocken|[ée]tanche|stagno|waterdicht|estanco|totalmente\s+seco|\bseco\b|\bdry\b|watertight)/gi;

export const MOISTURE_LABELS = {
  confirmada: 'HUMEDAD MENCIONADA EN EL ANUNCIO',
  descartada_doc: 'COMPROBACIÓN MENCIONADA (pide el informe)',
  vendedor_niega: 'EL VENDEDOR DICE QUE NO HAY (sin comprobación documentada)',
  no_mencionada: 'NO MENCIONADA (no significa que no haya)',
  desconocida: 'ESTADO DESCONOCIDO',
};

export function analyzeMoisture(text) {
  const proofSpans = [];
  let m;
  PROOF.lastIndex = 0;
  while ((m = PROOF.exec(text)) !== null) proofSpans.push([m.index, m.index + m[0].length, m[0]]);
  const inProof = (i) => proofSpans.some(([a, b]) => i >= a && i < b);

  let positive = null;
  let negated = null;
  MOIST.lastIndex = 0;
  while ((m = MOIST.exec(text)) !== null) {
    if (inProof(m.index)) continue;
    if (isNegated(text, m.index, m[0].length)) negated = negated || m[0];
    else { positive = m[0]; break; }
  }
  if (positive) return { status: 'confirmada', evidence: positive };
  if (proofSpans.length) return { status: 'descartada_doc', evidence: proofSpans[0][2] };
  DRY.lastIndex = 0;
  const dry = DRY.exec(text);
  if (negated || dry) return { status: 'vendedor_niega', evidence: negated || dry[0] };
  return { status: 'no_mencionada', evidence: '' };
}
