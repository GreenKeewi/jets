import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetwork} from '../network.js';
import {FixturePeer,pairFixture,settle} from './helpers/rtc-fixture.js';
import {defaultLoadout} from '../loadouts.js';
const e=aircraftId=>({aircraftId,loadout:defaultLoadout(aircraftId),startingFuel:.75});
test('peer equipment belongs to its sender, synchronizes independently, and locks for a sortie',async()=>{
 const old=globalThis.RTCPeerConnection;globalThis.RTCPeerConnection=FixturePeer;FixturePeer.all=[];const host=createNetwork(),guest=createNetwork();
 try{host.host();const pcs=await pairFixture(host,guest);host.setEquipment(e('f14'));guest.setEquipment(e('su27'));await settle();assert.equal(host.state.equipment.host.aircraftId,'f14');assert.equal(host.state.equipment.p1.aircraftId,'su27');assert.deepEqual(guest.state.equipment,host.state.equipment);
 const channel=pcs.guest.channels.find(c=>c.label==='control'),saved=JSON.stringify(host.state.equipment);channel.send(JSON.stringify({t:'equipment',id:'host',value:e('fa18e')}));channel.send(JSON.stringify({t:'equipment',value:{...e('su27'),aircraftId:'bogus'}}));await settle();assert.equal(JSON.stringify(host.state.equipment),saved);
 const copy=host.getEquipment();copy.host.loadout.stations['wingtip-l']='empty';assert.equal(host.state.equipment.host.loadout.stations['wingtip-l'],'heat');
 host.broadcastControl({type:'start',config:{mode:'dogfight',teamSize:1,role:'attack',playerEquipment:host.getEquipment()}});await settle();assert.equal(guest.setEquipment(e('f16')),false);channel.send(JSON.stringify({t:'equipment',value:e('f16')}));await settle();assert.equal(host.state.equipment.p1.aircraftId,'su27');host.broadcastControl({type:'return'});await settle();assert(guest.setEquipment(e('fa18e')));await settle();assert.equal(host.state.equipment.p1.aircraftId,'fa18e');assert.equal(host.state.equipment.host.aircraftId,'f14');
 }finally{host.disconnect();guest.disconnect();globalThis.RTCPeerConnection=old;}
});
