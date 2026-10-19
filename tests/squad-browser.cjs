/* Local browser QA for flexible squadrons. Native keys and normal rAF; only explicitly
 * labelled setup fixtures write simulation state. Requires an existing Playwright
 * installation and Chromium; never installs software or changes browser policies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = require('/workspace/shared/lumee-waitlist/node_modules/playwright')); }
const BASE = process.env.JETS_URL || 'http://127.0.0.1:8236/';
const OUT = process.env.QA_OUTPUT_DIR || path.join(__dirname, '../evidence/new-squadrons');
fs.mkdirSync(OUT, {recursive:true});
const report = {
  method: 'Actual Chromium, native keyboard events, normal requestAnimationFrame. Team selection and launch use menu controls. Deterministic pose, threat, crash and completion setup fixtures are named per check; no simulation stepping.',
  started: new Date().toISOString(), base: BASE, viewport:{width:1280,height:800},
  environment: 'Installed Chromium with software WebGL. Timing describes this execution environment and is not a physical-device performance guarantee.',
  checks: [], pageErrors: [], consoleErrors: [], blocked: null
};
let browser, page;
const write = () => fs.writeFileSync(path.join(OUT,'squad-browser.json'),JSON.stringify(report,null,2));
async function check(name, fn) {
  const row={name};
  try { row.detail=await fn(); row.pass=true; console.log('PASS',name); }
  catch(e) { row.pass=false; row.error=e.stack||String(e); console.error('FAIL',name, e.message); if(page)try{await page.screenshot({path:path.join(OUT,name.replace(/[^a-z0-9]+/gi,'-')+'-failure.png')});}catch{} }
  report.checks.push(row); write();
}
async function state(){return page.evaluate(()=>window.__skybreak.state);}
async function afterFrames(seconds=.15){const t=(await state()).time;await page.waitForFunction(t=>__skybreak.paused||__skybreak.state.status!=='playing'||__skybreak.state.time>=t, t+seconds,{timeout:Math.max(12000,seconds*2500)});}
async function fixture({teamSizes=[1,1],speed=280,throttle=.7,aligned=false,yaw=0}={}) {
  await page.evaluate(({teamSizes,speed,throttle,aligned,yaw})=>{
    __skybreak.start({mode:'dogfight',skirmish:true,teamSizes,seed:382});
    const s=__skybreak.state;
    s.pilots.forEach((p,i)=>Object.assign(p,{human:true,grounded:false,pos:i===0?{x:0,y:3000,z:0}:aligned&&i===1?{x:Math.sin(yaw)*2400,y:3000,z:Math.cos(yaw)*2400}:{x:9000+i*150,y:4500,z:9000},yaw,pitch:0,roll:0,speed,throttle,lock:0,targetId:null,aiShot:999,hp:100,dead:false}));
    __skybreak.setState(s);
  },{teamSizes,speed,throttle,aligned,yaw});
  await afterFrames();
}
async function nativeSelect(selector,value){
  const control=page.locator(selector), options=await control.locator('option').evaluateAll(es=>es.map(e=>({value:e.value,disabled:e.disabled})));
  const at=options.findIndex(o=>o.value===String(value)); assert(at>=0,`${selector}: missing ${value}`);assert(!options[at].disabled,`${selector}: disabled ${value}`);
  await control.focus();await page.keyboard.press('Home');
  for(let i=0;i<at;i++)if(!options[i+1].disabled)await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');assert.equal(await control.inputValue(),String(value));
}
async function menu(){await page.evaluate(()=>__skybreak.returnMenu());await page.locator('#menu').waitFor({state:'visible'});}
(async()=>{
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  page=await browser.newPage({viewport:report.viewport});page.setDefaultTimeout(12000);
  page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
  await page.goto(BASE);await page.waitForFunction(()=>window.__skybreak?.renderer&&document.getElementById('menu')&&!document.getElementById('menu').hidden);
  await check('menu-custom-squadrons-native-selects',async()=>{
    const results=[];
    for(const teams of [[1,1,0],[1,2,0],[1,3,0],[3,2,3],[4,4,4]]){
      await menu();
      const layouts=await page.locator('#team-layout option').evaluateAll(es=>es.map(e=>({value:e.value,label:e.textContent})));
      const custom=layouts.find(o=>/custom/i.test(o.value+' '+o.label));assert(custom,'Custom squadron layout is available');
      await nativeSelect('#team-layout',custom.value);
      // Lower every squad first so a prior 12-aircraft layout cannot disable a later choice.
      await nativeSelect('#team-charlie',0);await nativeSelect('#team-bravo',1);await nativeSelect('#team-alpha',1);
      for(const [id,n] of [['alpha',teams[0]],['bravo',teams[1]],['charlie',teams[2]]])await nativeSelect('#team-'+id,n);
      await page.locator('#launch').focus();await page.keyboard.press('Enter');await afterFrames(.05);
      const s=await state(),counts=teams.map((_,team)=>s.pilots.filter(p=>p.team===team).length);
      assert.deepEqual(counts,teams);assert.equal(s.skirmish,true);assert.equal(s.pilots.length,teams.reduce((a,b)=>a+b,0));
      const teamRadii=teams.map((_,team)=>{const ps=s.pilots.filter(p=>p.team===team);return Math.max(0,...ps.flatMap(p=>ps.map(q=>Math.hypot(p.pos.x-q.pos.x,p.pos.y-q.pos.y,p.pos.z-q.pos.z))));});
      assert(teamRadii.every(r=>r<700),'Friendly formation remains compact');
      results.push({teams,counts,teamRadii,hud:await page.locator('#team-count').innerText()});
      if(teams[2]===3)await page.screenshot({path:path.join(OUT,'three-squadrons.png')});
    }
    await menu();return results;
  });
  await check('aircraft-cap-and-all-team-rendering',async()=>{
    await page.evaluate(()=>__skybreak.start({mode:'dogfight',skirmish:true,teamSizes:[8,8,8],seed:12}));await afterFrames(.15);
    const s=await state();assert(s.pilots.length<=12&&s.pilots.length>=3);
    const models=await page.evaluate(()=>[...__skybreak.renderer.jets.values()].map(m=>({team:m.userData.team,visible:m.visible})));assert.equal(models.length,s.pilots.length);assert(models.some(m=>m.team===2));
    return{count:s.pilots.length,teams:s.teamSizes,models};
  });
  await check('native-steering-chase-and-cockpit',async()=>{
    const rows=[];
    for(const view of ['chase','cockpit'])for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const [key,sign]of[['KeyA',-1],['KeyD',1]]){
      await fixture({yaw});if(view==='cockpit')await page.keyboard.press('KeyV');
      await page.keyboard.down(key);await afterFrames(.5);await page.keyboard.up(key);
      const row=await page.evaluate(({yaw,key,view})=>{const p=__skybreak.state.pilots[0],r=__skybreak.renderer;const a=r.project({x:p.pos.x+Math.sin(p.yaw)*1200,y:p.pos.y,z:p.pos.z+Math.cos(p.yaw)*1200}),b=r.project({x:p.pos.x+Math.sin(yaw)*1200,y:p.pos.y,z:p.pos.z+Math.cos(yaw)*1200});return{key,view,yaw,heading:p.yaw,roll:p.roll,screenTurn:a.x-b.x,rendererView:r.view,cockpitVisible:!document.getElementById('cockpit').hidden};},{yaw,key,view});
      assert(row.screenTurn*sign>5,JSON.stringify(row));assert(row.roll*sign<0);assert.equal(row.rendererView,view);assert.equal(row.cockpitVisible,view==='cockpit');rows.push(row);
    }
    await page.screenshot({path:path.join(OUT,'cockpit.png')});return rows;
  });
  await check('native-power-pitch-and-press-only-missiles',async()=>{
    const rows=[];
    for(const key of ['ArrowUp','ArrowDown','KeyW','KeyS']){await fixture();const before=(await state()).pilots[0];await page.keyboard.down(key);await afterFrames(.55);await page.keyboard.up(key);const after=(await state()).pilots[0];if(key==='ArrowUp')assert(after.throttle>before.throttle+.1&&Math.abs(after.pitch)<.001);if(key==='ArrowDown')assert(after.throttle<before.throttle-.1&&Math.abs(after.pitch)<.001);if(key==='KeyW')assert(after.pitch>.1&&after.throttle===before.throttle);if(key==='KeyS')assert(after.pitch<-.1&&after.throttle===before.throttle);rows.push({key,before:{speed:before.speed,pitch:before.pitch,throttle:before.throttle},after:{speed:after.speed,pitch:after.pitch,throttle:after.throttle}});}
    for(const [key,ammo]of[['KeyQ','heat'],['KeyE','radar']]){await fixture({aligned:true});await page.waitForFunction(()=>__skybreak.state.pilots[0].lock>1.5);const before=(await state()).pilots[0];await page.keyboard.down(key);await afterFrames(2.7);await page.keyboard.up(key);const after=(await state()).pilots[0];assert.equal(after[ammo],before[ammo]-1);assert.equal(after.throttle,before.throttle);assert(Math.abs(after.roll)<1e-8);rows.push({key,ammo,before:before[ammo],after:after[ammo],lock:after.lock});}
    return rows;
  });
  await check('airspeed-mach-display-and-native-acceleration',async()=>{
    const speeds=[];
    for(const speed of [500/1.943844,600/1.943844,343,686]){await fixture({speed});const row=await page.evaluate(()=>({mps:__skybreak.state.pilots[0].speed,knots:document.getElementById('speed').textContent,mach:document.getElementById('mach').textContent}));assert(Math.abs(Number(row.knots)-row.mps*1.943844)<3);assert(Math.abs(Number(row.mach)-row.mps/343)<.03,'Mach must describe actual airspeed');speeds.push(row);}
    await fixture({speed:270,throttle:.7});const before=(await state()).pilots[0].speed;await page.keyboard.down('ArrowUp');await afterFrames(30);await page.keyboard.up('ArrowUp');const after=(await state()).pilots[0].speed;assert(after/343>=1.99,'Sustained native power should reach approximately Mach 2');
    await page.screenshot({path:path.join(OUT,'high-speed.png')});return{displayFixtures:speeds,naturalAcceleration:{before,after}};
  });
  await check('lock-warning-distinct-from-inbound',async()=>{
    await fixture();await page.evaluate(()=>{const s=__skybreak.state,p=s.pilots[0],q=s.pilots[1];q.pos={x:0,y:3000,z:1800};q.yaw=Math.PI;q.targetId=p.id;q.lock=2;__skybreak.setState(s);});await afterFrames(.1);
    const text=await page.locator('#threat').innerText();assert(/LOCK|TRACK/i.test(text));assert(!/MISSILE INBOUND/i.test(text));await page.screenshot({path:path.join(OUT,'lock-warning.png')});return{text};
  });
  await check('native-flares-and-chaff-defeat-correct-missiles',async()=>{
    const rows=[];
    for(const [kind,key,wrong,ammo]of[['heat','KeyF','KeyC','flares'],['radar','KeyC','KeyF','chaff']]){
      await fixture();await page.evaluate(kind=>{const s=__skybreak.state,p=s.pilots[0],q=s.pilots[1];q.pos={x:p.pos.x,y:p.pos.y,z:p.pos.z-1800};q.yaw=0;q.targetId=p.id;q.lock=3;s.missiles=[{id:++s.serial,type:kind,ownerId:q.id,team:q.team,targetId:p.id,pos:{x:p.pos.x,y:p.pos.y,z:p.pos.z-650},dir:{x:0,y:0,z:1},speed:p.speed+90,age:0,life:17,decoyed:false}];__skybreak.setState(s);},kind);await afterFrames(.08);
      const warning=await page.locator('#threat').innerText();assert(/MISSILE|INBOUND/i.test(warning));assert(new RegExp(kind==='heat'?'FLARE':'CHAFF','i').test(warning));await page.screenshot({path:path.join(OUT,kind+'-warning.png')});
      const before=(await state()).pilots[0];await page.keyboard.press(wrong);await afterFrames(.08);assert(!(await state()).missiles[0]?.decoyed,'Wrong countermeasure must not defeat missile');
      await page.keyboard.press(key);await page.waitForFunction(()=>__skybreak.state.events.some(e=>e.type==='evade'&&e.pilotId==='host'));
      const after=await state();assert.equal(after.pilots[0][ammo],before[ammo]-1);assert.equal(after.pilots[0].hp,100);assert(after.missiles.some(m=>m.decoyed));rows.push({kind,key,warning,ammoBefore:before[ammo],ammoAfter:after.pilots[0][ammo],hp:after.pilots[0].hp,events:after.events.filter(e=>['counter','evade'].includes(e.type))});
    }return rows;
  });
  await check('crash-then-r-and-button-respawn-keep-match',async()=>{
    const rows=[];
    for(const action of ['KeyR','button']){
      await fixture({teamSizes:[3,2,3]});await page.evaluate(()=>{const s=__skybreak.state;s.time=37;s.scores[0]=2;const p=s.pilots[0];p.kills=2;p.pos={x:0,y:0,z:0};p.pitch=-.3;__skybreak.setState(s);});
      await page.waitForFunction(()=>__skybreak.state.pilots[0].dead);const dead=await state();assert.equal(dead.status,'playing');assert(dead.time>=37);assert.equal(await page.locator('#result-dialog').evaluate(e=>e.open),false);
      await page.waitForFunction(()=>{const b=document.getElementById('respawn-button');return b&&!b.hidden&&!b.disabled;});await page.screenshot({path:path.join(OUT,'respawn-available.png')});
      if(action==='button')await page.locator('#respawn-button').click();else await page.keyboard.press(action);
      await page.waitForFunction(()=>!__skybreak.state.pilots[0].dead);const after=await state();assert.equal(after.status,'playing');assert(after.time>=dead.time);assert.equal(after.pilots[0].id,dead.pilots[0].id);assert.equal(after.pilots[0].team,dead.pilots[0].team);assert.equal(after.pilots[0].hp,100);
      if(dead.scores!==undefined)assert.deepEqual(after.scores,dead.scores);if(dead.teamScores!==undefined)assert.deepEqual(after.teamScores,dead.teamScores);if(dead.pilots[0].kills!==undefined)assert.equal(after.pilots[0].kills,dead.pilots[0].kills);if(dead.pilots[0].deaths!==undefined)assert.equal(after.pilots[0].deaths,dead.pilots[0].deaths);
      rows.push({action,before:{time:dead.time,score:dead.scores||dead.teamScores,deaths:dead.pilots[0].deaths},after:{time:after.time,score:after.scores||after.teamScores,deaths:after.pilots[0].deaths,pos:after.pilots[0].pos}});
    }return rows;
  });
  await check('pause-resume-restart-and-result-keyboard-paths',async()=>{
    await fixture({teamSizes:[3,2,3]});await page.keyboard.press('KeyP');assert(await page.locator('#pause-dialog').evaluate(e=>e.open));const paused=(await state()).time;await page.waitForTimeout(350);assert.equal((await state()).time,paused);
    await page.keyboard.press('Escape');await afterFrames(.2);assert((await state()).time>paused);await page.keyboard.press('KeyP');await page.locator('#restart').focus();await page.keyboard.press('Enter');await afterFrames(.05);assert((await state()).time<2);assert.equal((await state()).pilots.length,8);
    await page.evaluate(()=>{const s=__skybreak.state;s.status='complete';s.result={winner:0,title:'Completion fixture',text:'Keyboard result navigation test'};__skybreak.setState(s);});await page.waitForFunction(()=>document.getElementById('result-dialog').open);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'result-restart');assert(await page.locator('#result-dialog').evaluate(e=>e.open));
    await page.keyboard.press('Enter');await afterFrames(.05);assert.equal((await state()).status,'playing');await page.keyboard.press('KeyP');await page.locator('#return-menu').focus();await page.keyboard.press('Enter');assert(await page.locator('#menu').isVisible());return{pausedTime:paused,restartTeams:8,resultReplay:true,menuReturn:true};
  });
  await check('twelve-aircraft-render-cost-and-pause-freeze',async()=>{
    await fixture({teamSizes:[4,4,4]});await page.evaluate(()=>{const r=__skybreak.renderer,original=r.render;r.qaSamples=[];r.render=function(...args){const start=performance.now();const result=original.apply(this,args);this.qaSamples.push({ms:performance.now()-start,time:performance.now(),calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles});return result;};});
    await page.waitForFunction(()=>__skybreak.renderer.qaSamples.length>=60,undefined,{timeout:30000});
    const perf=await page.evaluate(()=>{const r=__skybreak.renderer,a=r.qaSamples.slice(-60),times=a.map(x=>x.ms).sort((a,b)=>a-b),deltas=a.slice(1).map((v,i)=>v.time-a[i].time).sort((a,b)=>a-b);return{samples:a.length,renderMedianMs:times[30],renderP95Ms:times[57],rafMedianMs:deltas[29],rafP95Ms:deltas[56],latest:a.at(-1),pixelRatio:r.renderer.getPixelRatio(),quality:r.adaptiveQuality};});
    assert(Number.isFinite(perf.renderMedianMs));await page.keyboard.press('KeyP');await page.waitForTimeout(100);const count=await page.evaluate(()=>__skybreak.renderer.qaSamples.length);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>__skybreak.renderer.qaSamples.length),count);return perf;
  });
  await check('no-javascript-errors',async()=>{assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.consoleErrors,[]);return{pageErrors:report.pageErrors,consoleErrors:report.consoleErrors};});
  report.pass=report.checks.every(r=>r.pass);if(!report.pass)process.exitCode=1;
} catch(e) { report.blocked=e.stack||String(e);report.pass=false;console.error(e);process.exitCode=1; }
finally {report.finished=new Date().toISOString();write();if(browser)await browser.close();}
})();
