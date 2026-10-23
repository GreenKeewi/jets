// Original arcade displays, arranged as two three-over-one groups. These show
// only game telemetry, not claimed B-2 avionics pages or engine measurements.
const n=v=>Number.isFinite(v)?v:0;
export function drawBomberCockpit(canvas,p){
 const compact=(canvas.clientWidth||1000)<560;if(canvas.width!==(compact?500:1000))canvas.width=compact?500:1000;
 const c=canvas.getContext('2d'),ink='#b8e4bd',dim='#91a29b',w=1000,h=250;
 c.clearRect(0,0,w,h);c.fillStyle='#282d31';c.fillRect(0,0,w,h);c.fillStyle='#11171a';c.fillRect(0,0,w,14);
 const screen=(x,y,width,height,title)=>{c.fillStyle='#080e11';c.fillRect(x-5,y-5,width+10,height+10);c.strokeStyle='#697270';c.lineWidth=2;c.strokeRect(x-5,y-5,width+10,height+10);c.fillStyle='#111e20';c.fillRect(x,y,width,height);c.fillStyle=dim;c.font='10px monospace';c.textAlign='left';c.fillText(title,x+7,y+14);for(let k=0;k<4;k++){c.fillStyle='#57625f';c.fillRect(x+10+k*27,y+height+3,12,3)}};
 const text=(s,x,y,size=18,color=ink)=>{c.fillStyle=color;c.font=`${size}px monospace`;c.textAlign='left';c.fillText(s,x,y)};
 const attitude=(x,y)=>{c.save();c.beginPath();c.rect(x,y,130,72);c.clip();c.translate(x+65,y+36);c.rotate(n(p.roll));const off=n(p.pitch)*74;c.fillStyle='#426e88';c.fillRect(-160,-160+off,320,160);c.fillStyle='#766045';c.fillRect(-160,off,320,160);c.strokeStyle='#c5d8ca';c.beginPath();c.moveTo(-160,off);c.lineTo(160,off);c.stroke();c.restore();c.strokeStyle='#f4d6a0';c.lineWidth=2;c.beginPath();c.moveTo(x+35,y+36);c.lineTo(x+56,y+36);c.lineTo(x+65,y+40);c.lineTo(x+74,y+36);c.lineTo(x+95,y+36);c.stroke()};
 if(compact){
  screen(22,28,130,100,'AIR DATA');screen(185,28,130,100,'ATTITUDE');screen(348,28,130,100,'FUEL / POWER');
  text(`${Math.round(n(p.speed)*1.944)} KT`,29,76,26);text(`${Math.round(n(p.pos?.y))} M`,29,106,22);attitude(185,50);
  text(`${Math.round(100*n(p.fuelKg)/Math.max(1,n(p.fuelCapacityKg)))}% FUEL`,354,76,22);text(`${Math.round(n(p.throttle)*100)}% PWR`,354,106,18);
  screen(22,155,456,70,'AIRFRAME / STORES');text(p.gearDown?'GEAR DOWN':'GEAR UP',29,188,17);text(`BOMBS ${n(p.bombs)}   GUN ${n(p.gunAmmo)}`,200,188,17);text(p.airbrake?'BRAKE OUT':'BRAKE IN',29,212,17);text(`FLARES ${n(p.flares)}   ${n(p.gLoad??1).toFixed(1)} G`,200,212,17);return;
 }
 const xs=[22,177,332,538,693,848];for(const x of xs)screen(x,28,130,100,x===177||x===693?'ATTITUDE':x===22?'AIR DATA':x===332?'POWER COMMAND':x===538?'FLIGHT':'STORES');
 text(`${Math.round(n(p.speed)*1.944)} KT`,29,76,24);text(`${Math.round(n(p.pos?.y))} M`,29,105,20);attitude(177,50);attitude(693,50);
 for(let i=0;i<4;i++){c.fillStyle='#30413a';c.fillRect(344+i*27,57,14,47);c.fillStyle=ink;c.fillRect(344+i*27,104-Math.min(1,n(p.throttle))*47,14,Math.min(1,n(p.throttle))*47)}text(`${Math.round(n(p.throttle)*100)}%`,367,121,14);
 text(`${Math.round(n(p.speed)*1.944)} KT`,546,75,22);text(`${n(p.gLoad??1).toFixed(1)} G`,546,104,18);
 text(`BOMBS ${n(p.bombs)}`,855,74,18);text(`GUN ${n(p.gunAmmo)}`,855,103,18);
 screen(177,155,285,70,'HEADING / AIRFRAME');text(`${String((Math.round(n(p.yaw)*180/Math.PI)%360+360)%360).padStart(3,'0')}°`,186,199,24);text(p.gearDown?'GEAR DOWN':'GEAR UP',272,185,14);text(p.airbrake?'BRAKE OUT':'BRAKE IN',272,207,14);
 screen(538,155,285,70,'FUEL / COUNTERMEASURES');text(`${Math.round(100*n(p.fuelKg)/Math.max(1,n(p.fuelCapacityKg)))}%`,547,199,24);text(`FLARES ${n(p.flares)}`,630,185,14);text('BOMBER · DRY POWER',630,207,12);
 // Center pedestal keys and small panel fasteners are decorative only.
 for(let r=0;r<5;r++)for(let col=0;col<3;col++){c.fillStyle='#85928a';c.fillRect(481+col*12,36+r*15,7,7)}
 text('LEFT SEAT',22,183,11,dim);text('FLIGHT DECK',22,203,11,dim);text('RIGHT SEAT',851,183,11,dim);text('SYSTEMS',851,203,10,dim);
 for(const x of[9,491,990])for(const y of[20,238]){c.strokeStyle='#9aa19b';c.beginPath();c.arc(x,y,2,0,7);c.stroke()}
}
