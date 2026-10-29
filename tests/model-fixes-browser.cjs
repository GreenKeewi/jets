const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const BASE=process.env.JETS_URL||'http://127.0.0.1:8211/',BEFORE=process.env.JETS_BASELINE_URL||'http://127.0.0.1:8212/',OUT=process.env.QA_OUTPUT_DIR||'evidence/v1.1.1/browser';
fs.mkdirSync(OUT,{recursive:true});
async function reviewScene(page,url){
 await page.goto(url);await page.waitForFunction(()=>window.__skybreak);
 await page.evaluate(async()=>{
  const THREE=await import('./vendor/three.module.js'),{createAircraft,animateAircraft}=await import('./aircraft.js'),{defaultLoadout,aircraftDefinition}=await import('./loadouts.js');
  __skybreak.returnMenu();const host=document.createElement('section');host.id='model-review';host.style.cssText='position:fixed;inset:0;z-index:50000;background:#bdcbd3';document.body.append(host);
  const label=document.createElement('div');label.style.cssText='position:absolute;top:18px;left:24px;font:600 18px system-ui;color:#203644;z-index:1';host.append(label);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,800);renderer.setPixelRatio(1);renderer.setClearColor(0xbdcbd3);host.append(renderer.domElement);
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xf8fcff,0x72777b,2.2));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(30,50,50);scene.add(sun);const rim=new THREE.DirectionalLight(0xb8dcff,1.1);rim.position.set(-40,12,-20);scene.add(rim);
  const camera=new THREE.OrthographicCamera(-30,30,20,-20,.1,300);let model;
  window.__review=(id,view,brake=0,tanks=false)=>{
   if(model){scene.remove(model);const geometries=new Set(),materials=new Set();model.traverse(n=>{if(n.geometry)geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])if(m)materials.add(m)});for(const g of geometries)g.dispose();for(const m of materials)m.dispose()}
   model=createAircraft(0,false,id);scene.add(model);const loadout=defaultLoadout(id);if(tanks)for(const s of aircraftDefinition(id).stations)if(s.allowed.includes('tank'))loadout.stations[s.id]='tank';
   const pilot={aircraftId:id,loadout,heat:4,radar:id==='f16'?2:4,gearDown:false,airbrake:!!brake,airbrakeDeployment:brake,grounded:false,throttle:0,speed:250};for(let i=0;i<180;i++)animateAircraft(model,pilot,i/60,1/60);
   model.userData.detailed.visible=true;model.userData.distant.visible=false;
   camera.left=-36;camera.right=36;camera.top=24;camera.bottom=-24;camera.up.set(0,1,0);if(view==='top'){camera.position.set(0,80,0);camera.up.set(0,0,1)}else if(view==='side')camera.position.set(70,0,0);else if(view==='rear')camera.position.set(40,25,-60);else camera.position.set(40,24,55);
   camera.lookAt(0,0,0);camera.updateProjectionMatrix();label.textContent=`${aircraftDefinition(id).name} · ${view} · brake ${brake?'deployed':'stowed'}${tanks?' · external tanks':''}`;renderer.render(scene,camera);
   const mesh=model.userData.stores?.meshes.tank;let tankSize;if(mesh){mesh.geometry.computeBoundingBox();const size=mesh.geometry.boundingBox.getSize(new THREE.Vector3());tankSize={x:size.x,y:size.y,z:size.z,count:mesh.count}}
   return{aircraftId:model.userData.aircraftId,tankSize,brakes:model.userData.airbrakes.map(b=>({rotation:b.node.rotation.toArray().slice(0,3),position:b.node.position.toArray(),visible:b.node.visible})),nozzles:model.userData.nozzles.length};
  };
 });
}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[],report={method:'Matched orthographic WebGL model views of v1.1.0 baseline and working release; native X/O/K in actual game with explicit safe airborne fixtures. No physical-device or performance claim.',errors,before:{},after:{},controls:{}};
 page.on('pageerror',error=>errors.push(error.message));
 try{
  for(const [name,url] of [['before',BEFORE],['after',BASE]]){
   await reviewScene(page,url);
   for(const [id,view,brake,tanks] of [['su37','top',0,false],['su37','side',0,false],['su37','rear',1,false],['fa18e','rear',1,false],['f16','side',0,true],['fa18e','side',0,true]]){
    const key=`${id}-${view}-${brake?'brake':'clean'}${tanks?'-tanks':''}`;report[name][key]=await page.evaluate(args=>__review(...args),[id,view,brake,tanks]);await page.screenshot({path:`${OUT}/${name}-${key}.png`});
   }
  }
  for(const id of ['f16','fa18e']){const before=report.before[`${id}-side-clean-tanks`].tankSize,after=report.after[`${id}-side-clean-tanks`].tankSize;assert(before.z/before.x<1.1);assert(after.z/after.x>4,'tank buffer must itself be elongated');assert.equal(after.count,3)}
  await page.goto(BASE);await page.waitForFunction(()=>window.__skybreak);
  for(const id of ['f16','fa18e','su37']){
   await page.evaluate(id=>{__skybreak.start({mode:'freeflight',aircraftId:id,seed:19});const s=__skybreak.state,p=s.pilots[0];s.flightStage='practice';Object.assign(p,{grounded:false,departureActive:false,gearDown:false,gearManual:true,pos:{x:-20000,y:3000,z:-20000},yaw:0,pitch:0,roll:0,speed:260,throttle:.78});__skybreak.setState(s)},id);
   await page.keyboard.press('KeyO');await page.waitForTimeout(150);const enabled=id!=='f16';assert.equal(await page.evaluate(()=>__skybreak.state.pilots[0].aoaLimiterOff),enabled);assert.equal(await page.locator('#aoa-status').isVisible(),enabled);
   await page.keyboard.press('KeyK');await page.waitForFunction(()=>__skybreak.state.pilots[0].maneuverAssist===true);assert.equal(await page.evaluate(()=>__skybreak.state.pilots[0].aoaLimiterOff),enabled);
   await page.keyboard.press('KeyX');await page.waitForFunction(()=>__skybreak.state.pilots[0].airbrakeDeployment>.9);
   const on=await page.evaluate(()=>{const p=__skybreak.state.pilots[0],d=__skybreak.renderer.jets.get('host').userData;return{flag:p.airbrake,deployment:p.airbrakeDeployment,visual:d.brakeAmount,rotations:d.airbrakes.map(b=>b.node.rotation.toArray().slice(0,3)),advanced:p.maneuverAssist,override:p.aoaLimiterOff}});assert(on.flag);if(enabled)assert(Math.abs(on.deployment-on.visual)<.06);assert(on.rotations.some(v=>v.some(n=>Math.abs(n)>.1)));
   await page.keyboard.press('KeyX');await page.waitForFunction(()=>__skybreak.state.pilots[0].airbrakeDeployment<.1);report.controls[id]={on,off:await page.evaluate(()=>({flag:__skybreak.state.pilots[0].airbrake,deployment:__skybreak.state.pilots[0].airbrakeDeployment}))};
  }
  await page.evaluate(()=>{const s=__skybreak.state,p=s.pilots[0];p.aircraftId='f16';p.loadout={stations:{}};p.heat=0;p.radar=0;p.aoaLimiterOff=true;__skybreak.setState(s)});assert.equal(await page.evaluate(()=>__skybreak.state.pilots[0].aoaLimiterOff),false);
  const custom=await page.evaluate(async()=>{const k=await import('./keybindings.js');const b=k.defaultBindings();b.aoaLimiter=['KeyU'];localStorage.setItem(k.BINDINGS_KEY,JSON.stringify(b));return b.aoaLimiter});assert.deepEqual(custom,['KeyU']);await page.reload();await page.waitForFunction(()=>window.__skybreak);
  await page.evaluate(()=>{__skybreak.start({mode:'freeflight',aircraftId:'su37'});});await page.keyboard.press('KeyU');await page.waitForFunction(()=>__skybreak.state.pilots[0].aoaLimiterOff===true);report.savedKeyPreserved=true;
  assert.deepEqual(errors,[]);report.pass=true;console.log('PASS matched model views, ellipsoid tank buffers, aircraft-specific X brakes, supported O override, K independence and saved custom key');
 }finally{fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
