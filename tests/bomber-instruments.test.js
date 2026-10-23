import test from 'node:test';
import assert from 'node:assert/strict';
import {drawBomberCockpit} from '../bomber-instruments.js';
test('bomber panel reports real stores, signed G, fuel and dry throttle without invented engine telemetry',()=>{
 const labels=[],ctx=new Proxy({fillText:s=>labels.push(s)},{get:(o,k)=>o[k]??(()=>{})}),canvas={getContext:()=>ctx};
 drawBomberCockpit(canvas,{speed:100,pos:{y:500},gLoad:-1.5,throttle:.8,fuelKg:48750,fuelCapacityKg:65000,bombs:3,gunAmmo:242,flares:7,gearDown:true,airbrake:true});
 for(const value of ['194 KT','500 M','-1.5 G','80%','75%','BOMBS 3','GUN 242','FLARES 7','GEAR DOWN','BRAKE OUT'])assert(labels.includes(value),value);
 labels.length=0;drawBomberCockpit(canvas,{gLoad:0});assert(labels.includes('0.0 G'));assert(labels.every(s=>!s.includes('NaN')));
});
