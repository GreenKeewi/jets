// +Z is authored north. Screen-right looking north is -X; UI headings turn clockwise.
export function flightForward(p){return{x:Math.sin(p.yaw)*Math.cos(p.pitch),y:Math.sin(p.pitch),z:Math.cos(p.yaw)*Math.cos(p.pitch)}}
export function viewAxes(p,bank=0){
 const forward=flightForward(p),right={x:-Math.cos(p.yaw),y:0,z:Math.sin(p.yaw)},levelUp={x:-Math.sin(p.yaw)*Math.sin(p.pitch),y:Math.cos(p.pitch),z:-Math.cos(p.yaw)*Math.sin(p.pitch)},c=Math.cos(bank),s=Math.sin(bank);
 // Rotate level-up around actual forward by -bank; positive simulation bank is left.
 const up={x:levelUp.x*c-right.x*s,y:levelUp.y*c-right.y*s,z:levelUp.z*c-right.z*s};
 return{forward,right,up};
}
export function relativePosition(p,point){const dx=point.x-p.pos.x,dz=point.z-p.pos.z;return{right:-dx*Math.cos(p.yaw)+dz*Math.sin(p.yaw),forward:dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw)}}
export function radarPoint(p,point,scale=.025,radius=82){const v=relativePosition(p,point);let x=v.right*scale,y=-v.forward*scale;const length=Math.hypot(x,y);if(length>radius){x*=radius/length;y*=radius/length}return{x,y};}
export function turnHint(p,point){const v=relativePosition(p,point);return v.right>0?{key:'D',text:'Turn right'}:{key:'A',text:'Turn left'};}
export function compassHeading(yaw){return((-yaw*180/Math.PI)%360+360)%360;}
export function gunMuzzle(p){const a=viewAxes(p,p.roll||0),nose=p.bomber?24:22;return{x:p.pos.x+a.forward.x*nose-a.up.x*1.4,y:p.pos.y+(p.grounded?4:0)+a.forward.y*nose-a.up.y*1.4,z:p.pos.z+a.forward.z*nose-a.up.z*1.4};}
