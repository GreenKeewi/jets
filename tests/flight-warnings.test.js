import test from 'node:test';
import assert from 'node:assert/strict';
import {predictTerrain,FlightWarnings} from '../flight-warnings.js';
import {FlightAudio} from '../audio.js';
import {worldVelocity} from '../arcade-travel.js';
import {AIRFIELDS,fieldPoint} from '../missions.js';

const pilot=(changes={})=>({id:'host',pos:{x:18000,y:500,z:0},yaw:0,pitch:0,roll:0,speed:200,grounded:false,gLoad:1,...changes});
const flat=()=>0,descent={x:0,y:-100,z:200},level={x:0,y:0,z:200};
function voice(){
 const spoken=[],speech={speaking:false,pending:false,cancels:0,peak:0,
  speak(u){spoken.push(u);this.speaking=true;this.peak=Math.max(this.peak,spoken.filter(v=>!v.finished).length);},
  cancel(){this.cancels++;this.speaking=false;for(const u of spoken)u.finished=true;},
  finish(){const u=spoken.at(-1);if(u){u.finished=true;this.speaking=false;u.onend?.();}},
 };
 class Utterance{constructor(text){this.text=text;}}
 const warnings=new FlightWarnings({speech,Utterance});warnings.unlock();
 return{warnings,speech,spoken,options:{speech,Utterance}};
}

test('terrain prediction detects rising terrain during level flight, not a blanket altitude threshold',()=>{
 const p=pilot({pos:{x:18000,y:250,z:0}}),ridge=(x,z)=>z>=900?300:0;
 const hit=predictTerrain(p,{heightAt:ridge,velocity:{x:0,y:0,z:300}});
 assert(hit.impactTime>2.8&&hit.impactTime<=3);assert.equal(hit.closing,true);
 assert.equal(predictTerrain(p,{heightAt:flat,velocity:level}).impactTime,Infinity);
 assert.equal(predictTerrain(pilot({pos:{x:18000,y:15,z:0}}),{heightAt:flat,velocity:level}).impactTime,Infinity);
});

test('default prediction samples actual authored ridge and uses arcade movement velocity',()=>{
 const p=pilot({pos:{x:8000,y:500,z:6600},speed:300});
 const actual=predictTerrain(p),bare=predictTerrain(p,{heightAt:flat});
 assert(actual.impactTime<3);assert.equal(bare.impactTime,Infinity);
 let furthest=0;predictTerrain(pilot(),{heightAt:(x,z)=>{furthest=Math.max(furthest,z);return 0;}});
 assert.equal(furthest,worldVelocity(pilot()).z*6);
});

test('prediction uses sink rate and actual vertical velocity and bounds terrain work',()=>{
 const p=pilot({pos:{x:18000,y:250,z:0}}),hit=predictTerrain(p,{heightAt:flat,velocity:descent});
 assert(Math.abs(hit.impactTime-2.47)<1e-9);
 const sinking=predictTerrain(pilot({speed:0,stallSink:100,pos:p.pos}),{heightAt:flat});
 assert.equal(sinking.impactTime,hit.impactTime);
 let samples=0;const bounded=predictTerrain(pilot(),{heightAt:()=>{samples++;return 0;},step:.00001,horizon:10000});
 assert(samples<=61);assert.equal(bounded.samples,samples);
 for(const p of [null,pilot({grounded:true}),pilot({dead:true}),pilot({pos:{x:NaN,y:4,z:0}})])assert.equal(predictTerrain(p).samples,0);
});

test('qualifying runway landing is quiet but unsafe gear-up descent remains a warning',()=>{
 const p=pilot({pos:fieldPoint(AIRFIELDS.home,0,-700,35),speed:100,gearDown:true,homeBaseId:'home'}),v={x:0,y:-8,z:100};
 assert.equal(predictTerrain(p,{velocity:v}).landing,true);
 const {warnings,spoken}=voice();warnings.update(p,{now:0,velocity:v});warnings.update(p,{now:1,velocity:v});assert.equal(spoken.length,0);
 warnings.update({...p,gearDown:false},{now:2,velocity:v});warnings.update({...p,gearDown:false},{now:2.5,velocity:v});assert.equal(spoken[0].text,'Terrain, terrain');
});

