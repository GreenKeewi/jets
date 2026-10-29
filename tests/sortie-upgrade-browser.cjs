const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const OUT=process.env.QA_OUTPUT_DIR||'evidence/v1.1.1/sortie-browser',BASE=process.env.JETS_URL||'http://127.0.0.1:8201/';
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],report={method:'Rendered local Chromium WebGL; native loadout/menu/key controls plus explicit airborne fixtures. Two game documents use deterministic RTC channels, not a physical-device connection. No subjective audio listening claim.',errors};
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(BASE);await page.waitForFunction(()=>window.__skybreak&&!document.querySelector('#menu').hidden);
  assert.equal(await page.locator('#fatal').isVisible(),false);
  await page.locator('.sortie-setup > summary').click();
  for(const id of ['f16','fa18e','su37']){
   await page.selectOption('#aircraft-select',id);await page.waitForTimeout(180);
   report[id]=await page.evaluate(()=>{const p=__skybreak.renderer.jets.get('host');return{aircraftId:p.userData.aircraftId,engines:p.userData.flames.length,stores:p.userData.stores?.length,summary:document.querySelector('#loadout-summary').textContent}});
   assert.equal(report[id].aircraftId,id);assert.equal(report[id].engines,id==='f16'?1:2);
   await page.screenshot({path:`${OUT}/preview-${id}.png`});
  }
  await page.selectOption('#aircraft-select','f16');await page.locator('#loadout-editor > summary').click();
  await page.selectOption('#loadout-innerwing-l','tank');await page.selectOption('#loadout-innerwing-r','tank');await page.selectOption('#loadout-centerline','tank');
  await page.selectOption('#starting-fuel','50');await page.locator('#launch').click();
  let state=await page.evaluate(()=>__skybreak.state),pilot=state.pilots[0];assert.equal(pilot.heat+pilot.radar,6);assert.equal(pilot.fuelCapacityKg,5120);assert(pilot.fuelKg>3510&&pilot.fuelKg<=3520);
  await page.keyboard.press('KeyO');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>__skybreak.state.pilots[0].aoaLimiterOff),false);assert.equal(await page.evaluate(()=>!!__skybreak.state.pilots[0].maneuverAssist),false);
  await page.keyboard.press('KeyK');await page.waitForFunction(()=>__skybreak.state.pilots[0].maneuverAssist===true);assert.equal(await page.evaluate(()=>__skybreak.state.pilots[0].aoaLimiterOff),false);
  await page.evaluate(()=>{const s=__skybreak.state,p=s.pilots[0];s.time=20;Object.assign(p,{grounded:false,departureActive:false,gearDown:false,pos:{x:0,y:3000,z:0},speed:230,pitch:0,yaw:0,roll:0,throttle:.78,gVision:.5});for(const q of s.pilots.slice(1))Object.assign(q,{human:true,grounded:false,departureActive:false,pos:{x:4000+q.slot*300,y:3000,z:4000}});__skybreak.setState(s)});
  await page.keyboard.press('KeyV');await page.waitForTimeout(250);
  report.cockpit=await page.evaluate(()=>{const c=__skybreak.renderer.cockpitInterior;const cross=document.querySelector('#crosshair').getBoundingClientRect(),readout=document.querySelector('#combat-readout').getBoundingClientRect();return{layout:c.controlLayout,stickX:c.stick.position.x,rootY:c.fighterRoot.position.y,cross:{x:cross.x,y:cross.y},readout:{y:readout.y},vision:document.querySelector('#g-vision').style.background}});
  assert.equal(report.cockpit.layout,'right-side-stick');assert(report.cockpit.stickX>.4);assert(report.cockpit.rootY<0);
  await page.screenshot({path:OUT+'/f16-cockpit.png'});
  // Ace conceals type in text and countermeasure ready hints.
  await page.evaluate(()=>{const s=__skybreak.state,p=s.pilots[0],q=s.pilots[1];s.difficulty='ace';s.missiles=[{id:9999,type:'radar',ownerId:q.id,team:q.team,targetId:p.id,pos:{x:0,y:3000,z:-1800},dir:{x:0,y:0,z:1},speed:500,age:0,life:17,decoyed:false,seekerLost:false}];q.pos={x:0,y:3000,z:-2300};q.yaw=0;q.lock=3;q.targetId=p.id;__skybreak.setState(s)});
  await page.waitForFunction(()=>document.querySelector('#threat-label').textContent==='MISSILE INBOUND');
  report.ace=await page.locator('#threat').innerText();assert(!/HEAT|RADAR|CHAFF|FLARES/.test(report.ace));assert.equal(await page.locator('#chaff-count').evaluate(node=>node.parentElement.classList.contains('ready')),false);
  await page.screenshot({path:OUT+'/ace-hud.png'});
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Controls & accessibility',exact:true}).click();
  await page.locator('#audio-volume').focus();await page.keyboard.press('Home');for(let n=0;n<40;n++)await page.keyboard.press('ArrowRight');await page.locator('#voice-warnings').uncheck();
  await page.locator('[data-binding="aoaLimiter"]').click();await page.keyboard.press('KeyU');await page.locator('#keybindings-close').click();await page.locator('#return-menu').click();
  report.rebinding=await page.evaluate(()=>JSON.parse(localStorage.getItem('skybreak-keybindings-v1')).aoaLimiter);assert.deepEqual(report.rebinding,['KeyU']);
  // A real second rendered document with the project's deterministic RTC fixture.
  await page.evaluate(async()=>{const{FixturePeer}=await import('./tests/helpers/rtc-fixture.js');window.__fixture=FixturePeer;window.RTCPeerConnection=FixturePeer;const f=document.createElement('iframe');f.name='friend';f.src='./';f.style.cssText='position:fixed;z-index:10000;right:8px;bottom:8px;width:490px;height:320px;border:2px solid #88ccb9';document.body.append(f)});
  await page.waitForFunction(()=>document.querySelector('iframe').contentWindow.__skybreak);const guest=page.frame({name:'friend'});
  await guest.evaluate(()=>window.RTCPeerConnection=top.__fixture);
  const offer=await page.evaluate(()=>__skybreak.network.peer.createOffer()),answer=await guest.evaluate(code=>__skybreak.network.peer.acceptOffer(code),offer);await page.evaluate(code=>__skybreak.network.peer.acceptAnswer(code),answer);
  await guest.waitForFunction(()=>__skybreak.network.state.localId==='p1');
  await page.locator('#network-open').click();await page.locator('[data-team-pilot="p1"]').selectOption('0');
  await page.locator('#team-size').selectOption('2');await page.locator('[data-net="enemy-count"]').selectOption('4');await page.locator('[data-net="respawn-enabled"]').check();
  await guest.waitForFunction(()=>__skybreak.network.state.enemyRespawnSeconds===30&&__skybreak.network.state.matchSettings.enemyTeamSize===4);
  assert.equal(await page.locator('#network-dialog .sortie-setup').count(),1);report.lobby=await page.locator('[data-net="match-summary"]').innerText();
  await page.locator('[data-net="match-summary"]').scrollIntoViewIfNeeded();await page.screenshot({path:OUT+'/coop-lobby.png'});
  await page.setViewportSize({width:390,height:844});await page.locator('[data-net="match-summary"]').scrollIntoViewIfNeeded();await page.screenshot({path:OUT+'/coop-lobby-narrow.png'});await page.setViewportSize({width:1440,height:900});
  await page.locator('[data-net="launch"]').click();await guest.waitForFunction(()=>__skybreak.state.pilots.length===6&&__skybreak.state.pilots.filter(p=>p.human).length===2);
  for(const frame of [page,guest]){const s=await frame.evaluate(()=>__skybreak.state);assert.deepEqual(s.teamSizes,[2,4]);assert.equal(s.enemyRespawnSeconds,30);assert(s.pilots.filter(p=>p.human).every(p=>p.team===0));assert(s.pilots.filter(p=>p.team===1).every(p=>!p.human));assert.equal(s.pilots[0].fuelCapacityKg,5120);}
  report.coopState=await guest.evaluate(()=>({teamSizes:__skybreak.state.teamSizes,respawn:__skybreak.state.enemyRespawnSeconds,loadout:__skybreak.state.pilots[0].loadout}));
  await page.evaluate(()=>{const s=__skybreak.state;for(const p of s.pilots.filter(p=>p.team===1))Object.assign(p,{grounded:false,departureActive:false,pos:{x:30000+p.slot*1000,y:-100,z:30000},speed:200,collisionGraceUntil:0});__skybreak.setState(s);__skybreak.step()});
  await guest.waitForFunction(()=>__skybreak.state.pilots.filter(p=>p.team===1).every(p=>p.dead));
  await page.evaluate(()=>{const s=__skybreak.state;s.time=Math.max(...s.pilots.filter(p=>p.team===1).map(p=>p.respawnAt))+.01;__skybreak.setState(s);__skybreak.step()});
  await guest.waitForFunction(()=>__skybreak.state.pilots.filter(p=>p.team===1).every(p=>!p.dead&&p.grounded&&p.deaths===1));report.coopRespawn=true;
  assert.deepEqual(errors,[]);report.pass=true;console.log('PASS aircraft, tanks, cockpit, native limiter/rebind, Ace warning, synchronized 2v4 co-op and 30s respawn');
 }finally{fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
