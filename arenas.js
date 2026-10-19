// Authored combat terrain shared by spawning, AI and the rendered heightfield.
// This adds no meshes or per-frame allocations to the scenery.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
export const ARENAS=Object.freeze({
 coast:Object.freeze({id:'coast',name:'Coastal sky',description:'Open-water dogfights and changing squad approach directions.'}),
 valley:Object.freeze({id:'valley',name:'Northern valley',description:'Spawn below the ridgelines. Fight along the valley floor and watch your energy.'})
});
export const VALLEY=Object.freeze({minX:-3100,maxX:4100,halfWidth:760,cruiseClearance:210});
export const valleyCenter=x=>7100+Math.sin(x*.0005)*250;
export const valleyFloor=x=>105+Math.sin(x*.00065+.7)*22;
export const inValley=(point,margin=0)=>point.x>=VALLEY.minX-margin&&point.x<=VALLEY.maxX+margin&&Math.abs(point.z-valleyCenter(point.x))<=VALLEY.halfWidth+margin;
export function valleyPoint(x,offset=0,clearance=VALLEY.cruiseClearance){
 x=clamp(x,VALLEY.minX,VALLEY.maxX);
 return{x,y:valleyFloor(x)+clearance,z:valleyCenter(x)+clamp(offset,-VALLEY.halfWidth,VALLEY.halfWidth)};
}
export function valleyTerrain(height,x,z){
 const along=smooth(-4400,-3300,x)*(1-smooth(4400,5600,x));
 if(!along)return height;
 const across=Math.abs(z-valleyCenter(x)),blend=along*(1-smooth(1850,2350,across));
 if(!blend)return height;
 const shoulders=680+100*Math.sin(x*.0011+.5)**2;
 const carved=valleyFloor(x)+shoulders*smooth(760,1800,across);
 return height+(carved-height)*blend;
}
