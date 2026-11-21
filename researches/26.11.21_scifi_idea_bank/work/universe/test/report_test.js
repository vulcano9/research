/* Headless-Prüfung des fertigen bericht.html (Ideen-Universum).
 *
 *   NODE_PATH=/tmp/opencode/uvtest/node_modules node work/universe/test/report_test.js
 */
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const REPORT = 'file://' + encodeURI(path.join(ROOT, 'bericht.html'));
const OUT = __dirname;
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
let pass = 0, fail = 0;
const errors = [];

function check(name, ok, extra) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra === undefined ? '' : ' ' + JSON.stringify(extra)));
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function ready(page) {
  for (let i = 0; i < 200; i++) {
    const ok = await page.evaluate(() => {
      const u = document.getElementById('sfib-universe');
      return !!(u && window.SFIB_UNIVERSE && window.SFIB_UNIVERSE.isReady());
    });
    if (ok) return;
    await sleep(150);
  }
  throw new Error('Seite nicht bereit');
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log('SHOT ' + name);
}

async function scrollTo(page, sel, offset) {
  await page.evaluate((s, off) => {
    const el = document.querySelector(s);
    if (!el) throw new Error('fehlt: ' + s);
    const top = el.getBoundingClientRect().top + window.scrollY - (off || 0);
    window.scrollTo({ top, behavior: 'instant' });
  }, sel, offset || 0);
  await sleep(350);
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
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url().slice(0, 120)));

  await page.goto(REPORT, { waitUntil: 'load', timeout: 120000 });
  await ready(page);
  await sleep(900);

  // 1. Hero
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(300);
  const hero = await page.evaluate(() => {
    const art = document.querySelector('.hero-art');
    return {
      bg: !!art && /^url\("data:image\/webp/.test(art.style.backgroundImage),
      hidden: art ? art.hidden : true,
      buttons: [...document.querySelectorAll('.hero-actions .btn')].map(b => b.textContent.trim())
    };
  });
  check('Hero-Bild als Hintergrund', hero.bg && !hero.hidden, hero);
  check('Hero-Knöpfe', hero.buttons.join('|') === 'Ins Universum|Überrasch mich', hero.buttons);
  await shot(page, 'report_hero.png');

  // 2. Universum
  await scrollTo(page, '#universum', 60);
  await sleep(900);
  const uni = await page.evaluate(() => ({
    ideas: JSON.parse(document.getElementById('sfib-universe').textContent).ideas.length,
    images: Object.keys(JSON.parse(document.getElementById('sfib-images').textContent)).length,
    canonical: !!document.querySelector('#universum #uv-stage canvas'),
    folded: document.getElementById('uv-controls-body').hidden,
    old: !!document.getElementById('entdecken') || !!document.getElementById('zufall')
  }));
  check('Universum: 4.417 Ideen, 25 Bilder, Bühne da', uni.ideas === 4417 && uni.images === 25 && uni.canonical, uni);
  check('Steuerpult startet eingeklappt', uni.folded === true, uni.folded);
  check('Alte Abschnitte entfernt', uni.old === false);
  await shot(page, 'report_universum.png');

  // 3. Daten
  await scrollTo(page, '#daten', 60);
  await sleep(500);
  await shot(page, 'report_daten.png');

  // 3b. Tooltip deutsch (Kategorie)
  await page.evaluate(() => {
    document.querySelector('#chart-cats').scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await sleep(400);
  const catBar = await page.evaluate(() => {
    const g = document.querySelector('#chart-cats [data-cat]');
    const r = g.getBoundingClientRect();
    return { x: r.left + 30, y: r.top + r.height / 2, cat: g.dataset.cat };
  });
  await page.mouse.move(catBar.x, catBar.y);
  await sleep(250);
  const tip = await page.evaluate(() => {
    const t = document.getElementById('chart-tip');
    return { hidden: t.hidden, text: t.textContent };
  });
  check('Diagramm-Tooltip auf Deutsch', !tip.hidden && /Raumfahrttechnik/.test(tip.text), { tip, catBar });

  // 4. Klick auf Kategorie-Balken -> gefilterte Liste
  await page.mouse.click(catBar.x, catBar.y);
  await sleep(1600);
  const filtered = await page.evaluate(() => ({
    scrollY: window.scrollY,
    list: !document.getElementById('uv-listmode').hidden,
    count: (document.getElementById('uv-listcount') || {}).textContent || '',
    cat: window.SFIB_UNIVERSE.getState().filter.cat,
    hash: location.hash
  }));
  check('Kategorie-Klick filtert Universum', filtered.list && filtered.cat === catBar.cat && /793 Ideen/.test(filtered.count), filtered);
  await scrollTo(page, '#uv-listmode', 70);
  await sleep(400);
  await shot(page, 'report_kategorie_liste.png');

  // 4b. Autor:in und Jahrzehnt
  await page.evaluate(() => window.SFIB_UNIVERSE.resetFilter());
  await page.evaluate(() => {
    document.querySelector('#chart-authors').scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await sleep(350);
  const authorBar = await page.evaluate(() => {
    const g = document.querySelector('#chart-authors [data-author]');
    const r = g.getBoundingClientRect();
    return { x: r.left + 60, y: r.top + r.height / 2, author: g.dataset.author };
  });
  await page.mouse.click(authorBar.x, authorBar.y);
  await sleep(1000);
  const byAuthor = await page.evaluate(() => window.SFIB_UNIVERSE.getState().filter.author);
  check('Autor:innen-Klick filtert Universum', byAuthor === authorBar.author, { byAuthor, authorBar });

  await page.evaluate(() => window.SFIB_UNIVERSE.resetFilter());
  await page.evaluate(() => {
    document.querySelector('#chart-decades').scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await sleep(350);
  const decadeBar = await page.evaluate(() => {
    const g = document.querySelector('#chart-decades [data-y1]');
    const r = g.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 40, from: +g.dataset.y1, to: +g.dataset.y2 };
  });
  await page.mouse.click(decadeBar.x, decadeBar.y);
  await sleep(1000);
  const byDecade = await page.evaluate(() => window.SFIB_UNIVERSE.getState().filter);
  check('Jahrzehnt-Klick filtert Universum', byDecade.from === decadeBar.from && byDecade.to === decadeBar.to, { byDecade, decadeBar });

  // 5. Klick auf Scatter-Punkt -> Idee im Drawer
  await page.evaluate(() => window.SFIB_UNIVERSE.resetFilter());
  await scrollTo(page, '#chart-scatter', 120);
  await sleep(400);
  const pt = await page.evaluate(() => {
    const circles = [...document.querySelectorAll('#chart-scatter circle[data-idea]')];
    for (const c of circles) {
      const r = c.getBoundingClientRect();
      const y = r.top + r.height / 2;
      const x = r.left + r.width / 2;
      if (y > 120 && y < window.innerHeight - 120 && x > 40 && x < window.innerWidth - 40) {
        return { x, y, id: +c.dataset.idea };
      }
    }
    return null;
  });
  check('Scatter-Punkt sichtbar', !!pt, pt);
  if (pt) await page.mouse.click(pt.x, pt.y);
  await sleep(1200);
  const drawer = await page.evaluate(() => ({
    hidden: document.getElementById('uv-drawer').hidden,
    name: (document.querySelector('#uv-drawer .uv-dname') || {}).textContent || '',
    hash: location.hash
  }));
  check('Scatter-Punkt öffnet Idee im Drawer', !drawer.hidden && /idee=/.test(drawer.hash), { pt, drawer });
  await scrollTo(page, '#universum', 60);
  await sleep(700);
  await shot(page, 'report_scatter_drawer.png');

  // 6. Startups -> "Ideen dazu ansehen"
  await page.evaluate(() => { document.getElementById('uv-drawer-close').click(); });
  await scrollTo(page, '#startups', 60);
  await sleep(300);
  await shot(page, 'report_startups.png');
  const q = await page.evaluate(() => {
    const b = document.querySelector('#startups .js-search-idea');
    b.scrollIntoView({ block: 'center' });
    return b.dataset.q;
  });
  await sleep(300);
  await page.evaluate(() => document.querySelector('#startups .js-search-idea').click());
  await sleep(1600);
  const st = await page.evaluate(() => ({
    list: !document.getElementById('uv-listmode').hidden,
    q: window.SFIB_UNIVERSE.getState().filter.q,
    count: (document.getElementById('uv-listcount') || {}).textContent || '',
    cards: document.querySelectorAll('#uv-list .uv-card').length
  }));
  check('Startup-Knopf filtert Universum', st.list && st.q.length > 0 && st.cards > 0, st);
  await scrollTo(page, '#uv-listmode', 70);
  await sleep(400);
  await shot(page, 'report_startup_universum.png');

  // 7. Hero "Überrasch mich"
  await page.evaluate(() => { window.SFIB_UNIVERSE.resetFilter(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await sleep(400);
  await page.evaluate(() => document.querySelector('[data-hero="surprise"]').click());
  await sleep(1400);
  const surprise = await page.evaluate(() => ({
    drawer: !document.getElementById('uv-drawer').hidden,
    y: window.scrollY,
    sectionTop: document.getElementById('universum').getBoundingClientRect().top
  }));
  check('Hero "Überrasch mich" öffnet Zufallsstern', surprise.drawer === true && Math.abs(surprise.sectionTop) < 140, surprise);

  // 8. Warteliste deutsch + klickbar
  await page.evaluate(() => { document.getElementById('uv-drawer-close').click(); });
  await scrollTo(page, '#chart-scatter', 120);
  const wait = await page.evaluate(() => {
    const li = document.querySelector('#waitlist li');
    return { text: li.textContent, wid: li.dataset.wid || null };
  });
  check('Warteliste mit deutschem Namen', /Schwerelosigkeit/.test(wait.text) && !!wait.wid, wait);

  // 9. Mobile
  const m = await browser.newPage();
  m.on('console', c => { if (c.type() === 'error') errors.push('mobile console: ' + c.text()); });
  m.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
  await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await m.goto(REPORT, { waitUntil: 'load', timeout: 120000 });
  await ready(m);
  await sleep(900);
  await m.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(300);
  await shot(m, 'report_mobile_hero.png');
  await scrollTo(m, '#uv-stage', 62);
  await sleep(900);
  const muni = await m.evaluate(() => {
    const r = document.getElementById('uv-stage').getBoundingClientRect();
    const folded = document.getElementById('uv-controls-body').hidden;
    const c = document.getElementById('uv-controls').getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), folded, controlsVisible: c.bottom <= window.innerHeight + 2, overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  check('Mobil: Bühne passt, Pult eingeklappt', muni.w <= 390 && muni.h >= 540 && muni.folded && muni.controlsVisible && !muni.overflowX, muni);
  await shot(m, 'report_mobile_universum.png');

  // 10. Konsole
  check('Keine JS-/Konsolenfehler', errors.length === 0, errors.slice(0, 5));
  check('Kein Fehlerkasten auf der Seite', await page.evaluate(() => !document.getElementById('sfib-error')));

  console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
  await browser.close();
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
