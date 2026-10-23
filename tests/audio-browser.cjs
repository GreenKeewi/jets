// Functional rendered Web Audio assertions, not a human listening test.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage();await page.goto(process.env.BASE||'http://127.0.0.1:8033');
  const result=await page.evaluate(async()=>{
   const {FlightAudio}=await import('/audio.js');
   const render=async({inside=false,burner=false,muted=false,dead=false,events=false}={})=>{
    const ctx=new OfflineAudioContext(2,48000*2,48000),Native=window.AudioContext;window.AudioContext=function(){return ctx};
    const audio=new FlightAudio();audio.init();window.AudioContext=Native;
    audio.enabled=!muted;
    const p={id:'pilot',pos:{x:0,y:1000,z:0},yaw:0,pitch:0,roll:0,speed:300,throttle:burner?1.1:1,afterburnerActive:burner,fuelKg:100,engineHealth:1,gLoad:1,gunShots:0,dead};
    audio.update(p,true,events?{type:'radar',range:100}:null,inside?'cockpit':'chase');
    if(events)for(const type of ['launch','gun-hit','counter','damage','target','landed'])audio.event(type);
    const scheduledVoices=audio.voices.size;const output=await ctx.startRendering();let peak=0,sum=0,finite=true;for(let ch=0;ch<2;ch++)for(const sample of output.getChannelData(ch)){peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;finite&&=Number.isFinite(sample)}
    return{peak,rms:Math.sqrt(sum/(output.length*2)),finite,scheduledVoices,voices:audio.voices.size};
   };
   const mixes={};for(const [name,options] of Object.entries({dry:{},cockpit:{inside:true},burner:{burner:true},muted:{muted:true},dead:{dead:true},events:{events:true}}))mixes[name]=await render(options);
   const live=new FlightAudio();live.init();await live.ctx.resume();
   const analyser=live.ctx.createAnalyser();analyser.fftSize=2048;live.master.connect(analyser);
   let gunBursts=0;const originalBurst=live.burst.bind(live);live.burst=(...args)=>{gunBursts++;originalBurst(...args)};
   const livePilot={id:'live',pos:{x:0,y:1000,z:0},speed:300,throttle:1,fuelKg:100,engineHealth:1,gunShots:30};
   live.update(livePilot,true,null);const initialBursts=gunBursts;livePilot.gunShots++;live.update(livePilot,true,null);mixes.gun={initialBursts,newBursts:gunBursts};
   live.update({id:'live',pos:{x:0,y:1000,z:0},speed:300,throttle:1,fuelKg:100,engineHealth:1},true,null);
   await new Promise(resolve=>setTimeout(resolve,300));const wave=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(wave);
   mixes.live={state:live.ctx.state,peak:Math.max(...wave.map(Math.abs)),finite:wave.every(Number.isFinite)};await live.ctx.close();return mixes;
  });
  assert.equal(result.gun.initialBursts,0);assert.equal(result.gun.newBursts,1);assert(result.events.scheduledVoices>0);assert.equal(result.events.voices,0);
  assert.equal(result.live.state,'running');assert(result.live.peak>0);
  for(const [name,mix]of Object.entries(result)){if(['live','gun'].includes(name))continue;assert(mix.finite,name);assert(mix.peak<1,name+' clipped');if(['muted','dead'].includes(name))assert.equal(mix.peak,0,name);else assert(mix.rms>.0001,name+' silent');}
  assert(result.burner.rms>result.dry.rms);assert(result.cockpit.rms<result.dry.rms);
  console.log(JSON.stringify({method:'Chromium OfflineAudioContext rendered PCM and running live AudioContext/analyser, no human listening',mixes:result},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
