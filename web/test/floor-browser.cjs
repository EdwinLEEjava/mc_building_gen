const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({channel:process.env.TEXTURE_BROWSER||'msedge',headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../viewer/index.html')).href);
  await page.waitForFunction(()=>typeof model!=='undefined'&&model);
  const fields=await page.evaluate(()=>['g_floors','g_floor_height'].map(id=>{const el=document.getElementById(id);return {label:!!el.closest('label'),group:el.closest('.grp')?.querySelector('summary').textContent,min:el.min,max:el.max};}));
  assert(fields.every(f=>f.label&&f.group===fields[0].group));assert.deepEqual(fields.map(f=>[f.min,f.max]),[['1','5'],['3','7']]);
  await page.locator('#g_floors').fill('3');await page.locator('#g_floors').dispatchEvent('change');
  assert.equal(await page.locator('#floor-info-button').isVisible(),false);
  await page.locator('#g_floors').fill('4');await page.locator('#g_floors').dispatchEvent('change');
  assert(await page.locator('#floor-info-button').isVisible());assert.equal(await page.locator('#floor-hint').isVisible(),false);
  const before=await page.locator('#g_floor_height').boundingBox();
  await page.locator('#floor-info-button').hover();assert(await page.locator('#floor-hint').isVisible());
  const after=await page.locator('#g_floor_height').boundingBox();assert.deepEqual(after,before,'Hint must not shift other controls');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#floor-hint').isVisible(),false);
  await page.locator('#floor-info-button').click();assert(await page.locator('#floor-hint').isVisible());
  await page.locator('#g_floor_height').click();assert.equal(await page.locator('#floor-hint').isVisible(),false);
  await page.locator('#g_floors').fill('5');await page.locator('#g_floors').dispatchEvent('change');
  const result=await page.evaluate(()=>{const r=MCGen.generate(readForm());const n=MCGen.schemNBT(r.structure);return {floors:r.spec.floors,bytes:n.bytes.length};});
  assert.equal(result.floors,5);assert(result.bytes>0);
  await page.locator('#g_floors').fill('2');await page.locator('#g_floors').dispatchEvent('change');assert.equal(await page.locator('#floor-info-button').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('Floor input grouping, hint interactions, stable layout, and five-floor export passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
