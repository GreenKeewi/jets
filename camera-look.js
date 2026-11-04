const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class CameraLook{
 constructor(clock=()=>performance.now()){this.clock=clock;this.reset();}
 reset(){this.yaw=0;this.pitch=0;this.until=0;this.dragging=false;}
 nudge(dx,dy){this.yaw=clamp(this.yaw-dx*.003,-1.5,1.5);this.pitch=clamp(this.pitch+dy*.003,-.9,.9);this.until=this.clock()+220;}
 update(dt){if(!this.dragging&&this.clock()>this.until){const decay=Math.exp(-Math.max(0,dt)*7);this.yaw*=decay;this.pitch*=decay;if(Math.abs(this.yaw)<.001)this.yaw=0;if(Math.abs(this.pitch)<.001)this.pitch=0;}return{yaw:this.yaw,pitch:this.pitch};}
}
export function mountCameraLook(canvas,look,active){
 let last=null;
 canvas.addEventListener('wheel',e=>{if(!active())return;e.preventDefault();const scale=e.deltaMode===1?16:e.deltaMode===2?240:1;look.nudge(e.deltaX*scale,e.deltaY*scale);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{if(!active()||e.button!==0)return;last={x:e.clientX,y:e.clientY};look.dragging=true;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!last||!look.dragging||!active())return;look.nudge(e.clientX-last.x,e.clientY-last.y);last={x:e.clientX,y:e.clientY};});
 const release=()=>{last=null;look.dragging=false;look.until=0;};for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,release);
}
