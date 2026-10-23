const {chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
const OUT=process.env.QA_OUTPUT_DIR||'evidence/v1.0.14/browser',BASE=process.env.JETS_URL||'http://127.0.0.1:8211/';fs.mkdirSync(OUT,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],report={method:'Two actual rendered game documents, lobby UI team choices, host-owned RAF simulation and snapshot replication. Deterministic RTC data-channel fixture because native non-proxied WebRTC UDP is unavailable in this cloud. Crashes use controlled positions through real simulation death logic; the 30-second clock is accelerated. This is not a full combat sortie or public network test.',errors};page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(BASE);await page.waitForFunction(()=>window.__skybreak);
 report.nativeRtc=await page.evaluate(async()=>{try{await __skybreak.network.peer.createOffer();return{created:true}}catch(e){return{created:false,name:e.name,message:e.message}}finally{__skybreak.network.disconnect()}});if(!report.nativeRtc.created)assert.equal(report.nativeRtc.name,'NoLocalCandidatesError');
 await page.evaluate(async()=>{const {FixturePeer}=await import('./tests/helpers/rtc-fixture.js');window.__RTCFixturePeer=FixturePeer;window.RTCPeerConnection=FixturePeer;const iframe=document.createElement('iframe');iframe.name='guest';iframe.src='./';iframe.style.cssText='position:fixed;z-index:10000;right:8px;bottom:8px;width:490px;height:320px;border:2px solid #88ccb9';document.body.appendChild(iframe)});
 await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.__skybreak);const guest=page.frame({name:'guest'});await guest.waitForFunction(()=>window.__skybreak);
 for(const frame of [page,guest])await frame.evaluate(()=>{window.RTCPeerConnection=window.top.__RTCFixturePeer;const r=__skybreak.renderer;r.adaptiveQuality=.35;r.renderer.setPixelRatio(.35);r.resize()});
 const offer=await page.evaluate(()=>__skybreak.network.peer.createOffer()),answer=await guest.evaluate(code=>__skybreak.network.peer.acceptOffer(code),offer);await page.evaluate(code=>__skybreak.network.peer.acceptAnswer(code),answer);await guest.waitForFunction(()=>__skybreak.network.state.localId==='p1');
 await page.locator('#network-open').click();await page.locator('[data-team-pilot="p1"]').selectOption('0');await guest.waitForFunction(()=>__skybreak.network.state.teams.p1===0);await page.locator('[data-net="respawn-enabled"]').check();await guest.waitForFunction(()=>__skybreak.network.state.enemyRespawnSeconds===30);
 assert.equal(await page.locator('[data-net="respawn-delay"]').inputValue(),'30');
 await guest.evaluate(()=>document.querySelector('#network-open').click());assert.equal(await guest.locator('[data-net="respawn-enabled"]').isDisabled(),true);await guest.evaluate(()=>document.querySelector('#network-close').click());
 await page.locator('[data-net="respawn-options"]').scrollIntoViewIfNeeded();await page.screenshot({path:OUT+'/host-settings.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('[data-net="respawn-options"]').scrollIntoViewIfNeeded();await page.screenshot({path:OUT+'/host-settings-narrow.png'});await page.setViewportSize({width:1280,height:900});
 await page.locator('#network-close').click();await page.locator('#launch').click();await guest.waitForFunction(()=>__skybreak.state.pilots.filter(p=>p.human).length===2);
 for(const frame of [page,guest]){const s=await frame.evaluate(()=>__skybreak.state);assert(s.pilots.filter(p=>p.human).every(p=>p.team===0));assert(s.pilots.filter(p=>p.team===1).every(p=>!p.human));assert.equal(s.teamSize,2);}
 assert.equal(await guest.evaluate(()=>__skybreak.network.peer.setTeam('p1',1)),false);
 // Deterministic crash positions use real simulation kill/scheduling logic; accelerated clock is a fixture.
 await page.evaluate(()=>{const s=__skybreak.state;for(const p of s.pilots.filter(p=>p.team===1)){Object.assign(p,{grounded:false,departureActive:false,pos:{x:30000+p.slot*1000,y:-100,z:30000},speed:200,collisionGraceUntil:0});}__skybreak.setState(s);__skybreak.step()});
 await guest.waitForFunction(()=>__skybreak.state.pilots.filter(p=>p.team===1).every(p=>p.dead&&p.respawnAt>30));
 for(const frame of [page,guest])assert.equal(await frame.evaluate(()=>__skybreak.state.status),'playing');
 await page.waitForFunction(()=>document.querySelector('#enemy-respawn-note').textContent.includes('Enemy AI return'));
 report.pending=await guest.evaluate(()=>({time:__skybreak.state.time,timers:__skybreak.state.pilots.filter(p=>p.team===1).map(p=>p.respawnAt),text:document.querySelector('#enemy-respawn-note').textContent}));
 await page.screenshot({path:OUT+'/countdown.png'});
 await page.evaluate(()=>{const s=__skybreak.state;s.time=Math.min(...s.pilots.filter(p=>p.team===1).map(p=>p.respawnAt))-.1;__skybreak.setState(s);__skybreak.step(5)});
 assert.equal(await page.evaluate(()=>__skybreak.state.pilots.filter(p=>p.team===1).every(p=>p.dead)),true);
 await page.evaluate(()=>__skybreak.step(3));
 await guest.waitForFunction(()=>__skybreak.state.pilots.filter(p=>p.team===1).every(p=>!p.dead&&p.grounded&&p.departureActive));
 report.returned=await guest.evaluate(()=>__skybreak.state.pilots.filter(p=>p.team===1).map(p=>({id:p.id,runway:p.runwayId,grounded:p.grounded,departure:p.departureActive,deaths:p.deaths,respawnAt:p.respawnAt})));
 assert(report.returned.every(p=>p.runway==='northpoint'&&p.deaths===1&&p.respawnAt===null));
 await page.evaluate(()=>__skybreak.returnMenu());await guest.waitForFunction(()=>!__skybreak.network.state.teamsLocked);
 await page.locator('#launch').click();await guest.waitForFunction(()=>__skybreak.state.time<10&&__skybreak.state.enemyRespawnSeconds===30);
 assert.equal(await page.evaluate(()=>__skybreak.state.pilots.every(p=>!p.dead&&p.respawnAt===null)),true);
 assert.deepEqual(errors,[]);report.pass=true;console.log('PASS host settings, guest read-only/sync, real crash scheduling, accelerated 30-second timer, runway respawns and fresh restart');
}finally{fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
