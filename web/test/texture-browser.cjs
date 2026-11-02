const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({channel:process.env.TEXTURE_BROWSER || 'msedge', headless:true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('crash', () => errors.push('Renderer crashed'));
    page.on('console', m => { if(m.type() === 'error') errors.push(m.text()); });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../../viewer/index.html')).href);
    await page.waitForFunction(() => typeof model !== 'undefined' && model);
    await page.evaluate(() => {
      window.packStats = {reads:0, peakReads:0, decodes:0, peakDecodes:0, created:0, closed:0, rebuilds:0};
      window.testPacks = [];
      const text = Blob.prototype.text, decode = createImageBitmap, close = ImageBitmap.prototype.close, mesh = rebuild;
      Blob.prototype.text = async function() {
        packStats.peakReads = Math.max(packStats.peakReads, ++packStats.reads);
        try { return await text.call(this); } finally { packStats.reads--; }
      };
      window.createImageBitmap = async (...args) => {
        packStats.peakDecodes = Math.max(packStats.peakDecodes, ++packStats.decodes);
        try { const bitmap = await decode(...args); packStats.created++; return bitmap; } finally { packStats.decodes--; }
      };
      ImageBitmap.prototype.close = function() { if(this.width) packStats.closed++; return close.call(this); };
      rebuild = function() { packStats.rebuilds++; return mesh(); };
    });
    const ready = () => page.waitForFunction(() => TEX.layers.size > 0 && !TEX.loading, {}, {timeout:15000});
    assert.ok(process.argv.length > 2, 'Supply extracted pack directories or ZIP/JAR fixtures');
    for(const folder of process.argv.slice(2)) {
      await page.evaluate(() => { packStats.rebuilds = 0; });
      await page.locator(fs.statSync(folder).isDirectory() ? '#texDir' : '#texZip').setInputFiles(folder);
      await page.waitForFunction(label => TEX.label === label && TEX.layers.size > 0 && !TEX.loading, path.basename(folder));
      await ready();
      const state = await page.evaluate(() => ({layers:TEX.layers.size, bad:[...TEX.bad], want:[...(TEX.want||[])], glError:gl.getError()}));
      assert.ok(state.layers > 0); assert.deepEqual(state.bad, []); assert.equal(state.glError, 0);
      assert.equal(await page.evaluate(() => TEX.layers.has('stone')), true);
      assert.equal(await page.evaluate(() => packStats.rebuilds), 1, 'Pack import must build geometry only once');
      await page.evaluate(() => { if(testPacks.length < 2) testPacks.push(TEX.files); });
      const cache = await page.evaluate(async () => {
        await packSaveQueue;
        const db = await idb();
        try {
          const rec = (await cacheTx(db, 'pack', 'readonly', tx => tx.objectStore('pack').get('current'))).result;
          const count = (await cacheTx(db, 'bytes', 'readonly', tx => tx.objectStore('bytes').count())).result;
          const stone = rec.entries.find(([key]) => key === 'stone')[1];
          const row = (await cacheTx(db, 'bytes', 'readonly', tx => tx.objectStore('bytes').get(stone))).result;
          return {version:rec.version, expected:rec.count, count, legacyHandles:!!rec.files, byteRecord:row.data instanceof ArrayBuffer};
        } finally { db.close(); }
      });
      assert.equal(cache.version, 2); assert.equal(cache.count, cache.expected);
      assert.equal(cache.legacyHandles, false); assert.equal(cache.byteRecord, true);
      await page.evaluate(async () => { await restorePack(); if(TEX.loading) await TEX.loading; });
      assert.equal(await page.evaluate(() => TEX.layers.has('stone')), true);
      console.log('PASS complete pack cache and restore', cache);
      console.log('PASS', folder, state);
    }
    const stress = await page.evaluate(async () => {
      const timings = [];
      for(let i=0;i<20;i++) {
        const start = performance.now();
        await usePack('stress-' + i, testPacks[i % testPacks.length], false);
        if(TEX.loading) await TEX.loading;
        timings.push(performance.now() - start);
      }
      return {...packStats, live:TEX.bitmaps.size, maxSwitchMs:Math.max(...timings)};
    });
    assert.ok(stress.peakReads <= 8); assert.ok(stress.peakDecodes <= 8);
    assert.equal(stress.created - stress.closed, stress.live, 'Old native bitmaps must be released');
    console.log('PASS 20 switches and native resource bounds', stress);
    await page.locator('#texUse').evaluate(el => el.click());
    assert.equal(await page.evaluate(() => !!resolveDef('minecraft:stone').tx), false);
    await page.locator('#texUse').evaluate(el => el.click()); await ready();
    await page.evaluate(async () => {
      const original = createImageBitmap, blob = texFile('stone');
      let release; const gate = new Promise(r => { release = r; });
      window.createImageBitmap = async b => { await gate; return original(b); };
      await usePack('old', new Map([['stone', blob]]), false);
      const replacement = usePack('new', new Map([['stone', blob]]), false);
      release(); await replacement; window.createImageBitmap = original;
    });
    await ready(); assert.equal(await page.evaluate(() => TEX.label), 'new');
    await page.evaluate(async () => {
      await savePack(TEX.label, TEX.files);
    });
    await page.reload(); await ready();
    assert.equal(await page.evaluate(() => TEX.label), 'new');
    assert.deepEqual(errors, []);
    console.log('PASS toggle, overlapping loads, saved-pack restore, and browser errors');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

