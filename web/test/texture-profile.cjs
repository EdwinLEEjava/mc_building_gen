const {chromium} = require('playwright');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();
  page.on('crash',()=>console.log('CRASH')); page.on('pageerror',e=>console.log('ERROR',e.message));
  page.on('console',m=>{if(m.type()==='error')console.log(m.text());});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../viewer/index.html')).href);
  await page.waitForFunction(()=>typeof model!=='undefined'&&model);
  await page.evaluate(()=>{
   window.profile=[];const r=rebuild;rebuild=function(){const t=performance.now();try{return r();}finally{profile.push(performance.now()-t);}};
  });
  for(const dir of process.argv.slice(2)){
   const start=Date.now();await page.locator('#texDir').setInputFiles(dir);
   await page.waitForFunction(label=>TEX.label===label&&TEX.layers.size&&!TEX.loading,path.basename(dir));
   console.log('IMPORT',Date.now()-start,await page.evaluate(()=>({dims:[model.W,model.H,model.L],rebuilds:profile.splice(0),bitmapMB:[...TEX.bitmaps.values()].reduce((s,b)=>s+b.width*b.height*4,0)/1048576})));
  }
  const count=await page.locator('#samples .chip').count();
  for(let i=0;i<count;i++){
   await page.locator('#samples .chip').nth(i).evaluate(el=>el.click());
   await page.waitForTimeout(150);
   console.log('SAMPLE',i,await page.evaluate(()=>({dims:[model.W,model.H,model.L],rebuilds:profile.splice(0),layers:TEX.layers.size})));
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
