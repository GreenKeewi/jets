// Explicit airborne fixture, then native keys and ordinary animation frames only.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const BASE=process.env.JETS_URL||'http://127.0.0.1:8201/',OUT=process.env.QA_OUTPUT_DIR||path.join(__dirname,'../evidence/v1.0.8/g-response');
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:800}}),report={base:BASE,method:'One explicit airborne normal-mode fixture at 3000 m and 315 m/s. Native A held for 15 simulation seconds, then released for four seconds. Ordinary rAF simulation; no stepping or state writes after the fixture. Not a runway-to-airborne test.',samples:[],errors:[]};
 page.on('pageerror',e=>report.errors.push(e.message));
 const read=()=>page.evaluate(()=>{const s=__skybreak.state,p=s.pilots[0],el=document.getElementById('g-vision');return{time:s.time,status:s.status,dead:p.dead,grounded:p.grounded,advanced:p.maneuverAssist,roll:p.roll,speed:p.speed,altitude:p.pos.y,normalLoad:p.normalLoad,gLoad:p.gLoad,airframeWear:p.airframeWear,hp:p.hp,gWearActive:p.gWearActive,gVision:p.gVision,gRedout:p.gRedout,blackedOut:!!p.blackedOut,hitFlash:!document.getElementById('hit-flash').hidden,background:getComputedStyle(el).backgroundImage,warning:document.getElementById('g-warning').textContent,overlayOpacity:getComputedStyle(el).opacity,hudG:document.getElementById('g-load').textContent};});
 try{
  await page.goto(BASE);await page.waitForFunction(()=>window.__skybreak);
  await page.evaluate(()=>{__skybreak.start({mode:'freeflight',seed:42});const s=__skybreak.state;s.flightStage='route';Object.assign(s.pilots[0],{pos:{x:0,y:3000,z:0},yaw:0,pitch:0,roll:0,speed:315,throttle:.78,grounded:false,gearDown:false,departureActive:false,maneuverAssist:false});__skybreak.setState(s);});
  await page.keyboard.press('KeyV');const initial=await read();report.initial=initial;
  await page.keyboard.down('KeyA');let turn;
  while(true){const row=await read();report.samples.push({phase:'held-turn',...row});assert(!row.blackedOut,'ordinary 15-second bank must not blackout');assert(!row.dead);assert(!row.advanced);if(row.time-initial.time>=15){turn=row;break;}await page.waitForTimeout(250);}
  await page.screenshot({path:path.join(OUT,'browser-held-turn.png')});
  await page.keyboard.up('KeyA');report.turn=turn;
  await page.waitForFunction(t=>__skybreak.state.time>=t+4,turn.time,{timeout:30000});report.recovered=await read();report.samples.push({phase:'released-recovery',...report.recovered});
  await page.screenshot({path:path.join(OUT,'browser-recovered.png')});
  const peak=Math.max(...report.samples.map(x=>x.normalLoad));assert(peak>6&&peak<9.1,'honest high signed loading during held turn');assert(turn.gVision<=.12,'vignette stays light');assert(turn.airframeWear>0&&turn.airframeWear<2,'sustained turn causes slight wear');assert(!report.samples.some(x=>x.hitFlash),'wear never flashes combat damage');assert(turn.background.includes('rgba(0, 0, 0, 0) 68%'),'center stays transparent');assert(!turn.gRedout,'no redout');assert(report.recovered.gVision<.02);assert(Math.abs(report.recovered.roll)<.05);assert(!report.recovered.blackedOut);assert.deepEqual(report.errors,[]);report.pass=true;
  console.log(JSON.stringify({pass:report.pass,turn,recovered:report.recovered,peakLoad:peak},null,2));
 }finally{await page.keyboard.up('KeyA').catch(()=>{});fs.writeFileSync(path.join(OUT,'browser-report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
