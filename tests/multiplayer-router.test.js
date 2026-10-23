import test from 'node:test';
import assert from 'node:assert/strict';
import {createMultiplayerRouter} from '../multiplayer-router.js';
import {mountServerUI} from '../server-ui.js';

function fixture(){
 const callbacks={},received=[];let peerRole='offline',serverRole='offline',calls=0;
 const peer={get state(){return{role:peerRole,peers:[]}},disconnect(){peerRole='offline'},host(){peerRole='host';callbacks.peer.onState(peer.state)},getPlayerIds:()=>['host']};
 const server={get state(){return{role:serverRole,connected:serverRole==='guest',localId:'server-pilot',transport:'server'}},disconnect(){serverRole='offline';callbacks.server.onState(server.state)},async connect(){calls++;serverRole='guest';callbacks.server.onState(server.state);callbacks.server.onControl({type:'start'})},getPlayerIds:()=>['server-pilot'],subscribe(){return()=>{}}};
 const router=createMultiplayerRouter({onControl:p=>received.push(p),onState(){},onDisconnect:id=>received.push({left:id})},{createPeer:c=>(callbacks.peer=c,peer),createServer:c=>(callbacks.server=c,server)});
 return{router,callbacks,received,get calls(){return calls}};
}
test('router prevents concurrent friend/server sessions and ignores inactive transport callbacks',async()=>{
 const f=fixture();f.router.peer.host();await assert.rejects(f.router.connectServer({}),/Leave your friend room/);assert.equal(f.calls,0);
 f.router.disconnect();await f.router.connectServer({});assert.equal(f.router.state.transport,'server');assert.deepEqual(f.router.getPlayerIds(),['server-pilot']);
 f.callbacks.peer.onControl({type:'start',stale:true});assert.equal(f.received.length,1);
 f.router.peer.host();assert.equal(f.router.state.transport,'peer');assert.equal(f.router.server.state.role,'offline');assert.equal(f.router.state.role,'host');
 assert(f.received.some(p=>p.left==='server-pilot'));f.callbacks.server.onControl({type:'start',stale:true});assert.equal(f.received.filter(p=>p.type==='start').length,1);
});
test('failed dedicated connection returns routing to offline friend transport',async()=>{
 const f=fixture();f.router.server.connect=async()=>{throw new Error('offline')};await assert.rejects(f.router.connectServer({}),/offline/);assert.equal(f.router.state.transport,'peer');assert.equal(f.router.state.role,'offline');
});
function container(){const nodes=new Map(['join','leave','status','team','match'].map(k=>[k,{disabled:false,textContent:'',value:k==='team'?'auto':k==='match'?'versus':''}]));return{hidden:false,innerHTML:'',querySelector:s=>nodes.get(s.match(/"(.+)"/)[1]),nodes};}
const endpoint={id:'enam',label:'Shared sky',url:'https://example.test'};
test('server UI makes no requests or join control with empty/invalid endpoint configuration',()=>{
 for(const endpoints of [[],[{id:'enam',url:'http://insecure.test'}]]){let probes=0;const c=container();mountServerUI(c,fixture().router,{endpoints,probe:()=>{probes++}});assert.equal(c.hidden,true);assert.equal(c.innerHTML,'');assert.equal(probes,0)}
});
test('configured server UI probes before joining and keeps solo fallback on failure',async()=>{
 const c=container(),f=fixture();let chosen;
 f.router.connectServer=async(e,o)=>{chosen={e,o};throw new Error('Full sky')};
 mountServerUI(c,f.router,{endpoints:[endpoint],arena:()=> 'valley',probe:async()=>[{...endpoint,available:true,latencyMs:30,rooms:[{pool:'global',arenaId:'coast',players:2,joinable:true}]}]});
 assert.equal(c.hidden,false);await c.nodes.get('join').onclick();assert.equal(chosen.o.arenaId,'coast');assert.equal(chosen.o.pool,'global');assert.match(c.nodes.get('status').textContent,/Full sky.*Solo and friend rooms/);assert.equal(c.nodes.get('join').disabled,false);
});
test('graphics failure and cancelled availability checks never start a server match',async()=>{
 const f=fixture(),c=container();let resolve,probes=0;
 mountServerUI(c,f.router,{endpoints:[endpoint],canConnect:()=>false,probe:()=>{probes++}});await c.nodes.get('join').onclick();assert.equal(c.nodes.get('join').disabled,true);assert.equal(probes,0);
 mountServerUI(c,f.router,{endpoints:[endpoint],probe:()=>new Promise(r=>resolve=r)});const joining=c.nodes.get('join').onclick();c.nodes.get('leave').onclick();resolve([{...endpoint,available:true,latencyMs:5,rooms:[]}]);await joining;assert.equal(f.calls,0);assert.equal(f.router.state.role,'offline');
});

test('server UI sends selected coop/team to authority and does not borrow another queue arena',async()=>{
 const c=container(),f=fixture();let choice;f.router.connectServer=async(e,o)=>{choice=o};mountServerUI(c,f.router,{endpoints:[endpoint],arena:()=> 'valley',probe:async()=>[{...endpoint,available:true,latencyMs:4,rooms:[{pool:'global',match:'versus',arenaId:'coast',players:2,joinable:true}]}]});c.nodes.get('match').value='coop';c.nodes.get('team').value='1';await c.nodes.get('join').onclick();assert.deepEqual(choice,{pool:'global',arenaId:'valley',match:'coop',team:0});
});