test('one speech channel prioritizes terrain and immediately preempts it with pull up',()=>{
 const {warnings,speech,spoken}=voice(),p=pilot({gLoad:8.5,roll:1.5});
 warnings.update(p,{now:0,heightAt:flat,velocity:descent});
 warnings.update(p,{now:1.2,heightAt:flat,velocity:descent});assert.equal(spoken[0].text,'Terrain, terrain');
 const danger={...p,pos:{...p.pos,y:150}};
 warnings.update(danger,{now:1.3,heightAt:flat,velocity:descent});
 assert.equal(spoken[1].text,'Pull up');assert.equal(speech.cancels,1);assert.equal(speech.peak,1);
 speech.finish();
 for(let now=1.4;now<5.7;now+=.1)warnings.update(danger,{now,heightAt:flat,velocity:descent});
 assert.equal(spoken.length,2,'frame updates never queue repeated warnings');
 warnings.update(danger,{now:5.9,heightAt:flat,velocity:descent});assert.equal(spoken.length,3);assert.equal(spoken[2].text,'Pull up');
});

test('G and bank warnings require sustained excursions, prefer G and use release hysteresis',()=>{
 const {warnings,spoken,speech}=voice(),bank=pilot({roll:85*Math.PI/180});
 warnings.update(bank,{now:0,heightAt:flat,velocity:level});warnings.update(bank,{now:.5,heightAt:flat,velocity:level});assert.equal(spoken.length,0);
 warnings.update(pilot(),{now:.6,heightAt:flat,velocity:level});warnings.update(bank,{now:1,heightAt:flat,velocity:level});warnings.update(bank,{now:2.2,heightAt:flat,velocity:level});
 assert.equal(spoken[0].text,'Bank angle');
 warnings.update({...bank,gLoad:8},{now:2.3,heightAt:flat,velocity:level});warnings.update({...bank,gLoad:8},{now:2.9,heightAt:flat,velocity:level});
 assert.equal(spoken[1].text,'Over G');assert.equal(speech.peak,1);
 warnings.update({...bank,gLoad:7.2},{now:3,heightAt:flat,velocity:level});assert.equal(warnings.state.type,'overg');
 warnings.update(pilot(),{now:3.2,heightAt:flat,velocity:level});assert.equal(speech.speaking,false);
 warnings.update(pilot(),{now:4,heightAt:flat,velocity:level});assert.equal(warnings.state,null);
});

test('negative G and bomber load limits are aircraft specific',()=>{
 for(const changes of [{gLoad:-2.5},{bomber:true,gLoad:3.4},{bomber:true,gLoad:-1.5}]){
  const {warnings,spoken}=voice(),p=pilot(changes);warnings.update(p,{now:0,heightAt:flat,velocity:level});warnings.update(p,{now:.6,heightAt:flat,velocity:level});assert.equal(spoken[0].text,'Over G');
 }
 const {warnings,spoken}=voice(),p=pilot({gLoad:3.4});warnings.update(p,{now:0,heightAt:flat,velocity:level});warnings.update(p,{now:2,heightAt:flat,velocity:level});assert.equal(spoken.length,0);
});

test('pause, menu, death, ground, disable, zero volume and cleanup cancel owned speech',()=>{
 for(const stop of [
  w=>w.update(pilot(),{active:false,now:1}),w=>w.update(null,{now:1}),
  w=>w.update(pilot({dead:true}),{now:1}),w=>w.update(pilot({grounded:true}),{now:1}),
  w=>w.setEnabled(false),w=>w.setVolume(0),w=>w.dispose(),
 ]){
  const {warnings,speech,spoken}=voice();warnings.update(pilot({pos:{x:18000,y:100,z:0}}),{now:0,heightAt:flat,velocity:descent});assert.equal(spoken.length,1);
  stop(warnings);assert.equal(speech.speaking,false);assert.equal(warnings.state,null);assert.equal(speech.cancels,1);
 }
});

test('speech needs a gesture, falls back without browser support and respects voice/master settings',()=>{
 const {options,spoken,speech}=voice(),audio=new FlightAudio(options),p=pilot({pos:{x:18000,y:100,z:0}}),context={now:0,heightAt:flat,velocity:descent};
 audio.update(p,true,null,'cockpit',[],context);assert.equal(spoken.length,0);
 audio.init();audio.setVolume(.4);audio.update(p,true,null,'cockpit',[],{...context,now:1});assert.equal(spoken.length,1);assert.equal(spoken[0].volume,.34);
 audio.toggle();assert.equal(speech.speaking,false);assert.equal(audio.warningState,null);
 audio.toggle();audio.setVoiceEnabled(false);audio.update(p,true,null,'cockpit',[],{...context,now:10});assert.equal(spoken.length,1);
 audio.setVoiceEnabled(true);audio.update(p,true,null,'cockpit',[],{...context,now:11});assert.equal(spoken.length,2);
 audio.suspend();assert.equal(speech.speaking,false);audio.dispose();
 const unsupported=new FlightWarnings({speech:null,Utterance:null});unsupported.unlock();assert.doesNotThrow(()=>unsupported.update(p,{now:0,heightAt:flat,velocity:descent}));assert.equal(unsupported.state.type,'pullup');
});
