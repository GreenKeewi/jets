// Original procedural jet, wind and radio cues; no downloaded audio or media permissions.
export class FlightAudio{
 constructor(){this.enabled=true;this.ctx=null;this.active=false;this.lastThreat=0;this.voices=new Set()}
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
  if(!this.ctx)return;active=!!active&&!document.hidden;const a=this.ctx,t=a.currentTime;this.active=active;const inside=view==='cockpit',thrust=p.throttle||0,speed=Math.min(1.35,(p.speed||0)/210),brake=p.braking?.045:0;
  this.master.gain.setTargetAtTime(this.enabled&&active?.42:0,t,.035);this.jetGain.gain.setTargetAtTime(active?.035+thrust*.24+(thrust>.9?.04:0):0,t,.22);this.jetFilter.frequency.setTargetAtTime((inside?340:450)+thrust*(inside?1050:1700),t,.25);
  this.windGain.gain.setTargetAtTime(active?(speed*speed*.26+brake)*(inside?.55:1):0,t,.18);this.windFilter.frequency.setTargetAtTime((inside?1000:1800)+speed*1400,t,.25);this.engine.frequency.setTargetAtTime(35+thrust*52,t,.3);this.engineGain.gain.setTargetAtTime(active?.008+thrust*.024:0,t,.25);
  const range=typeof threat==='object'?threat?.range:700,period=range<650?.3:.75;
  if(active&&threat&&t-this.lastThreat>period){this.lastThreat=t;this.beep(typeof threat==='object'&&threat.type==='radar'?620:490,.07,.045);if(range<650)setTimeout(()=>this.active&&this.beep(760,.055,.035),95)}
 }
 beep(frequency=780,duration=.1,gain=.05){
  if(!this.ctx||!this.enabled||!this.active)return;const a=this.ctx,t=a.currentTime,o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.value=frequency;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(this.master);o.start();o.stop(t+duration);o.onended=()=>{o.disconnect();g.disconnect()};
 }
 burst(from,to,duration,gain){
  if(!this.ctx||!this.enabled||!this.active||this.voices.size>10)return;const a=this.ctx,t=a.currentTime,source=a.createBufferSource(),filter=a.createBiquadFilter(),g=a.createGain();source.buffer=this.noiseBuffer;filter.type='lowpass';filter.frequency.setValueAtTime(from,t);filter.frequency.exponentialRampToValueAtTime(Math.max(30,to),t+duration);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter).connect(g).connect(this.master);this.voices.add(source);source.start(0,Math.random());source.stop(t+duration);source.onended=()=>{this.voices.delete(source);source.disconnect();filter.disconnect();g.disconnect()};
 }
 event(type){
  if(type==='launch'){this.burst(1900,170,.48,.29);this.beep(320,.1,.025)}
  else if(type==='counter')this.burst(3300,1200,.15,.15);
  else if(type==='damage'){this.burst(450,65,.4,.42);this.beep(78,.2,.06)}
  else if(['hit','kill','target'].includes(type)){this.burst(type==='target'?600:850,55,type==='target'?.8:.5,type==='target'?.5:.36);this.beep(68,.27,.06)}
  else if(['gate','landed','takeoff'].includes(type)){this.beep(660,.13,.035);setTimeout(()=>this.active&&this.beep(880,.18,.03),130)}
 }
}
