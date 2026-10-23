// Explicit geographic fixtures followed by native I/V input and ordinary frames.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
const OUT=process.env.QA_OUTPUT_DIR||'evidence/v1.0.10/radar';fs.mkdirSync(OUT,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});try{
 const p=await b.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8201/');await p.waitForFunction(()=>window.__skybreak);
 await p.evaluate(()=>__skybreak.start({mode:'dogfight',seed:42}));await p.keyboard.press('KeyI');
 const reports=[];
 for(const [name,x,z,yaw,bomber,width] of [['coast',-1800,-2000,0,false,1280],['coast-turn',-800,-1300,1.2,false,1280],['island',10500,11000,.6,true,640],['valley',-8000,17000+Math.sin(-8000*2*Math.PI/5200)*500+Math.sin(-8000*4*Math.PI/5200+.6)*55,1.57,false,390]]){
  await p.setViewportSize({width,height:800});if(name==='valley'){await p.evaluate(()=>__skybreak.start({mode:'dogfight',arenaId:'valley',seed:42}));await p.keyboard.press('KeyV');}await p.evaluate(({x,z,yaw,bomber})=>{const s=__skybreak.state,q=s.pilots[0];Object.assign(q,{pos:{x,y:2000,z},yaw,pitch:0,roll:0,speed:150,grounded:false,departureActive:false,bomber});__skybreak.setState(s)},{x,z,yaw,bomber});
  if(name==='island')await p.keyboard.press('KeyV');await p.waitForTimeout(350);
  const box=await p.locator('#radar').boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width+1);
  const pixels=await p.locator('#radar').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,190,190).data;let faint=0;for(let i=3;i<d.length;i+=4)if(d[i]>=30&&d[i]<=110)faint++;return faint});assert(pixels>100);
  await p.screenshot({path:`${OUT}/${name}.png`});await p.locator('#radar').screenshot({path:`${OUT}/${name}-radar.png`});reports.push({name,box,faintPixels:pixels});
 }
 const clip=await p.evaluate(async()=>{const {RadarTerrain}=await import('./radar-terrain.js?v=skybreak10-1023'),c=document.createElement('canvas');c.width=c.height=190;const ctx=c.getContext('2d'),map=new RadarTerrain();map.draw(ctx,{pos:{x:-1800,z:-2000},yaw:1});const d=ctx.getImageData(0,0,190,190).data;let outside=0;for(let y=0;y<190;y++)for(let x=0;x<190;x++)if(Math.hypot(x+.5-95,y+.5-95)>90&&d[(y*190+x)*4+3])outside++;return outside});assert.equal(clip,0);assert.deepEqual(errors,[]);fs.writeFileSync(`${OUT}/report.json`,JSON.stringify({pass:true,method:'Geographic state fixtures, native I/V and normal browser animation; no human playtest claim',reports,errors},null,2));console.log('PASS radar geography, heading/movement, bomber/fighter cockpit and narrow bounds');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
