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
