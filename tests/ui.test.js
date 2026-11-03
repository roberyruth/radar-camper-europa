// Prueba de la interfaz en un Chrome real con viewport de móvil. Textos SIMULADOS.
// Requiere Playwright y Chrome instalados; si no están, la prueba se omite (no falla).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const require = createRequire(import.meta.url);
let chromium = null;
for (const p of ['playwright', '/home/claude/.npm-global/lib/node_modules/playwright', '/opt/node22/lib/node_modules/playwright']) {
  try { ({ chromium } = require(p)); break; } catch { /* siguiente */ }
}
const chromePath = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
const SHOTS = process.env.RCE_SHOTS || '';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(root, path.normalize(p));
      if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      res.end(fs.readFileSync(f));
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const GOOD = `SIMULADO Hymer Alkoven Wohnmobil auf Fiat Ducato, Baujahr 1998, 142.000 km, Diesel 94 PS.
4 Sitzplätze, 6 Schlafplätze. TÜV 05/2027. Scheckheft und Rechnungen vorhanden. Fahrzeugbrief vorhanden.
Keine Feuchtigkeit, Dichtheitsprüfung 2025 mit Protokoll. Dusche, WC, Truma Heizung, Kühlschrank. Preis: 5.400 €`;
const BAD = `SIMULADO Dethleffs Camping-car capucine 2001, 180 000 km. 4 places carte grise, 5 couchages.
Infiltration d'eau au niveau de la capucine, moteur HS, vendu sans contrôle technique. Acompte demandé. 2 900 €`;

test('interfaz móvil: flujo completo', { skip: !chromium || !chromePath ? 'Playwright/Chrome no disponibles' : false }, async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ executablePath: chromePath, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = async (n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${n}.png`), fullPage: true }); };
  try {
    await page.goto(url);
    await page.fill('textarea[data-bind="text"]', GOOD);
    await page.fill('input[data-bind="photos"]', '10');
    await page.click('button[data-act="analyze"]');
    await page.waitForSelector('#summary .badge');
    let summary = await page.textContent('#summary');
    assert.match(summary, /COSTE PENDIENTE DE VERIFICAR/);
    assert.equal(await page.inputValue('input[data-f="price"]'), '5400');
    assert.equal(await page.inputValue('input[data-f="year"]'), '1998');
    await shot('01-analisis-pendiente');

    // Completar los costes (optimista 50 €, conservador 100 € por partida requerida)
    for (const id of ['travel', 'transfer', 'plates', 'insurance', 'itv', 'ficha', 'homologation', 'fees', 'taxes', 'ivtm']) {
      await page.fill(`input[data-cost="opt"][data-id="${id}"]`, '50');
      await page.fill(`input[data-cost="cons"][data-id="${id}"]`, '100');
    }
    summary = await page.textContent('#summary');
    assert.match(summary, /5\.900.*6\.400/s);
    assert.match(summary, /DENTRO DEL PRESUPUESTO/);
    assert.match(summary, /OPORTUNIDAD/);
    await shot('02-oportunidad');

    // Guardar, duplicado y cambio de precio
    await page.click('button[data-act="save"]');
    assert.match(await page.textContent('#toast'), /Guardado/);
    await page.fill('input[data-f="price"]', '5200');
    await page.click('button[data-act="save"]');
    assert.match(await page.textContent('#toast'), /duplicado/i);

    // Segundo anuncio con problemas
    await page.click('button[data-act="reset"]');
    await page.fill('textarea[data-bind="text"]', BAD);
    await page.click('button[data-act="analyze"]');
    await page.waitForSelector('#summary .badge');
    summary = await page.textContent('#summary');
    assert.match(summary, /DESCARTAR/);
    assert.match(summary, /HUMEDAD MENCIONADA/);
    assert.match(summary, /REQUIERE VERIFICACIÓN/);
    await shot('03-descartar');
    await page.click('button[data-act="save"]');

    // Guardados + favoritos + persistencia tras recargar
    await page.click('#tabs button[data-tab="guardados"]');
    assert.equal(await page.locator('[data-ad]').count(), 2);
    await page.locator('button[data-act="fav"]').first().click();
    await page.reload();
    await page.click('#tabs button[data-tab="guardados"]');
    assert.equal(await page.locator('[data-ad]').count(), 2, 'los anuncios persisten');
    assert.equal(await page.locator('button.star.on').count(), 1, 'el favorito persiste');
    const hist = await page.locator('[data-ad] li').allTextContents();
    assert.ok(hist.some((x) => /5\.400/.test(x)) && hist.some((x) => /5\.200/.test(x)), 'historial de precios');
    await shot('04-guardados');

    // Comparar
    await page.locator('input[data-act="cmp"]').nth(0).check();
    await page.locator('input[data-act="cmp"]').nth(1).check();
    await page.click('button[data-act="gocompare"]');
    const cmp = await page.textContent('#view');
    assert.match(cmp, /Mejor candidato: Hymer/);
    assert.match(cmp, /NO ESPECIFICADO|PENDIENTE/);
    await shot('05-comparar');

    // Ajustes + sin desbordamiento horizontal en móvil
    await page.click('#tabs button[data-tab="ajustes"]');
    await page.fill('input[data-set="budget"]', '6500');
    await page.click('button[data-act="saveset"]');
    await page.reload();
    await page.click('#tabs button[data-tab="ajustes"]');
    assert.equal(await page.inputValue('input[data-set="budget"]'), '6500');
    await shot('06-ajustes');
    for (const tab of ['analizar', 'guardados', 'comparar', 'ajustes']) {
      await page.click(`#tabs button[data-tab="${tab}"]`);
      const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      assert.ok(w[0] <= w[1] + 1, `sin scroll horizontal en ${tab}: ${w}`);
    }

    // Seguridad: el texto del anuncio no se ejecuta como HTML
    await page.click('#tabs button[data-tab="analizar"]');
    await page.click('button[data-act="reset"]');
    await page.fill('textarea[data-bind="text"]', '<img src=x onerror="window.__xss=1"> Wohnmobil 4 Sitzplätze 4 Schlafplätze 3.000 € texto relleno suficiente');
    await page.fill('input[data-bind="url"]', 'javascript:alert(1)');
    await page.click('button[data-act="analyze"]');
    await page.waitForSelector('#summary .badge');
    await page.click('button[data-act="save"]');
    assert.match(await page.textContent('#toast'), /http/);
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    srv.close();
  }
});
