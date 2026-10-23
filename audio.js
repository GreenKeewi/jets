import {worldVelocity as velocity} from './arcade-travel.js?v=skybreak13-1023';
// Original procedural jet, wind and radio cues; no downloaded audio or media permissions.
const clamp=(value,low,high)=>Math.max(low,Math.min(high,Number.isFinite(value)?value:0));
const NEARBY_VOICES=4,NEARBY_RANGE=2800,TRANSIENT_LIMIT=16;
export function flightSound(p,inside=false){
 const health=clamp(p.engineHealth??1,0,1),running=!p.dead&&health>0&&!(Number.isFinite(p.fuelKg)&&p.fuelKg<=0),thrust=clamp(p.throttle,0,1)*health*(running?1:0),mach=clamp(Number.isFinite(p.mach)?p.mach:(p.speed||0)/343,0,3),burner=running&&!p.bomber&&p.afterburnerActive?1:0,buffet=p.grounded?0:Math.max(0,1-Math.abs(mach-1)/.12),fastAir=clamp((mach-.55)/.45,0,1),drag=(p.airbrake?.045:0)+(p.gearDown?.025:0),load=clamp((Math.abs(p.gLoad||1)-3)/6,0,1);
 return{jet:((running?.035:0)+thrust*.23+burner*.16+buffet*.025)*(inside?.57:1),jetFrequency:(inside?280:450)+thrust*(inside?950:1850)+burner*520,jetQ:.9-burner*.4,
  wind:clamp(Math.pow(mach,1.25)*.19+fastAir*fastAir*(3-2*fastAir)*.12+drag*clamp(mach*2,0,1),0,.5)*(inside?.56:1),windFrequency:(inside?850:1800)+mach*(inside?1200:1800),
  engineFrequency:(p.bomber?28:35)+thrust*55+burner*14+mach*4,engine:((running?.009:0)+thrust*.038+burner*.024)*(inside?1.35:1),engineCutoff:(inside?120:170)+thrust*80,
  turbineFrequency:(p.bomber?120:185)+thrust*550+burner*110+mach*24,turbine:((running?.002:0)+thrust*.012+burner*.004)*(inside?.55:1),
  rumble:(burner*.17+buffet*.09+load*.026+drag*.6)*(inside?.8:1),rumbleFrequency:70+thrust*100+burner*50,
  harmonicFrequency:280+thrust*880+burner*125,harmonic:thrust*.0035*(inside?.4:1)};
}
export function threatAudioProfile(threat){
 if(!threat)return null;
 const info=typeof threat==='object'?threat:{type:'heat'},type=info.type,pan=Number.isFinite(info.bearing)?clamp(-Math.sin(info.bearing)*.88,-.88,.88):0;
 // Simulation bearings are positive-left; StereoPanner is positive-right.
 // Acquisition stays a slow advisory, never a launched-weapon alarm.
 if(type==='lock')return{type,period:info.locked?1.12:1.5,frequency:info.locked?430:360,duration:.14,gain:.03,urgent:false,pan,locked:!!info.locked};
 const range=info.range??700,time=info.timeToImpact??Infinity,urgent=(Number.isFinite(time)&&time<4)||(Number.isFinite(range)&&range<650);
 return{type:type==='radar'?'radar':'heat',period:urgent?.27:.7,frequency:type==='radar'?820:550,duration:.075,gain:urgent?.06:.045,urgent,pan};
}

