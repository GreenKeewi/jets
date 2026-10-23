// Original authored combat terrain shared by spawning, AI and rendered heightfield.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
export const ARENAS=Object.freeze({
 coast:Object.freeze({id:'coast',name:'Coastal sky',description:'Open-water dogfights and changing squad approach directions.'}),
 valley:Object.freeze({id:'valley',name:'Winding mountain run',description:'A 22 km mountain corridor with linked bends. Stay low, manage speed, and follow the valley instead of cutting across the ridges.'})
});
// Broad enough for an arcade fighter's controlled 240–270 m/s turn, but narrow
// enough that a straight line through successive bends runs into the shoulders.
export const VALLEY=Object.freeze({minX:-14000,maxX:7000,halfWidth:600,cruiseClearance:210});
const bendRate=2*Math.PI/5200;
export const valleyCenter=x=>17000+Math.sin(x*bendRate)*500+Math.sin(x*bendRate*2+.6)*55;
export const valleyFloor=x=>105+Math.sin(x*.00065+.7)*22;
export const valleyHeading=x=>Math.atan2(1,Math.cos(x*bendRate)*500*bendRate+Math.cos(x*bendRate*2+.6)*110*bendRate);
export const inValley=(point,margin=0)=>point.x>=VALLEY.minX-margin&&point.x<=VALLEY.maxX+margin&&Math.abs(point.z-valleyCenter(point.x))<=VALLEY.halfWidth+margin;
export function valleyPoint(x,offset=0,clearance=VALLEY.cruiseClearance){
 x=clamp(x,VALLEY.minX,VALLEY.maxX);
 return{x,y:valleyFloor(x)+clearance,z:valleyCenter(x)+clamp(offset,-VALLEY.halfWidth,VALLEY.halfWidth)};
}
// Shared centreline samples for route preview/testing; no per-frame allocation.
export const VALLEY_ROUTE=Object.freeze(Array.from({length:61},(_,i)=>Object.freeze(valleyPoint(VALLEY.minX+(VALLEY.maxX-VALLEY.minX)*i/60))));
export function valleyTerrain(height,x,z){
 const along=smooth(VALLEY.minX-1400,VALLEY.minX-200,x)*(1-smooth(VALLEY.maxX+200,VALLEY.maxX+1400,x));
 if(!along)return height;
 const across=Math.abs(z-valleyCenter(x)),blend=along*(1-smooth(1850,2450,across));
 if(!blend)return height;
 const shoulders=900+160*Math.sin(x*.0011+.5)**2;
 const carved=valleyFloor(x)+shoulders*smooth(VALLEY.halfWidth,1600,across);
 return height+(carved-height)*blend;
}
