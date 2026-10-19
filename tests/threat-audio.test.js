import test from 'node:test';
import assert from 'node:assert/strict';
import {threatAudioProfile} from '../audio.js';

test('acquiring lock always has a slow advisory, even at close range',()=>{
 const lock=threatAudioProfile({type:'lock',range:50,timeToImpact:.3});
 assert.equal(lock.type,'lock');assert.equal(lock.urgent,false);assert(lock.period>1);assert(lock.frequency<500);
});
test('launched heat and radar missiles have distinct tones and become urgent by time or distance',()=>{
 const heat=threatAudioProfile({type:'heat',range:1400,timeToImpact:9}),radar=threatAudioProfile({type:'radar',range:1400,timeToImpact:9});
 assert.notEqual(heat.frequency,radar.frequency);assert.equal(heat.urgent,false);
 const closing=threatAudioProfile({type:'radar',range:1800,timeToImpact:2}),close=threatAudioProfile({type:'heat',range:400});
 assert(closing.urgent&&close.urgent);assert(closing.period<radar.period);assert(closing.gain>radar.gain);
 assert.equal(threatAudioProfile(null),null);
});
