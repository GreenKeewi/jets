import {AIRFIELDS,fieldCoordinates} from './missions.js?v=squads7-1019';
export const SEA_LEVEL=-5;
export function worldNoise(x,z){return Math.sin(x*.0017)*Math.cos(z*.0013)*.5+Math.sin(x*.0043+z*.0014)*.22+Math.sin(z*.0061-x*.0012)*.13}
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
function homeIsland(x,z){const radial=Math.sqrt(((x+300)/4200)**2+(z/4600)**2),coast=(1-radial)*4200+worldNoise(x*.78+500,z*.78-1000)*210+Math.sin(x*.002+z*.001)*55-1400*Math.exp(-((x-2700)**2/360000+(z+1550)**2/1250000));const mountains=430*Math.exp(-((x+2550)**2+(z-1750)**2)/1650000)+370*Math.exp(-((x-1850)**2+(z-2650)**2)/1450000),inland=10+mountains*(.60+worldNoise(x,z))+Math.max(0,worldNoise(x*1.6,z*1.6))*14;return coast<-160?-24:coast<110?-24+smooth(-160,110,coast)*Math.min(40,inland+24):inland}
export function northernRidgeHeight(x,z){const localZ=z-7200,envelope=Math.max(0,1-Math.abs(localZ)/2600),peaks=580+380*Math.sin(x*.0013)+210*Math.sin(x*.0031+1)+180*Math.cos(x*.005);return Math.max(-24,Math.pow(envelope,1.5)*(peaks+worldNoise(x*2,localZ*2)*320))}
function northIsland(x,z){const radial=Math.sqrt(((x-1800)/6400)**2+((z-8900)/4100)**2),coast=(1-radial)*4100+worldNoise(x*.9,z*.9)*170;if(coast<-140)return-24;const h=30+Math.max(0,northernRidgeHeight(x,z))+330*Math.exp(-((x-800)**2+(z-10500)**2)/3800000);return coast<90?-24+smooth(-140,90,coast)*Math.min(65,h+24):h}
function westIsland(x,z){const radial=Math.sqrt(((x+9600)/3300)**2+((z-4500)/3600)**2),coast=(1-radial)*3300+worldNoise(x*.9,z*.9)*150;if(coast<-130)return-24;const h=15+420*Math.exp(-((x+8900)**2+(z-5600)**2)/2900000)*(.68+worldNoise(x,z));return coast<110?-24+smooth(-130,110,coast)*Math.min(60,h+24):h}
export function terrainHeight(x,z){
 let h=Math.max(homeIsland(x,z),northIsland(x,z),westIsland(x,z));
 for(const field of Object.values(AIRFIELDS)){const p=fieldCoordinates(field,{x,z}),airportEdge=Math.max(Math.abs(p.across-230)-770,Math.abs(p.along+20)-(field.halfLength+390));if(airportEdge<170)h=field.elevation+2+(h-field.elevation-2)*smooth(0,170,airportEdge);
  // A naturally low approach valley leaves the northern ridges beside the final, not across it.
  if(field.id!=='home'&&p.along<-950&&p.along>-3600){const acrossBlend=1-smooth(340,1000,Math.abs(p.across)),alongBlend=smooth(-3600,-3200,p.along)*(1-smooth(-1100,-950,p.along)),cap=field.elevation+26+Math.max(0,-p.along-1800)*.025;h=h+(Math.min(h,cap)-h)*acrossBlend*alongBlend;}
 }
 const depotDistance=Math.hypot(x,z-700);h=4+(h-4)*smooth(270,430,depotDistance);return h;
}
export const surfaceHeight=(x,z)=>Math.max(SEA_LEVEL,terrainHeight(x,z));
export function coastPoint(theta,offset=0,island='home'){
 const centers={home:[-300,0,1800,6300],northpoint:[1800,8900,1800,7200],westhaven:[-9600,4500,1000,4700]},[cx,cz,min,max]=centers[island]||centers.home;let low=min,high=max;const height=island==='northpoint'?northIsland:island==='westhaven'?westIsland:homeIsland;
 for(let n=0;n<17;n++){const r=(low+high)/2;if(height(cx+Math.sin(theta)*r,cz+Math.cos(theta)*r)>SEA_LEVEL)low=r;else high=r}const r=(low+high)/2+offset;return{x:cx+Math.sin(theta)*r,z:cz+Math.cos(theta)*r};
}
