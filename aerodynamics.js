import {aircraftDefinition} from './loadouts.js?v=skybreak122-1104';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function sweepFraction(p){return p.aircraftId==='f14'?clamp(Number(p.wingSweep)||0,0,1):0;}
export function sweepHandling(p){if(p.aircraftId!=='f14')return 1;const s=sweepFraction(p),fast=clamp(((p.speed||0)-220)/180,0,1);return (1-s)*(.99-.28*fast)+s*(.65+.47*fast);}
export function maximumAirspeed(p){const a=aircraftDefinition(p.aircraftId);return a.flight.maxSpeed*(p.aircraftId==='f14'?.72+.28*sweepFraction(p):1);}
export function liftPerG(p){const a=aircraftDefinition(p.aircraftId),mass=p.massKg||a.dryMass+a.internalFuelCapacity*.5,q=.5*1.225*Math.exp(-Math.max(0,p.pos?.y||0)/16000)*Math.max(40,p.speed||0)**2;return mass*9.81/(q*a.flight.wingArea);}
// Effective alpha inferred from required CL and a 4.8/radian lift slope. It is
// independent of pitch attitude; not a six-degree-of-freedom airflow simulation.
export function estimatedAoa(p,load=p.normalLoad??1){if(p.grounded||p.bomber)return 0;return (load*liftPerG(p)/4.8)*180/Math.PI;}
export function aoaEnvelope(p){const a=aircraftDefinition(p.aircraftId),off=['su27','fa18e'].includes(p.aircraftId)&&p.aoaLimiterOff===true;
 const alpha=off?(p.aircraftId==='su27'?35:32):a.flight.aoaLimit;
 const alphaG=alpha*Math.PI/180*4.8/liftPerG(p),structural=a.flight.maxG;
 return {min:Math.max(-3,-alphaG*.45),max:Math.max(1,Math.min(structural,alphaG)),alpha,structural};}
