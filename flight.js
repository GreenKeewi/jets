// SI units: metres, seconds, kilograms. Mach uses a fixed 343 m/s reference.
// This is an energy-based game model, not an aircraft certification simulator.
export const FLIGHT=Object.freeze({soundSpeed:343,maxFighterSpeed:686,cruiseSpeed:315,maxBomberSpeed:309,bomberCruiseSpeed:245,afterburnerThreshold:1.1,maxThrottle:1.1});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const GRAVITY=9.81;
const FIGHTER=Object.freeze({dryMass:8500,fuelCapacity:3200,parasite:.0001,induced:3000,turnInduced:11000,maxThrust:18,burnerThrust:36,groundThrust:8.5,stallSpeed:78,turnDragLimit:24});
const BOMBER=Object.freeze({dryMass:72000,fuelCapacity:65000,parasite:.00008,induced:3800,turnInduced:9000,maxThrust:7.68,burnerThrust:0,groundThrust:5.2,stallSpeed:85,turnDragLimit:16});
const frame=p=>p.bomber?BOMBER:FIGHTER;
const controlFactor=p=>.4+.6*clamp(Number.isFinite(p.controlHealth)?p.controlHealth:1,0,1);
const engineFactor=p=>.3+.7*clamp(Number.isFinite(p.engineHealth)?p.engineHealth:1,0,1);
function interpolate(power,points){for(let i=1;i<points.length;i++)if(power<=points[i][0]){const[a,lo]=points[i-1],[b,hi]=points[i];return lo+(hi-lo)*(power-a)/(b-a);}return points.at(-1)[1];}
// A UI/planning reference curve only; actual speed is never servoed to this value.
export function fighterTargetSpeed(throttle,{freeflight=false}={}){
 const power=clamp(Number(throttle)||0,0,1.1);
 return interpolate(power,freeflight?[[0,0],[.7,147],[.78,315],[.82,420],[1,420],[1.1,686]]:[[0,0],[.55,115.5],[.72,280],[.78,315],[.82,420],[1,420],[1.1,686]]);
}
export function initializeFuel(p,fraction=1){
 const a=frame(p);p.fuelCapacityKg=a.fuelCapacity;p.fuelFraction=clamp(Number.isFinite(fraction)?fraction:1,0,1);p.fuelKg=p.fuelCapacityKg*p.fuelFraction;p.massKg=a.dryMass+p.fuelKg;
 p.afterburnerActive=false;p.afterburnerRemaining=0;p.afterburnerCooldown=0;p.afterburnerNeedsRelease=false;p.fuelFlowKgPerSecond=0;return p;
}
function ensureFuel(p){
 if(!Number.isFinite(p.fuelKg))initializeFuel(p,Number.isFinite(p.fuelFraction)?p.fuelFraction:1);
 const a=frame(p);p.fuelCapacityKg=a.fuelCapacity;p.fuelKg=clamp(p.fuelKg,0,a.fuelCapacity);p.fuelFraction=p.fuelKg/a.fuelCapacity;p.massKg=a.dryMass+p.fuelKg;
 p.afterburnerRemaining=0;
 if(!Number.isFinite(p.afterburnerCooldown))p.afterburnerCooldown=0;
}
// Reference mass is half fuel. Fuel affects both acceleration and turn authority.
export function fuelMassRatio(p){const a=frame(p),fuel=Number.isFinite(p.fuelKg)?clamp(p.fuelKg,0,a.fuelCapacity):a.fuelCapacity*clamp(p.fuelFraction??1,0,1);return(a.dryMass+a.fuelCapacity*.5)/(a.dryMass+fuel);}
export function turnAuthority(speed,p={}){return Math.min(1,(280/Math.max(280,speed))**1.5)*fuelMassRatio(p)*controlFactor(p);}
export function pitchRateLimit(p){
 const speed=Math.max(90,Number(p.speed)||0),load=p.bomber?2.5:8;
 return Math.min(.9,GRAVITY*load/speed)*Math.min(1,fuelMassRatio(p))*controlFactor(p);
}
export function advanceFuel(p,dt){
 ensureFuel(p);const seconds=clamp(Number(dt)||0,0,.1),throttle=clamp(Number(p.throttle)||0,0,1.1);
 const allowed=!p.bomber&&throttle>=FLIGHT.afterburnerThreshold-1e-9&&p.fuelKg>0&&!p.dead;
 // Game balance: 3.8 kg/s dry maximum, 8 kg/s with burner (~6.7 minutes
 // from a full fighter tank). No timer or cooldown, only the fuel supply.
 const dryRate=p.bomber?8+22*Math.min(1,throttle):.6+3.2*Math.min(1,throttle);
 p.fuelFlowKgPerSecond=p.dead||p.fuelKg<=0?0:dryRate+(allowed?4.2:0);
 p.fuelKg=Math.max(0,p.fuelKg-p.fuelFlowKgPerSecond*seconds);
 p.afterburnerActive=allowed&&p.fuelKg>0;
 p.afterburnerRemaining=0;p.afterburnerCooldown=0;p.afterburnerNeedsRelease=false;
 ensureFuel(p);return p.afterburnerActive?1:0;
}
// Call after attitude and normal-load updates, before position integration.
export function advanceFlightEnergy(p,input={},dt){
 const seconds=clamp(Number(dt)||0,0,.1);if(seconds<=0){p.speedAcceleration=0;return;}
 const burnerDuty=advanceFuel(p,seconds),a=frame(p),mass=fuelMassRatio(p);
 const maxSpeed=p.bomber?FLIGHT.maxBomberSpeed:FLIGHT.maxFighterSpeed;
 const speed=clamp(Number(p.speed)||0,0,maxSpeed),throttle=clamp(Number(p.throttle)||0,0,1);
 const dryPower=p.bomber?interpolate(throttle,[[0,0],[.55,.28],[.78,.63],[1,1]]):interpolate(throttle,[[0,0],[.32,.045],[.55,.19],[.7,.42],[.78,.55],[.82,1],[1,1]]);
 const altitude=clamp(Number(p.pos?.y)||0,0,6000),density=Math.exp(-altitude/16000),pressure=density*speed*speed;
 const engineOn=p.fuelKg>0&&!p.dead;
 const thrust=engineOn?(a.maxThrust*dryPower+a.burnerThrust*burnerDuty)*Math.pow(density,.65)*mass*engineFactor(p):0;
 if(p.grounded){
  // Wheel/runway dynamics have bounded thrust, rolling drag and brakes. Never
  // accelerate toward a requested top speed: rotation takes seconds and runway.
  const runwayThrust=engineOn?a.groundThrust*Math.sqrt(dryPower)*(1+.18*burnerDuty)*mass*engineFactor(p):0;
  const rolling=throttle>0?.55:.85,drag=a.parasite*speed*speed*.45;
  p.speed=clamp(speed+(runwayThrust-rolling-drag-(input.brake?18:0))*seconds,0,maxSpeed);
  p.speedAcceleration=(p.speed-speed)/seconds;p.stallSink=0;p.stallSpeed=a.stallSpeed/Math.sqrt(mass);return;
 }
 const measuredLoad=Number.isFinite(p.normalLoad)?p.normalLoad:Number.isFinite(p.gLoad)?p.gLoad:1;
 const load=clamp(Math.abs(measuredLoad),0,45),lift=Math.min(1,pressure/(a.stallSpeed*a.stallSpeed));
 const parasite=a.parasite*pressure*mass,baseInduced=a.induced*lift*lift*Math.min(1,load*load)/Math.max(1,pressure)/mass;
 const extra=a.turnInduced*Math.max(0,load*load-1)/Math.max(a.stallSpeed*a.stallSpeed*.5,pressure)/mass;
 const turnDrag=a.turnDragLimit*extra/(a.turnDragLimit+extra);
 const gravity=-GRAVITY*Math.sin(Number(p.pitch)||0),airbrake=input.brake?28:0,gearDrag=p.gearDown?2.5*(speed/150)**2:0;
 p.speed=clamp(speed+(thrust-parasite-baseInduced-turnDrag+gravity-airbrake-gearDrag)*seconds,0,maxSpeed);
 p.speedAcceleration=(p.speed-speed)/seconds;
 p.stallSpeed=a.stallSpeed*Math.sqrt(clamp(load,1,3)/(density*mass));
 const sink=Math.max(0,p.stallSpeed-p.speed)*.48,previous=Number.isFinite(p.stallSink)?Math.max(0,p.stallSink):0;
 p.stallSink=previous+(sink-previous)*(1-Math.exp(-seconds*3));
}