export function nearbyJetSound(p,q,inside=false){
 const dx=q.pos.x-p.pos.x,dy=q.pos.y-p.pos.y,dz=q.pos.z-p.pos.z,distance=Math.hypot(dx,dy,dz),length=Math.max(1,distance),yaw=p.yaw||0,ours=velocity(p),theirs=velocity(q);
 const radial=((theirs.x-ours.x)*dx+(theirs.y-ours.y)*dy+(theirs.z-ours.z)*dz)/length,forward=(dx*Math.sin(yaw)+dz*Math.cos(yaw))/length;
 const pan=clamp((-dx*Math.cos(yaw)+dz*Math.sin(yaw))/length,-1,1),thrust=clamp(q.throttle,0,1),burner=!q.bomber&&q.afterburnerActive?1:0;
 const fade=clamp((NEARBY_RANGE-distance)/800,0,1),attenuation=fade/(1+Math.pow(distance/230,1.7)),doppler=clamp(343/(343+clamp(radial,-145,220)),.65,1.65);
 return{distance,radial,pan,doppler,gain:attenuation*(inside?.52:1),noise:.23+thrust*.16+burner*.065,tone:.009+thrust*.016,
  frequency:(460+thrust*1250+burner*350)*doppler*(inside?.65:1)*(forward<0?.78:1),engineFrequency:(q.bomber?54:76)+thrust*82,burner};
}
export class FlightAudio{
 constructor(){this.enabled=true;this.ctx=null;this.active=false;this.lastThreat=-Infinity;this.lastGunShots=0;this.lastPilotId=null;this.voices=new Set();this.nearby=[];this.wasAudible=false;this.lastCaution=-Infinity;this.cautionType=null;this.previousSystems=null}
 init(){
  if(this.ctx){this.ctx.resume().catch(()=>{});return}const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  this.ctx=new Audio();const a=this.ctx;this.master=a.createGain();this.master.gain.value=0;const compressor=a.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=14;compressor.ratio.value=4;compressor.attack.value=.004;compressor.release.value=.17;this.master.connect(compressor).connect(a.destination);
  this.noiseBuffer=a.createBuffer(1,a.sampleRate*3,a.sampleRate);const data=this.noiseBuffer.getChannelData(0);let brown=0;for(let i=0;i<data.length;i++){const white=Math.random()*2-1;brown=(brown+white*.025)/1.015;data[i]=white*.22+brown*.7}
  const jet=a.createBufferSource();jet.buffer=this.noiseBuffer;jet.loop=true;this.jetFilter=a.createBiquadFilter();this.jetFilter.type='bandpass';this.jetFilter.frequency.value=500;this.jetFilter.Q.value=.7;this.jetGain=a.createGain();this.jetGain.gain.value=0;jet.connect(this.jetFilter).connect(this.jetGain).connect(this.master);jet.start();
  const wind=a.createBufferSource();wind.buffer=this.noiseBuffer;wind.loop=true;const high=a.createBiquadFilter();high.type='highpass';high.frequency.value=450;this.windFilter=a.createBiquadFilter();this.windFilter.type='lowpass';this.windFilter.frequency.value=1600;this.windGain=a.createGain();this.windGain.gain.value=0;wind.connect(high).connect(this.windFilter).connect(this.windGain).connect(this.master);wind.start(0,.37);
  this.engine=a.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=42;this.engineFilter=a.createBiquadFilter();this.engineFilter.type='lowpass';this.engineFilter.frequency.value=135;this.engineGain=a.createGain();this.engineGain.gain.value=0;this.engine.connect(this.engineFilter).connect(this.engineGain).connect(this.master);this.engine.start();
  this.turbine=a.createOscillator();this.turbine.type='sine';this.turbine.frequency.value=145;this.turbineGain=a.createGain();this.turbineGain.gain.value=0;this.turbine.connect(this.turbineGain).connect(this.master);this.turbine.start();
  // Independent low-frequency combustion/buffet bed plus a quiet turbine harmonic.
  const rumble=a.createBufferSource();rumble.buffer=this.noiseBuffer;rumble.loop=true;this.rumbleFilter=a.createBiquadFilter();this.rumbleFilter.type='lowpass';this.rumbleFilter.Q.value=.8;this.rumbleGain=a.createGain();this.rumbleGain.gain.value=0;rumble.connect(this.rumbleFilter).connect(this.rumbleGain).connect(this.master);rumble.start(0,1.17);
  this.harmonic=a.createOscillator();this.harmonic.type='sine';this.harmonicGain=a.createGain();this.harmonicGain.gain.value=0;this.harmonic.connect(this.harmonicGain).connect(this.master);this.harmonic.start();
  // Fixed continuous voices: proximity updates never allocate an audio graph.
  for(let i=0;i<NEARBY_VOICES;i++){
   const source=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain(),tone=a.createOscillator(),toneGain=a.createGain(),pan=this.createPan();
   source.buffer=this.noiseBuffer;source.loop=true;filter.type='bandpass';filter.Q.value=.65;filter.frequency.value=900;gain.gain.value=0;tone.type='triangle';tone.frequency.value=100;toneGain.gain.value=0;
   source.connect(filter).connect(gain).connect(pan).connect(this.master);tone.connect(toneGain).connect(pan);source.start(0,(i*.63+.21)%3);tone.start();
   this.nearby.push({id:null,source,filter,gain,tone,toneGain,pan,radial:0,distance:Infinity,flybyUntil:0,flybyStrength:0});
  }
 }
 createPan(){const a=this.ctx;if(a.createStereoPanner)return a.createStereoPanner();const node=a.createPanner();node.panningModel='equalpower';node.distanceModel='inverse';node.rolloffFactor=0;return node}
 setPan(node,value,t){const pan=clamp(value,-1,1);if(node.pan)node.pan.setTargetAtTime(pan,t,.045);else if(node.positionX){node.positionX.setTargetAtTime(pan,t,.045);node.positionY.setTargetAtTime(0,t,.045);node.positionZ.setTargetAtTime(-Math.sqrt(Math.max(0,1-pan*pan)),t,.045)}else node.setPosition(pan,0,-Math.sqrt(Math.max(0,1-pan*pan)))}
 stopTransients(){if(!this.ctx)return;for(const source of this.voices){try{source.stop(this.ctx.currentTime+.01)}catch{}}this.voices.clear()}
 toggle(){this.enabled=!this.enabled;if(this.ctx){this.master.gain.setTargetAtTime(this.enabled&&this.active&&!document.hidden?.42:0,this.ctx.currentTime,.025);if(!this.enabled){this.stopTransients();this.lastThreatType=null;this.lastThreat=-Infinity}}return this.enabled}
 update(p,active,threat,view='chase',pilots=[]){
  if(!this.ctx||!p)return;active=!!active&&!document.hidden&&!p.dead;const a=this.ctx,t=a.currentTime,audible=active&&this.enabled;this.active=active;
  if(!audible&&this.wasAudible)this.stopTransients();this.wasAudible=audible;
  const shots=p.gunShots||0;if(audible&&this.lastPilotId===p.id&&shots>this.lastGunShots)this.burst(1500,220,.065,view==='cockpit'?.08:.13);this.lastGunShots=shots;this.lastPilotId=p.id;const sound=flightSound(p,view==='cockpit');
  this.master.gain.setTargetAtTime(audible?.42:0,t,.025);this.jetGain.gain.setTargetAtTime(active?sound.jet:0,t,.2);this.jetFilter.frequency.setTargetAtTime(sound.jetFrequency,t,.22);this.jetFilter.Q.setTargetAtTime(sound.jetQ,t,.22);
  this.windGain.gain.setTargetAtTime(active?sound.wind:0,t,.18);this.windFilter.frequency.setTargetAtTime(sound.windFrequency,t,.25);this.engine.frequency.setTargetAtTime(sound.engineFrequency,t,.3);this.engineGain.gain.setTargetAtTime(active?sound.engine:0,t,.25);this.engineFilter.frequency.setTargetAtTime(sound.engineCutoff,t,.25);
  this.turbine.frequency.setTargetAtTime(sound.turbineFrequency,t,.4);this.turbineGain.gain.setTargetAtTime(active?sound.turbine:0,t,.3);
  this.rumbleFilter.frequency.setTargetAtTime(sound.rumbleFrequency,t,.2);this.rumbleGain.gain.setTargetAtTime(active?sound.rumble:0,t,.15);this.harmonic.frequency.setTargetAtTime(sound.harmonicFrequency,t,.35);this.harmonicGain.gain.setTargetAtTime(active?sound.harmonic:0,t,.3);
  this.updateSystems(p,audible,view==='cockpit',t,!!threat);
  this.updateNearby(p,audible?pilots:[],view==='cockpit',t);
  const cue=threatAudioProfile(threat);
  if(audible&&cue&&(cue.type!==this.lastThreatType||cue.urgent&&!this.lastThreatUrgent||t-this.lastThreat>cue.period)){this.lastThreat=t;this.warning(cue)}
  this.lastThreatType=audible?cue?.type:null;this.lastThreatUrgent=audible&&!!cue?.urgent;
 }
 updateSystems(p,audible,inside,t,threat){
  const state={id:p.id,gear:!!p.gearDown,brake:!!p.airbrake,burner:!!p.afterburnerActive},old=this.previousSystems;
  if(audible&&old&&old.id===state.id){
   if(old.gear!==state.gear){this.burst(inside?460:800,110,.55,inside?.12:.07);this.beep(state.gear?270:360,.08,.018,{delay:.5})}
   if(old.brake!==state.brake)this.burst(1400,380,.22,inside?.055:.035);
   if(!old.burner&&state.burner)this.burst(480,90,.65,inside?.15:.23);
  }
  this.previousSystems=audible?state:null;
  const fuel=Number.isFinite(p.fuelFraction)?p.fuelFraction:(p.fuelCapacityKg?p.fuelKg/p.fuelCapacityKg:1);
  const caution=!p.grounded&&(p.stallSink||0)>8?'stall':(p.engineHealth??1)<.4?'engine':(p.controlHealth??1)<.4?'controls':fuel<.08?'fuel':(p.gLoad||0)>7.5?'load':null;
  // Cockpit-only cautions have long repeat intervals and yield to weapon threats.
  if(audible&&inside&&caution&&!threat&&(caution!==this.cautionType||t-this.lastCaution>(caution==='stall'?3.5:12))){
   this.lastCaution=t;const urgent=caution==='stall',frequency=urgent?210:caution==='fuel'?610:390;
   this.beep(frequency,.16,urgent?.045:.025,{wave:'triangle'});this.beep(frequency*(urgent?1.12:.8),.18,urgent?.035:.02,{delay:.22,wave:'triangle'});
  }
  if(!audible||!caution)this.cautionType=null;else if(inside&&!threat)this.cautionType=caution;
 }
 updateNearby(p,pilots,inside,t){
  const occupied=new Set(this.nearby.map(v=>v.id)),candidates=[];
  for(const q of pilots){if(q===p||q.id===p.id||q.dead||!q.pos||!p.pos)continue;const sound=nearbyJetSound(p,q,inside);if(sound.distance<NEARBY_RANGE)candidates.push({id:q.id,sound,priority:sound.distance*(occupied.has(q.id)?.8:1)})}
  candidates.sort((a,b)=>a.priority-b.priority);const selected=candidates.slice(0,NEARBY_VOICES),ids=new Set(selected.map(q=>q.id));
  for(const v of this.nearby)if(!ids.has(v.id)){v.id=null;v.radial=0;v.distance=Infinity;v.flybyUntil=0;v.flybyStrength=0;v.gain.gain.setTargetAtTime(0,t,.09);v.toneGain.gain.setTargetAtTime(0,t,.09)}
  for(const q of selected){
   const v=this.nearby.find(v=>v.id===q.id)||this.nearby.find(v=>v.id===null);if(!v)continue;const s=q.sound,fresh=v.id!==q.id;v.id=q.id;
   // A close approach turning into recession adds a short broad rush, using the same voice.
   if(!fresh&&v.radial<0&&s.radial>=0&&Math.min(s.distance,v.distance)<650){v.flybyUntil=t+.55;v.flybyStrength=clamp(Math.abs(v.radial-s.radial)/100,.15,1)*(1-s.distance/750)}
   const rush=Math.max(0,(v.flybyUntil-t)/.55)*v.flybyStrength;
   v.source.playbackRate.setTargetAtTime(s.doppler,t,.065);v.filter.frequency.setTargetAtTime(s.frequency+900*rush,t,.08);v.filter.Q.setTargetAtTime(.65-s.burner*.2-rush*.1,t,.1);
   v.gain.gain.setTargetAtTime(s.gain*s.noise*(1+rush*.8),t,.07);v.tone.frequency.setTargetAtTime(s.engineFrequency*s.doppler,t,.07);v.toneGain.gain.setTargetAtTime(s.gain*s.tone,t,.09);this.setPan(v.pan,s.pan,t);
   v.radial=s.radial;v.distance=s.distance;
  }
 }
 warning(cue){
  const options={pan:cue.pan};
  if(cue.type==='lock'){this.beep(cue.frequency,cue.duration,cue.gain,{...options,wave:'triangle',endFrequency:cue.frequency+(cue.locked?55:20)});return}
  if(cue.type==='heat'){
   // Heat is a paired downward whistle; radar is a clipped three-note climb.
   this.beep(cue.frequency,.095,cue.gain,{...options,endFrequency:cue.frequency-140});this.beep(cue.frequency-60,.07,cue.gain*.82,{...options,delay:.125,endFrequency:cue.frequency-180});
  }else{
   for(let i=0;i<3;i++)this.beep(cue.frequency+i*190,.055,cue.gain*.6,{...options,wave:'square',delay:i*.075});
  }
 }
 beep(frequency=780,duration=.1,gain=.05,options={}){
  if(!this.ctx||!this.enabled||!this.active||document.hidden||this.voices.size>=TRANSIENT_LIMIT)return;
  const a=this.ctx,t=a.currentTime+(options.delay||0),o=a.createOscillator(),g=a.createGain(),pan=this.createPan();o.type=options.wave||'sine';o.frequency.setValueAtTime(frequency,t);if(options.endFrequency)o.frequency.exponentialRampToValueAtTime(Math.max(30,options.endFrequency),t+duration);
  g.gain.setValueAtTime(0,a.currentTime);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);this.setPan(pan,options.pan||0,a.currentTime);o.connect(g).connect(pan).connect(this.master);this.voices.add(o);o.start(t);o.stop(t+duration+.01);o.onended=()=>{this.voices.delete(o);o.disconnect();g.disconnect();pan.disconnect()};
 }
 burst(from,to,duration,gain){
  if(!this.ctx||!this.enabled||!this.active||document.hidden||this.voices.size>=TRANSIENT_LIMIT)return;const a=this.ctx,t=a.currentTime,source=a.createBufferSource(),filter=a.createBiquadFilter(),g=a.createGain();source.buffer=this.noiseBuffer;filter.type='lowpass';filter.frequency.setValueAtTime(from,t);filter.frequency.exponentialRampToValueAtTime(Math.max(30,to),t+duration);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter).connect(g).connect(this.master);this.voices.add(source);source.start(0,Math.random());source.stop(t+duration+.01);source.onended=()=>{this.voices.delete(source);source.disconnect();filter.disconnect();g.disconnect()};
 }
 event(type){
  if(type==='launch'){this.burst(1900,170,.48,.29);this.beep(320,.1,.025)}
  else if(type==='gun-hit')this.burst(1200,250,.08,.10);
  else if(type==='counter')this.burst(3300,1200,.15,.15);
  else if(type==='damage'){this.burst(450,65,.4,.42);this.beep(78,.2,.06)}
  else if(['hit','kill','target'].includes(type)){this.burst(type==='target'?600:850,55,type==='target'?.8:.5,type==='target'?.5:.36);this.beep(68,.27,.06)}
  else if(['gate','landed','takeoff'].includes(type)){this.beep(660,.13,.035);this.beep(880,.18,.03,{delay:.13})}
 }
}
