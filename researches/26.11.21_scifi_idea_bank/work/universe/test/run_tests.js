/* Headless-Tests fuer das Ideen-Universum.
 *
 * Voraussetzung: preview.html existiert (python3 work/universe/preview.py)
 * und puppeteer-core ist erreichbar, z. B.:
 *
 *   mkdir -p /tmp/uvtest && cd /tmp/uvtest && npm i puppeteer-core
 *   NODE_PATH=/tmp/uvtest/node_modules node work/universe/test/run_tests.js
 *
 * Chrome-Pfad ueber CHROME=... ueberschreibbar.
 */
const path = require('path');
const puppeteer = require('puppeteer-core');

const PREVIEW = 'file://' + encodeURI(path.resolve(__dirname, '..', 'preview.html'));
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
let pass = 0, fail = 0;
const errors = [];

function check(name, ok, extra) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra === undefined ? '' : ' ' + JSON.stringify(extra)));
  ok ? pass++ : fail++;
}

async function ready(page) {
  for (let i = 0; i < 150; i++) {
    if (await page.evaluate(() => !!(window.SFIB_UNIVERSE && window.SFIB_UNIVERSE.isReady()))) return;
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('Seite nicht bereit');
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files', '--hide-scrollbars'],
    defaultViewport: { width: 1440, height: 900 }
  });
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  await page.goto(PREVIEW, { waitUntil: 'load', timeout: 60000 });
  await ready(page);
  await new Promise(r => setTimeout(r, 700));

  // 1. API / Drawer
  const ok1 = await page.evaluate(() => window.SFIB_UNIVERSE.openIdea(1));
  await new Promise(r => setTimeout(r, 900));
  const d1 = await page.evaluate(() => ({
    hidden: document.getElementById('uv-drawer').hidden,
    name: (document.querySelector('#uv-drawer .uv-dname') || {}).textContent,
    hash: location.hash
  }));
  check('openIdea(1)', ok1 === true && d1.hidden === false && d1.name === 'Schlaf für Astronauten', d1);

  // 2. Suche
  await page.evaluate(() => window.SFIB_UNIVERSE.resetFilter());
  await page.click('#uv-q');
  await page.type('#uv-q', 'roboter', { delay: 12 });
  await new Promise(r => setTimeout(r, 550));
  const s1 = await page.evaluate(() => ({
    count: document.getElementById('uv-count').textContent,
    sugg: document.querySelectorAll('#uv-suggest button').length
  }));
  check('Suche "roboter" liefert Treffer', parseInt(s1.count.replace(/\./g, ''), 10) > 100, s1);
  check('Suchvorschlaege', s1.sugg === 8, s1.sugg);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 800));
  check('Tastatur oeffnet Vorschlag', await page.evaluate(() => !document.getElementById('uv-drawer').hidden));

  // 3. Bruecke
  await page.evaluate(() => { window.SFIB_UNIVERSE.resetFilter(); window.SFIB_UNIVERSE.openIdea(1); });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector('#uv-drawer [data-act="bridge-start"]').click());
  await page.evaluate(() => window.SFIB_UNIVERSE.openIdea(500));
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector('#uv-drawer [data-act="bridge-target"]').click());
  await page.evaluate(() => document.querySelector('#uv-bridge [data-bact="build"]').click());
  await new Promise(r => setTimeout(r, 1300));
  const br = await page.evaluate(() => ({
    steps: document.querySelectorAll('#uv-bresult .uv-step').length,
    summary: (document.querySelector('#uv-bresult .uv-bsum') || {}).textContent || ''
  }));
  check('Bruecke findet Weg', br.steps >= 2 && /Sprüng|Sprung/.test(br.summary), br);
  const step = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#uv-bresult .uv-step')];
    return btns[1] ? +btns[1].dataset.idea : null;
  });
  if (step != null) {
    await page.evaluate(i => document.querySelector('#uv-bresult .uv-step[data-idea="' + i + '"]').click(), step);
    await new Promise(r => setTimeout(r, 400));
    check('Bruecken-Schritt oeffnet Idee',
      await page.evaluate(() => window.SFIB_UNIVERSE.getState().selected) === step, step);
  } else {
    check('Bruecken-Schritt oeffnet Idee', false);
  }

  // 4. Filter + Liste
  await page.evaluate(() => window.SFIB_UNIVERSE.applyFilter({ q: 'mars', status: ['No'], ba: ['Atoms'] }));
  await new Promise(r => setTimeout(r, 800));
  const f1 = await page.evaluate(() => ({
    list: !document.getElementById('uv-listmode').hidden,
    cards: document.querySelectorAll('#uv-list .uv-card').length,
    count: document.getElementById('uv-listcount').textContent
  }));
  check('applyFilter oeffnet Liste', f1.list && f1.cards > 0, f1);
  await page.evaluate(() => window.SFIB_UNIVERSE.resetFilter());

  // 5. Sternbild
  await page.evaluate(() => window.SFIB_UNIVERSE.focusCluster(2));
  await new Promise(r => setTimeout(r, 1200));
  const cl = await page.evaluate(() => ({
    name: (document.querySelector('#uv-drawer .uv-cname') || {}).textContent,
    img: !!document.querySelector('#uv-drawer .uv-cimg img')
  }));
  check('focusCluster(2) mit Bild', cl.name === 'Die Diener' && cl.img, cl);

  // 6. Klick auf Stern
  await page.evaluate(() => {
    document.getElementById('uv-drawer-close').click();
    document.querySelector('[data-act="overview"]').click();
  });
  await new Promise(r => setTimeout(r, 1300));
  const p = await page.evaluate(() => window.SFIB_UNIVERSE._project(300));
  const box = await page.evaluate(() => {
    const el = document.getElementById('uv-stage');
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 60, behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  if (p && p.x > 10 && p.x < box.w - 10 && p.y > 10 && p.y < box.h - 10) {
    await page.mouse.click(box.x + p.x, box.y + p.y);
    await new Promise(r => setTimeout(r, 800));
    check('Klick auf Stern waehlt Idee',
      await page.evaluate(() => window.SFIB_UNIVERSE.getState().selected) === 300, p);
  } else {
    check('Klick auf Stern waehlt Idee', false, p);
  }

  // 7. Hash
  const page2 = await browser.newPage();
  page2.on('pageerror', e => errors.push('hash: ' + e.message));
  await page2.goto(PREVIEW + '#idee=100&q=schlaf', { waitUntil: 'load', timeout: 60000 });
  await ready(page2);
  await new Promise(r => setTimeout(r, 1000));
  const h = await page2.evaluate(() => ({
    name: (document.querySelector('#uv-drawer .uv-dname') || {}).textContent,
    q: document.getElementById('uv-q').value
  }));
  check('Hash laedt Idee und Filter', !!h.name && h.q === 'schlaf', h);

  // 8. Reduced Motion
  const page3 = await browser.newPage();
  page3.on('pageerror', e => errors.push('rm: ' + e.message));
  await page3.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page3.goto(PREVIEW, { waitUntil: 'load', timeout: 60000 });
  await ready(page3);
  await new Promise(r => setTimeout(r, 400));
  await page3.evaluate(() => window.SFIB_UNIVERSE.setView('time'));
  await new Promise(r => setTimeout(r, 300));
  const rm = await page3.evaluate(() => ({
    view: window.SFIB_UNIVERSE.getState().view,
    label: document.querySelector('[data-act="journey"]').textContent.trim()
  }));
  check('Reduced Motion', rm.view === 'time' && /Nächster Schritt/.test(rm.label), rm);

  // 9. Konsole
  check('Keine JS-Fehler', errors.length === 0, errors);

  console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
  await browser.close();
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
