// Speeds are metres per second throughout the simulation, renderer and HUD.
// Mach is referenced to 343 m/s; this is an approachable flight model, not an ISA solver.
export const FLIGHT=Object.freeze({soundSpeed:343,maxFighterSpeed:686,cruiseSpeed:285});
export function fighterTargetSpeed(throttle,{freeflight=false}={}){
 const power=Math.max(0,Math.min(1,Number(throttle)||0));
 // Keep taxi, takeoff and the authored landing-assist power settings usable.
 const points=freeflight?[[0,0],[.7,147],[.78,285],[.84,315],[1,686]]:[[0,0],[.55,115.5],[.72,255],[.78,285],[.84,315],[1,686]];
 for(let i=1;i<points.length;i++)if(power<=points[i][0]){
  const [a,low]=points[i-1],[b,high]=points[i];return low+(high-low)*(power-a)/(b-a);
 }
 return FLIGHT.maxFighterSpeed;
}

const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const GRAVITY=9.81,STALL_SPEED=83;
// Specific forces below are in m/s². These are game-tuned airframes, not
// specifications for a real aircraft or a full angle-of-attack/ISA solver.
const FIGHTER=Object.freeze({parasite:.00005,induced:3000,turnInduced:9000,maxThrust:28,turnDragLimit:14});
const BOMBER=Object.freeze({parasite:.00008,induced:3800,turnInduced:7500,maxThrust:12,turnDragLimit:11});
// Preserve low-speed dogfight handling, but progressively soften the control
// envelope above 240 m/s. A supersonic reversal needs real space and time.
export const turnAuthority=speed=>Math.min(1,(240/Math.max(240,speed))**2);
export function pitchRateLimit(p){
 const speed=Math.max(90,p.speed),load=p.bomber?3.5:8.5;
 return Math.min(.65,GRAVITY*load/speed)*Math.min(1,FLIGHT.soundSpeed/speed);
}
function thrustAtSpeed(speed){
 // More available acceleration at takeoff speed; little boost at cruise.
 // This smooth thrust-lapse curve keeps the existing low-power route usable.
 const ratio=speed/95,squared=ratio*ratio;
 return 1+8/(1+squared*squared*squared);
}
function levelDrag(speed,airframe){
 const pressure=speed*speed,lift=Math.min(1,pressure/(STALL_SPEED*STALL_SPEED));
 return airframe.parasite*pressure+airframe.induced*lift*lift/Math.max(1,pressure);
}

// Call after attitude/normal-load updates and before advancing position.
// Deterministic and world-independent: mutates only the supplied aircraft.
export function advanceFlightEnergy(p,input={},dt,{freeflight=false}={}){
 const seconds=clamp(Number(dt)||0,0,.1),airframe=p.bomber?BOMBER:FIGHTER;
 const maxSpeed=p.bomber?194:FLIGHT.maxFighterSpeed,speed=clamp(Number(p.speed)||0,0,maxSpeed);
 const throttle=clamp(Number(p.throttle)||0,0,1);
 const trimSpeed=p.bomber?throttle*172:fighterTargetSpeed(throttle,{freeflight});
 if(seconds<=0){p.speedAcceleration=0;return;}
 if(p.grounded){
  // Preserve the authored taxi, takeoff and landing-roll controls. The runway
  // carries the aircraft's weight, so there is no climb or induced-drag cost.
  p.speed=clamp(speed+((trimSpeed-speed)*.24-(input.brake?45:0))*seconds,0,maxSpeed);
  p.speedAcceleration=(p.speed-speed)/seconds;p.stallSink=0;p.stallSpeed=STALL_SPEED;
  return;
 }
 const altitude=clamp(Number(p.pos?.y)||0,0,6000);
 // Intentionally modest density/thrust lapse across this game's altitude range.
 const density=Math.exp(-altitude/16000),pressure=density*speed*speed;
 const measuredLoad=Number.isFinite(p.normalLoad)?p.normalLoad:Number.isFinite(p.gLoad)?p.gLoad:1;
 const load=clamp(Math.abs(measuredLoad),0,45),lift=Math.min(1,pressure/(STALL_SPEED*STALL_SPEED));
 const parasiteDrag=airframe.parasite*pressure;
 const baseInduced=airframe.induced*lift*lift*Math.min(1,load*load)/Math.max(1,pressure);
 // Induced drag grows with load squared and falls with dynamic pressure. The
 // arcade turn controller can command extreme G, so smoothly bound the added
 // drag rather than allowing a single high-G frame to remove all airspeed.
 const extraInduced=airframe.turnInduced*Math.max(0,load*load-1)/Math.max(STALL_SPEED*STALL_SPEED*.5,pressure);
 const turnDrag=airframe.turnDragLimit*extraInduced/(airframe.turnDragLimit+extraInduced);
 // The old throttle map now calibrates level-flight thrust equilibrium. It is
 // not a speed servo: climbs, dives and turns add/subtract independent forces.
 const seaLevelThrust=levelDrag(trimSpeed,airframe)*thrustAtSpeed(speed)/thrustAtSpeed(trimSpeed);
 const thrust=Math.min(airframe.maxThrust,seaLevelThrust)*Math.pow(density,.65);
 const gravity=-GRAVITY*Math.sin(Number(p.pitch)||0),airbrake=input.brake?33:0;
 p.speed=clamp(speed+(thrust-parasiteDrag-baseInduced-turnDrag+gravity-airbrake)*seconds,0,maxSpeed);
 p.speedAcceleration=(p.speed-speed)/seconds;
 // Lift-limited sink replaces a minimum-speed clamp. Loaded stall speed rises
 // with sqrt(G); cap that game assist at 3 G so the existing arcade steering
 // remains flyable. Sink eases in/out instead of snapping on at the threshold.
 p.stallSpeed=STALL_SPEED*Math.sqrt(clamp(load,1,3)/density);
 const sink=Math.max(0,p.stallSpeed-p.speed)*.48;
 const previousSink=Number.isFinite(p.stallSink)?Math.max(0,p.stallSink):0;
 p.stallSink=previousSink+(sink-previousSink)*(1-Math.exp(-seconds*3));
}
