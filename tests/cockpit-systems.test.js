import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {drawCockpit} from '../instruments.js';
function panel(p={}){
 const labels=[],calls=[],fills=[];
 const ctx=new Proxy({fillText:s=>labels.push(String(s))},{get:(o,k)=>k in o?o[k]:(...args)=>{for(const v of args)if(typeof v==='number')assert(Number.isFinite(v),`${String(k)} received a non-finite coordinate`);calls.push([k,...args]);if(k==='fillRect')fills.push({color:o.fillStyle,args});}});
 drawCockpit({width:580,height:110,getContext:()=>ctx},p);
 return{labels,calls,fills};
}
test('classic cockpit restores the original two-instrument 580 by 110 panel',()=>{
 const {labels,calls}=panel({speed:210,pos:{y:1500},pitch:.2,roll:Math.PI,throttle:.78});
 assert.deepEqual(calls.find(c=>c[0]==='clearRect'),['clearRect',0,0,580,110]);
 assert.deepEqual(calls.find(c=>c[0]==='roundRect'),['roundRect',15,5,550,99,8]);
 assert(calls.some(c=>c[0]==='arc'&&c[1]===135&&c[2]===61&&c[3]===32));
 assert.deepEqual(calls.find(c=>c[0]==='rotate'),['rotate',Math.PI]);
 for(const text of ['ATTITUDE','FLIGHT / ENGINE','KNOTS','ALT / M','408','1500','THRUST 78%'])assert(labels.includes(text),text);
 assert(!labels.some(t=>/FUEL|LOAD|HEADING|AFTERBURNER|MANUAL|AUTO GEAR/.test(t)));
});
test('gear indication uses actual gear state, not altitude or ground contact',()=>{
 for(const grounded of [false,true])for(const y of [0,75,3000])for(const gearDown of [false,true]){
  const {labels}=panel({grounded,pos:{y},gearDown});
  assert(labels.includes(gearDown?'GEAR DOWN':'GEAR UP'));
  assert(!labels.includes(gearDown?'GEAR UP':'GEAR DOWN'));
  assert(!labels.includes('GEAR TRANSIT'));
 }
});
test('classic panel does not advertise manual bindings in normal flight or add new systems displays',()=>{
 for(const maneuverAssist of [false,true]){
  const {labels}=panel({maneuverAssist,gearDown:true,airbrake:true,fuelFraction:.04,gLoad:8});
  assert(!labels.some(t=>/\[G\]|\[X\]|AIRBRAKE|LOW FUEL|G \+/.test(t)));
 }
});
test('thrust bar highlights actual active afterburner, not merely a high throttle',()=>{
 const bar=p=>panel(p).fills.find(f=>f.args[0]===276&&f.args[1]===84&&f.color!=='#52766f');
 assert.equal(bar({throttle:1,afterburnerActive:false}).color,'#9cdcc4');
 assert.equal(bar({throttle:1,afterburnerActive:true}).color,'#f1bb8e');
});
test('absent and non-finite samples cannot corrupt classic instruments',()=>{
 for(const p of [{},{speed:NaN,pos:{y:Infinity},pitch:Infinity,roll:NaN,throttle:Infinity}]){
  const {labels}=panel(p);assert(!labels.some(t=>/NaN|Infinity/.test(t)));assert(labels.includes('000'));
 }
});
test('classic canvas and canopy proportions have no later MFD or compact-strip overrides',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(html,/id="cockpit-instruments" width="580" height="110"/);
 assert(css.includes('.canopy.left{left:12%;transform:rotate(-25deg)}'));
 assert(css.includes('.canopy.right{right:12%;transform:rotate(25deg);'));
 assert(css.includes('.cockpit-dashboard{height:133px;bottom:-2px;padding-top:12px}'));
 assert(css.includes('#cockpit-instruments{width:100%;height:auto;max-height:108px;display:block}'));
 const later=css.slice(css.indexOf('/* SKYBREAK JETS:'));
 assert(!/\.cockpit-dashboard|\.canopy|#cockpit-instruments|#hud\.cockpit-view/.test(later));
});
