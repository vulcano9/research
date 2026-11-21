/* Erzeugt die Screenshots in work/universe/test/.
 *
 *   NODE_PATH=/tmp/uvtest/node_modules node work/universe/test/shots.js
 *
 * Vorher: python3 work/universe/preview.py
 */
const path = require('path');
const puppeteer = require('puppeteer-core');

const FILE = 'file://' + encodeURI(path.resolve(__dirname, '..', 'preview.html'));
const OUT = __dirname;
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';

async function ready(p) {
  for (let i = 0; i < 150; i++) {
    if (await p.evaluate(() => !!(window.SFIB_UNIVERSE && window.SFIB_UNIVERSE.isReady()))) return;
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('Seite nicht bereit');
}

async function stageShot(page, name) {
  const el = await page.$('#uv-stage');
  await page.evaluate(() => {
    const el = document.getElementById('uv-stage');
    const top = el.getBoundingClientRect().top + window.scrollY - Math.max(0, (window.innerHeight - el.offsetHeight) / 2);
    window.scrollTo({ top: top, behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 350));
  await el.screenshot({ path: path.join(OUT, name) });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files', '--hide-scrollbars'],
    defaultViewport: { width: 1440, height: 900 }
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(FILE, { waitUntil: 'load' });
  await ready(page);
  await new Promise(r => setTimeout(r, 900));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await new Promise(r => setTimeout(r, 250));
  await page.screenshot({ path: path.join(OUT, 'head-1440.png') });

  await stageShot(page, 'galaxy-1440.png');

  // Galerie
  await page.evaluate(() => {
    const g = document.getElementById('uv-gallery');
    window.scrollTo({ top: g.getBoundingClientRect().top + window.scrollY - 150, behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 350));
  await page.screenshot({ path: path.join(OUT, 'gallery-1440.png') });

  await page.evaluate(() => window.SFIB_UNIVERSE.setView('time'));
  await new Promise(r => setTimeout(r, 1300));
  await stageShot(page, 'timeline-1440.png');

  await page.evaluate(() => window.SFIB_UNIVERSE.setView('wait'));
  await new Promise(r => setTimeout(r, 1300));
  await stageShot(page, 'wait-1440.png');

  await page.evaluate(() => window.SFIB_UNIVERSE.setView('galaxy'));
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => document.querySelector('#uv-color [data-color="cluster"]').click());
  await new Promise(r => setTimeout(r, 500));
  await stageShot(page, 'color-cluster-1440.png');
  await page.evaluate(() => document.querySelector('#uv-color [data-color="status"]').click());

  await page.evaluate(() => window.SFIB_UNIVERSE.openIdea(4));
  await new Promise(r => setTimeout(r, 1200));
  await stageShot(page, 'drawer-1440.png');

  // Suche
  await page.evaluate(() => {
    document.getElementById('uv-drawer-close').click();
    window.SFIB_UNIVERSE.resetFilter();
    document.querySelector('[data-act="overview"]').click();
    document.getElementById('uv-q').focus();
  });
  await new Promise(r => setTimeout(r, 900));
  await page.type('#uv-q', 'roboter', { delay: 14 });
  await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(OUT, 'search-1440.png') });
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.SFIB_UNIVERSE.resetFilter());

  // Bruecke
  await page.evaluate(() => window.SFIB_UNIVERSE.openIdea(1));
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => document.querySelector('#uv-drawer [data-act="bridge-start"]').click());
  await page.evaluate(() => window.SFIB_UNIVERSE.openIdea(500));
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => document.querySelector('#uv-drawer [data-act="bridge-target"]').click());
  await page.evaluate(() => document.querySelector('#uv-bridge [data-bact="build"]').click());
  await new Promise(r => setTimeout(r, 1500));
  await stageShot(page, 'bridge-1440.png');
  await page.evaluate(() => document.querySelector('#uv-bridge [data-bact="close"]').click());
  await page.evaluate(() => document.getElementById('uv-drawer-close').click());

  // Liste
  await page.evaluate(() => window.SFIB_UNIVERSE.applyFilter({ q: 'mars', status: ['No'], ba: ['Atoms'] }));
  await new Promise(r => setTimeout(r, 900));
  await page.evaluate(() => document.getElementById('uv-listmode').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await new Promise(r => setTimeout(r, 250));
  await page.screenshot({ path: path.join(OUT, 'liste-1440.png') });
  await page.evaluate(() => document.getElementById('uv-list-close').click());

  // Sternbild
  await page.evaluate(() => { window.SFIB_UNIVERSE.resetFilter(); window.SFIB_UNIVERSE.focusCluster(2); });
  await new Promise(r => setTimeout(r, 1500));
  await stageShot(page, 'sternbild-1440.png');

  // Zeitmaschine mitten in der Reise
  await page.evaluate(() => {
    document.getElementById('uv-drawer-close').click();
    window.SFIB_UNIVERSE.setView('galaxy');
    document.getElementById('uv-play').click();
  });
  await new Promise(r => setTimeout(r, 9000));
  await stageShot(page, 'play-1440.png');
  await page.evaluate(() => {
    document.getElementById('uv-play').click();
    document.getElementById('uv-today').click();
    const lc = document.getElementById('uv-list-close');
    if (!document.getElementById('uv-listmode').hidden) lc.click();
  });

  // Handy 390x844
  const mob = await browser.newPage();
  mob.on('pageerror', e => errors.push('mobile: ' + e.message));
  await mob.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mob.goto(FILE, { waitUntil: 'load' });
  await ready(mob);
  await new Promise(r => setTimeout(r, 900));
  await mob.screenshot({ path: path.join(OUT, 'mobile-390.png') });
  await stageShot(mob, 'mobile-galaxy-390.png');
  await mob.evaluate(() => window.SFIB_UNIVERSE.setView('time'));
  await new Promise(r => setTimeout(r, 1300));
  await stageShot(mob, 'mobile-time-390.png');
  await mob.evaluate(() => window.SFIB_UNIVERSE.setView('wait'));
  await new Promise(r => setTimeout(r, 1300));
  await stageShot(mob, 'mobile-wait-390.png');
  await mob.evaluate(() => window.SFIB_UNIVERSE.setView('galaxy'));
  await new Promise(r => setTimeout(r, 1200));
  await mob.evaluate(() => window.SFIB_UNIVERSE.openIdea(2));
  await new Promise(r => setTimeout(r, 1200));
  await stageShot(mob, 'mobile-drawer-390.png');
  await mob.evaluate(() => { document.getElementById('uv-drawer-close').click(); window.SFIB_UNIVERSE.focusCluster(2); });
  await new Promise(r => setTimeout(r, 1400));
  await stageShot(mob, 'mobile-cluster-390.png');
  await mob.evaluate(() => { document.getElementById('uv-drawer-close').click(); document.getElementById('uv-fold').click(); });
  await new Promise(r => setTimeout(r, 500));
  await stageShot(mob, 'mobile-filters-390.png');

  console.log('Screenshots in ' + OUT);
  console.log('JS-Fehler:', errors.length ? errors : 'keine');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
