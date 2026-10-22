// DOM/controller regression in a small test double. This is not a WebGL playtest.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createMultiplayerRouter} from '../multiplayer-router.js';
import * as simulation from '../sim.js';
import * as controls from '../controls.js';
import * as axes from '../view-axes.js';
import * as guidance from '../guidance.js';
import * as missions from '../missions.js';
import * as combatMissions from '../combat-missions.js';
import * as resupply from '../airfield-resupply.js';
import * as arenas from '../arenas.js';
import * as world from '../world.js';
function app(){
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),nodes=new Map(),events={},raf=[];
 const context2d=new Proxy({},{get:(_,key)=>key==='measureText'?()=>({width:10}):()=>{}});
 class Element{
  constructor(id){this.id=id;this.hidden=false;this.disabled=false;this.style={};this.value='';this.textContent='';this.dataset={};this.open=false;this.firstChild={textContent:''};this.options=[];this.classes=new Set();this.classList={add:c=>this.classes.add(c),remove:c=>this.classes.delete(c),toggle:(c,on)=>{on??=!this.classes.has(c);on?this.classes.add(c):this.classes.delete(c);return on}};}
  get parentElement(){return new Element('parent')} setAttribute(){} addEventListener(type,fn){this['on'+type]=fn} focus(){document.activeElement=this} blur(){document.activeElement=null} matches(q){return q.split(',').includes(this.tag||'')} showModal(){this.open=true} close(){this.open=false} getContext(){return context2d} querySelector(){return new Element('child')} querySelectorAll(){return []}
 }
 for(const match of html.matchAll(/<([a-z-]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const n=new Element(match[2]);n.tag=match[1];n.hidden=/\shidden(?:\s|>)/.test(match[0]);nodes.set(n.id,n)}
 for(const match of html.matchAll(/<select[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const n=nodes.get(match[1]);n.options=[...match[2].matchAll(/<option[^>]*value="([^"]+)"/g)].map(m=>({value:m[1],disabled:false}));n.value=n.options[0]?.value||''}
 const modeButtons=['dogfight','strike','freeflight'].map(mode=>Object.assign(new Element(mode),{dataset:{mode}}));
 const document={activeElement:null,hidden:false,getElementById:id=>{assert(nodes.has(id),`Missing DOM element ${id}`);return nodes.get(id)},querySelector:q=>q==='dialog[open]'?[...nodes.values()].find(n=>n.open)||null:null,querySelectorAll:q=>q==='dialog[open]'?[...nodes.values()].filter(n=>n.open):q==='.mode-card'?modeButtons:q.includes('.mode-card,')?[...modeButtons,...q.split(',').slice(1).map(id=>nodes.get(id.slice(1)))]:[],addEventListener(){}};
 class Renderer{constructor(){this.needsRender=true;this.followReady=false} setView(v){this.view=v} render(){this.needsRender=false} project(){return{x:500,y:300,visible:false,z:0}}}
 class FlightAudio{constructor(){this.enabled=true}init(){}update(){}event(){}toggle(){this.enabled=!this.enabled}}
 let peerCallbacks;let role='offline';const net={get state(){return{role,localId:'host',peers:[]}},getPlayerIds:()=>role==='host'?['host']:[],consumeInputs:()=>({}),broadcastControl(){},broadcastSnapshot(){},disconnect(){role='offline'}};
 let serverCallbacks,serverState={role:'offline',transport:'server',connected:false,localId:null,peers:[]},remote,respawns=0;const sent=[];
 const server={get state(){return serverState},subscribe(){return()=>{}},async connect(){remote=simulation.createGame({mode:'dogfight',skirmish:true,teamSizes:[3,3],seed:41});remote.pilots[0].id='server-pilot';remote.pilots[0].human=true;serverState={...serverState,role:'guest',connected:true,localId:'server-pilot'};serverCallbacks.onState(serverState);serverCallbacks.onControl({type:'start',config:remote.config||{mode:'dogfight',skirmish:true,teamSizes:[3,3],seed:41}});serverCallbacks.onSnapshot(simulation.snapshot(remote),{initial:true});},disconnect(){serverState={...serverState,role:'offline',connected:false,localId:null};serverCallbacks.onState(serverState)},getPlayerIds:()=>['server-pilot'],sampleSnapshot:()=>simulation.snapshot(remote),submitInput(input){sent.push({...input})},requestRespawn(){respawns++;return true}};
 const window={addEventListener:(type,fn)=>events[type]=fn};
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInNewContext(source,{...simulation,...controls,...axes,...guidance,...missions,...combatMissions,...resupply,...arenas,...world,Renderer,FlightAudio,drawCockpit(){},createMultiplayerRouter:callbacks=>createMultiplayerRouter(callbacks,{createPeer:callbacks=>{peerCallbacks=callbacks;return net},createServer:callbacks=>{serverCallbacks=callbacks;return server}}),mountNetworkUI(){},mountServerUI(){},window,document,location:{hostname:'localhost'},HTMLElement:Element,performance:{now:()=>0},requestAnimationFrame:fn=>raf.push(fn),innerWidth:1024,innerHeight:650,console,Math,Set},{filename:'game.js'});
 return{joinPeer:peers=>peerCallbacks.onPeerChange(peers,net.state),api:window.__skybreak,nodes,net,events,server,sent,get remote(){return remote},get respawns(){return respawns},dropServer(){server.disconnect();serverCallbacks.onDisconnect('server-pilot','Server unavailable')},frame(time=1000/60){raf.shift()(time)},setRole:value=>role=value,keydown(code){events.keydown({code,repeat:false,target:nodes.get('world'),preventDefault(){}})}};
}
test('native menu controller starts requested asymmetric and capped custom bot squads',()=>{
 const a=app();assert.equal(a.nodes.get('squad-label').hidden,true);assert.equal(a.nodes.get('bot-layout-label').hidden,false);
 for(const preset of ['1,1','1,2','1,3','3,2,3']){a.nodes.get('team-layout').value=preset;a.nodes.get('team-layout').onchange();a.nodes.get('launch').onclick();assert.equal(a.api.state.skirmish,true);assert.deepEqual(a.api.state.teamSizes,preset.split(',').map(Number));a.api.returnMenu()}
 a.nodes.get('team-layout').value='custom';a.nodes.get('team-layout').onchange();for(const id of ['team-alpha','team-bravo','team-charlie'])a.nodes.get(id).value='4';a.nodes.get('launch').onclick();assert.equal(a.api.state.pilots.length,12);a.frame();assert.match(a.nodes.get('match-score').textContent,/CHARLIE/);assert.equal(a.nodes.get('menu').hidden,true);
});
test('R and respawn button rejoin without menu, preserve the match clock and score',()=>{
 for(const useButton of [false,true]){const a=app();a.nodes.get('launch').onclick();const s=a.api.state;s.time=20;s.scores=[3,1];Object.assign(s.pilots[0],{dead:true,hp:0,respawnAt:19});a.api.setState(s);a.frame();assert.equal(a.nodes.get('respawn-panel').hidden,false);assert.equal(a.nodes.get('respawn-button').disabled,false);if(useButton)a.nodes.get('respawn-button').onclick();else a.keydown('KeyR');assert.equal(a.api.state.pilots[0].dead,false);assert.equal(a.nodes.get('menu').hidden,true);assert(a.api.state.time>=20);assert.deepEqual(a.api.state.scores,[3,1]);a.frame(33);assert.equal(a.nodes.get('respawn-panel').hidden,true);assert.equal(a.api.state.pilots[0].grounded,true)}
});
test('respawn countdown, pause and live player prevent an accidental restart',()=>{
 const a=app();a.nodes.get('launch').onclick();const id=a.api.state.pilots[0].id;assert.equal(a.api.respawn(),false);const s=a.api.state;s.time=20;Object.assign(s.pilots[0],{dead:true,hp:0,respawnAt:23});a.api.setState(s);a.frame();assert.equal(a.nodes.get('respawn-button').disabled,true);assert.equal(a.api.respawn(),false);a.keydown('Escape');assert.equal(a.api.paused,true);a.api.step(200);assert.equal(a.api.respawn(),false);assert.equal(a.api.state.pilots[0].id,id);
});
test('network launch strips solo skirmish settings and preserves classic seats',()=>{
 const a=app();a.setRole('host');a.api.start({mode:'dogfight',teamSize:2,teamSizes:[4,4,4],skirmish:true,role:'attack',seed:42});assert.equal(a.api.state.skirmish,false);assert.deepEqual(a.api.state.teamSizes,[2,2]);assert.equal(a.api.state.pilots.length,4);
});
test('lock warnings and Mach HUD update without missing elements',()=>{
 const a=app();a.nodes.get('launch').onclick();const s=a.api.state,p=s.pilots[0],q=s.pilots[1];s.time=10;Object.assign(p,{pos:{x:0,y:3000,z:0},speed:343,throttle:.9,grounded:false,departureActive:false});Object.assign(q,{human:true,grounded:false,departureActive:false,pos:{x:0,y:3000,z:-1500},yaw:0,lock:1,targetId:p.id});a.api.setState(s);a.frame();assert.equal(a.nodes.get('threat').hidden,false);assert.match(a.nodes.get('threat-label').textContent,/ENEMY/);assert.match(a.nodes.get('threat-bearing').textContent,/6 O'CLOCK/);assert(Number(a.nodes.get('mach').textContent)>=1);
});
test('defeated or expired seekers cannot keep the countermeasure ready hint active',()=>{
 const g=simulation.createGame({skirmish:true}),p=g.pilots[0];const missile={targetId:p.id,pos:{...p.pos,z:p.pos.z+500},age:1,life:10};g.missiles=[{...missile,seekerLost:true}];assert.equal(guidance.nearestThreat(g,p),null);g.missiles=[{...missile,decoyed:true}];assert.equal(guidance.nearestThreat(g,p),null);g.missiles=[{...missile,age:10}];assert.equal(guidance.nearestThreat(g,p),null);g.missiles=[missile];assert.equal(guidance.nearestThreat(g,p),missile);
});

test('dedicated server drives guest snapshots, controls, authoritative respawn and safe disconnect',async()=>{
 const a=app();await a.api.network.connectServer({id:'enam',url:'https://example.test'},{pool:'global'});
 assert.equal(a.api.running,true);assert.equal(a.api.network.state.transport,'server');assert.equal(a.api.state.pilots[0].id,'server-pilot');
 a.remote.time=20;a.keydown('KeyW');a.frame(100);assert.equal(a.api.state.time,20,'guest does not locally advance physics');assert(a.sent.some(i=>i.pitch!==0));
 Object.assign(a.remote.pilots[0],{dead:true,hp:0,respawnAt:19});a.frame(200);assert.equal(a.nodes.get('respawn-panel').hidden,false);assert.equal(a.api.respawn(),true);assert.equal(a.respawns,1);assert.equal(a.api.state.pilots[0].dead,true,'request cannot locally revive a pilot');
 simulation.respawnPilot(a.remote,'server-pilot');a.frame(300);assert.equal(a.api.state.pilots[0].dead,false);
 a.dropServer();assert.equal(a.api.running,false);assert.equal(a.nodes.get('menu').hidden,false);assert.match(a.nodes.get('toast').textContent,/unavailable/);
 a.nodes.get('launch').onclick();assert.equal(a.api.running,true);assert.equal(a.api.network.state.role,'offline');
});

test('a late peer join starts on home pavement instead of taking an airborne AI seat',()=>{
 const a=app();a.setRole('host');a.nodes.get('launch').onclick();const seat=a.api.state.pilots.find(p=>!p.human);Object.assign(seat,{grounded:false,pos:{x:0,y:1800,z:0},speed:315,throttle:.78,gearDown:false});
 a.joinPeer([{id:'late-guest',connected:true}]);const joined=a.api.state.pilots.find(p=>p.id==='late-guest');assert(joined);assert.equal(joined.grounded,true);assert.equal(joined.gearDown,true);assert.equal(joined.speed,0);assert.equal(joined.throttle,0);
 const field=missions.AIRFIELDS[joined.homeBaseId],local=missions.fieldCoordinates(field,joined.pos);assert(Math.abs(local.along)<field.halfLength);assert(Math.abs(local.across)<field.width);
});
