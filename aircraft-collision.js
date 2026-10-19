// Conservative airframe envelopes match the rendered span/length in metres.
export const AIRCRAFT_RADIUS=Object.freeze({fighter:16,bomber:32});
export const collisionRadius=pilot=>pilot.bomber?AIRCRAFT_RADIUS.bomber:AIRCRAFT_RADIUS.fighter;

// Earliest contact between two moving spheres. Relative motion catches aircraft
// passing through one another between frames, including head-on Mach-2 passes.
export function sweptSphereHit(a0,a1,b0,b1,radius){
 const r={x:a0.x-b0.x,y:a0.y-b0.y,z:a0.z-b0.z};
 const v={x:a1.x-a0.x-(b1.x-b0.x),y:a1.y-a0.y-(b1.y-b0.y),z:a1.z-a0.z-(b1.z-b0.z)};
 const c=r.x*r.x+r.y*r.y+r.z*r.z-radius*radius;
 if(c<=0)return 0;
 const a=v.x*v.x+v.y*v.y+v.z*v.z;
 if(a<1e-12)return null;
 const b=r.x*v.x+r.y*v.y+r.z*v.z,discriminant=b*b-a*c;
 if(discriminant<0)return null;
 const t=(-b-Math.sqrt(discriminant))/a;
 return t>=0&&t<=1?t:null;
}
