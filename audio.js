// Original procedural jet, wind and radio cues; no downloaded audio or media permissions.
const clamp=(value,low,high)=>Math.max(low,Math.min(high,Number.isFinite(value)?value:0));
export function flightSound(p,inside=false){
 const thrust=clamp(p.throttle,0,1),mach=clamp(Number.isFinite(p.mach)?p.mach:(p.speed||0)/343,0,3),burner=p.bomber?0:clamp((thrust-.82)/.18,0,1),buffet=p.grounded?0:Math.max(0,1-Math.abs(mach-1)/.12),fastAir=clamp((mach-.55)/.45,0,1);
 return{jet:.035+thrust*.2+burner*.085+buffet*.014,jetFrequency:(inside?340:450)+thrust*(inside?1050:1700)+burner*420,
  wind:(clamp(Math.pow(mach,1.4)*.15+fastAir*fastAir*(3-2*fastAir)*.08,0,.5)+(p.braking?.045:0))*(inside?.55:1),windFrequency:(inside?1000:1800)+mach*1700,
  engineFrequency:35+thrust*52+burner*18,engine:.008+thrust*.024+burner*.014};
}
export function threatAudioProfile(threat){
 if(!threat)return null;
 const type=typeof threat==='object'?threat.type:'heat';
 // An enemy trying to lock is a slower, lower advisory. A launched weapon is urgent.
 if(type==='lock')return{type,period:1.35,frequency:380,duration:.11,gain:.025,urgent:false};
 const range=typeof threat==='object'?threat.range:700,time=typeof threat==='object'?threat.timeToImpact:Infinity,urgent=(Number.isFinite(time)&&time<4)||(Number.isFinite(range)&&range<650);
 return{type:type==='radar'?'radar':'heat',period:urgent?.26:.65,frequency:type==='radar'?720:560,duration:.07,gain:urgent?.055:.042,urgent};
}
export class FlightAudio{
 constructor(){this.enabled=true;this.ctx=null;this.active=false;this.lastThreat=0;this.lastGunShots=0;this.voices=new Set()}
 init(){
  if(this.ctx){this.ctx.resume();return}const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  this.ctx=new Audio();const a=this.ctx;this.master=a.createGain();this.master.gain.value=0;const compressor=a.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=14;compressor.ratio.value=4;compressor.attack.value=.004;compressor.release.value=.17;this.master.connect(compressor).connect(a.destination);
  this.noiseBuffer=a.createBuffer(1,a.sampleRate*3,a.sampleRate);const data=this.noiseBuffer.getChannelData(0);let brown=0;for(let i=0;i<data.length;i++){const white=Math.random()*2-1;brown=(brown+white*.025)/1.015;data[i]=white*.22+brown*.7}
  const jet=a.createBufferSource();jet.buffer=this.noiseBuffer;jet.loop=true;this.jetFilter=a.createBiquadFilter();this.jetFilter.type='bandpass';this.jetFilter.frequency.value=500;this.jetFilter.Q.value=.7;this.jetGain=a.createGain();this.jetGain.gain.value=0;jet.connect(this.jetFilter).connect(this.jetGain).connect(this.master);jet.start();
  const wind=a.createBufferSource();wind.buffer=this.noiseBuffer;wind.loop=true;const high=a.createBiquadFilter();high.type='highpass';high.frequency.value=450;this.windFilter=a.createBiquadFilter();this.windFilter.type='lowpass';this.windFilter.frequency.value=1600;this.windGain=a.createGain();this.windGain.gain.value=0;wind.connect(high).connect(this.windFilter).connect(this.windGain).connect(this.master);wind.start(0,.37);
  this.engine=a.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=42;const low=a.createBiquadFilter();low.type='lowpass';low.frequency.value=135;this.engineGain=a.createGain();this.engineGain.gain.value=0;this.engine.connect(low).connect(this.engineGain).connect(this.master);this.engine.start();
 }
 toggle(){this.enabled=!this.enabled;if(this.ctx)this.master.gain.setTargetAtTime(this.enabled&&this.active?.42:0,this.ctx.currentTime,.035);return this.enabled}
 update(p,active,threat,view='chase'){
  if(!this.ctx)return;active=!!active&&!document.hidden;const a=this.ctx,t=a.currentTime;this.active=active;const shots=p.gunShots||0;if(active&&shots>this.lastGunShots)this.burst(1500,220,.065,view==='cockpit'?.08:.13);this.lastGunShots=shots;const sound=flightSound(p,view==='cockpit');
  this.master.gain.setTargetAtTime(this.enabled&&active?.42:0,t,.035);this.jetGain.gain.setTargetAtTime(active?sound.jet:0,t,.22);this.jetFilter.frequency.setTargetAtTime(sound.jetFrequency,t,.25);
  this.windGain.gain.setTargetAtTime(active?sound.wind:0,t,.18);this.windFilter.frequency.setTargetAtTime(sound.windFrequency,t,.25);this.engine.frequency.setTargetAtTime(sound.engineFrequency,t,.3);this.engineGain.gain.setTargetAtTime(active?sound.engine:0,t,.25);
  const cue=threatAudioProfile(threat);
  if(active&&cue&&(cue.type!==this.lastThreatType||t-this.lastThreat>cue.period)){this.lastThreat=t;this.beep(cue.frequency,cue.duration,cue.gain);if(cue.urgent)setTimeout(()=>this.active&&this.beep(cue.frequency+180,.055,.038),95)}
  this.lastThreatType=active?cue?.type:null;
 }
 beep(frequency=780,duration=.1,gain=.05){
  if(!this.ctx||!this.enabled||!this.active)return;const a=this.ctx,t=a.currentTime,o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.value=frequency;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(this.master);o.start();o.stop(t+duration);o.onended=()=>{o.disconnect();g.disconnect()};
 }
 burst(from,to,duration,gain){
  if(!this.ctx||!this.enabled||!this.active||this.voices.size>10)return;const a=this.ctx,t=a.currentTime,source=a.createBufferSource(),filter=a.createBiquadFilter(),g=a.createGain();source.buffer=this.noiseBuffer;filter.type='lowpass';filter.frequency.setValueAtTime(from,t);filter.frequency.exponentialRampToValueAtTime(Math.max(30,to),t+duration);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter).connect(g).connect(this.master);this.voices.add(source);source.start(0,Math.random());source.stop(t+duration);source.onended=()=>{this.voices.delete(source);source.disconnect();filter.disconnect();g.disconnect()};
 }
 event(type){
  if(type==='launch'){this.burst(1900,170,.48,.29);this.beep(320,.1,.025)}
  else if(type==='gun-hit')this.burst(1200,250,.08,.10);
  else if(type==='counter')this.burst(3300,1200,.15,.15);
  else if(type==='damage'){this.burst(450,65,.4,.42);this.beep(78,.2,.06)}
  else if(['hit','kill','target'].includes(type)){this.burst(type==='target'?600:850,55,type==='target'?.8:.5,type==='target'?.5:.36);this.beep(68,.27,.06)}
  else if(['gate','landed','takeoff'].includes(type)){this.beep(660,.13,.035);setTimeout(()=>this.active&&this.beep(880,.18,.03),130)}
 }
}
