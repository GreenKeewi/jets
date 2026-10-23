import {terrainHeight,SEA_LEVEL} from './world.js?v=skybreak10-1023';
import {AIRFIELDS,fieldPoint} from './missions.js?v=skybreak10-1023';
import {radarPoint} from './view-axes.js?v=skybreak10-1023';

export const RADAR_MAP=Object.freeze({size:160,cell:80,scale:.025,radius:88,recenter:2000});
// Raster axes are world +X/+Z; the same heading transform as contacts maps them
// to screen right/forward. Never clamp terrain or runway geometry to the rim.
export function terrainTransform(p,center){
 const s=RADAR_MAP.scale*RADAR_MAP.cell,c=Math.cos(p.yaw),n=Math.sin(p.yaw);
 const offset=radarPoint(p,center,RADAR_MAP.scale,Infinity);
 return[-c*s,-n*s,n*s,-c*s,95+offset.x,95+offset.y];
}
export function sampleRadarTerrain(center,height=terrainHeight){
 const {size,cell}=RADAR_MAP,heights=new Float32Array(size*size),pixels=new Uint8ClampedArray(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)heights[y*size+x]=height(center.x+(x+.5-size/2)*cell,center.z+(y+.5-size/2)*cell);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,h=heights[i];if(h<=SEA_LEVEL)continue;
  const coast=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>a>=0&&b>=0&&a<size&&b<size&&heights[b*size+a]<=SEA_LEVEL);
  const relief=Math.min(1,Math.max(0,h)/1100),j=i*4;
  pixels[j]=coast?150:85+relief*45;pixels[j+1]=coast?194:133+relief*34;pixels[j+2]=coast?166:112+relief*27;pixels[j+3]=coast?100:40+relief*28;
 }
 return pixels;
}
export class RadarTerrain{
 constructor(makeCanvas=()=>document.createElement('canvas'),height=terrainHeight){this.makeCanvas=makeCanvas;this.height=height;this.center=null;this.builds=0;}
 draw(c,p){
  if(!this.center||Math.hypot(p.pos.x-this.center.x,p.pos.z-this.center.z)>RADAR_MAP.recenter){
   this.center={x:p.pos.x,z:p.pos.z};this.canvas??=this.makeCanvas();this.canvas.width=this.canvas.height=RADAR_MAP.size;
   const ctx=this.canvas.getContext('2d'),data=ctx.createImageData(RADAR_MAP.size,RADAR_MAP.size);data.data.set(sampleRadarTerrain(this.center,this.height));ctx.putImageData(data,0,0);this.builds++;
  }
  c.save();c.beginPath();c.arc(95,95,RADAR_MAP.radius,0,Math.PI*2);c.clip();
  c.save();c.transform(...terrainTransform(p,this.center));c.drawImage(this.canvas,-RADAR_MAP.size/2,-RADAR_MAP.size/2);c.restore();
  // Pale runway strokes provide airport orientation without competing with contacts.
  c.strokeStyle='#dce8b785';c.lineWidth=2;
  for(const field of Object.values(AIRFIELDS)){
   const a=radarPoint(p,fieldPoint(field,0,-field.halfLength),RADAR_MAP.scale,Infinity),b=radarPoint(p,fieldPoint(field,0,field.halfLength),RADAR_MAP.scale,Infinity);
   c.beginPath();c.moveTo(95+a.x,95+a.y);c.lineTo(95+b.x,95+b.y);c.stroke();
  }
  c.restore();
 }
}
