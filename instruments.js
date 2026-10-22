// Compact flight strip: essentials in normal flight, manual systems only in K mode.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
export function drawCockpit(canvas,p){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 c.clearRect(0,0,w,h);c.save();c.scale(w/960,h/120);
 const green='#b6f3d5',dim='#8ba49f',amber='#ffd294',red='#ff9387';
 function text(s,x,y,size=11,color=green,align='left'){c.font=`${size>=20?'600 ':''}${size}px monospace`;c.fillStyle=color;c.textAlign=align;c.fillText(s,x,y)}
 function line(x1,y1,x2,y2,color=dim,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke()}
 c.fillStyle='#0b171d';c.fillRect(0,0,960,120);line(0,1,960,1,'#405a61');line(16,86,944,86,'#294049');
 const speed=clamp(p.speed,0,2000),alt=Math.max(0,finite(p.pos?.y));
 // World yaw increases toward west, so the heading uses the opposite sign.
 const yaw=finite(p.yaw),heading=(Math.round(-yaw*180/Math.PI)%360+360)%360;
 const fuel=clamp(Number.isFinite(p.fuelFraction)?p.fuelFraction:p.fuelCapacityKg>0?p.fuelKg/p.fuelCapacityKg:1,0,1);
 const g=finite(p.gLoad,1);
 // A small, banked horizon with a fixed aircraft reference replaces the old dial bank.
 const ax=57,ay=42,ar=29;
 c.save();c.beginPath();c.arc(ax,ay,ar,0,Math.PI*2);c.clip();c.translate(ax,ay);c.rotate(finite(p.roll));
 const horizon=clamp(p.pitch,-1.4,1.4)*32;
 c.fillStyle='#356d85';c.fillRect(-120,-120+horizon,240,120);
 c.fillStyle='#78664d';c.fillRect(-120,horizon,240,120);
 line(-100,horizon,100,horizon,'#e2eee6',2);c.restore();
 c.strokeStyle='#78928d';c.lineWidth=1;c.beginPath();c.arc(ax,ay,ar,0,Math.PI*2);c.stroke();
 line(ax-21,ay,ax-7,ay,amber,2);line(ax+7,ay,ax+21,ay,amber,2);line(ax-7,ay,ax,ay+4,amber,2);line(ax,ay+4,ax+7,ay,amber,2);
 text('ATTITUDE',ax,79,9,dim,'center');
 function readout(label,value,unit,x,color=green){text(label,x,23,10,dim);text(value,x,53,25,color);if(unit)text(unit,x,73,10,dim)}
 readout('SPEED',String(Math.round(speed*1.944)),'KNOTS',114);
 readout('ALTITUDE',Math.round(alt*3.281).toLocaleString('en-US'),'FEET',245);
 readout('HEADING',`${String(heading).padStart(3,'0')}°`,'',405);
 readout('FUEL',`${Math.round(fuel*100)}%`,'',545,fuel<.15?amber:green);
 readout('LOAD',`G ${g>=0?'+':''}${g.toFixed(1)}`,'',665,g<-.5||g>7?amber:green);
 text(`POWER ${Math.round(clamp(p.throttle,0,1)*100)}%`,810,23,10,dim);
 const remaining=Math.max(0,finite(p.afterburnerRemaining)),cooldown=Math.max(0,finite(p.afterburnerCooldown));
 const burner=p.bomber?'NOT FITTED':p.afterburnerActive?`ACTIVE ${remaining.toFixed(1)}s`:cooldown>0?`COOL ${cooldown.toFixed(1)}s`:p.afterburnerNeedsRelease?'LOWER POWER':`READY ${remaining.toFixed(1)}s`;
 text('AFTERBURNER',810,45,10,dim);text(burner,810,66,13,p.afterburnerActive||cooldown>0||p.afterburnerNeedsRelease?amber:green);
 // Normal flight keeps gear/braking automatic. Never advertise manual bindings there.
 text(p.maneuverAssist?'K MODE · MANUAL':'NORMAL FLIGHT',20,108,11,dim);
 if(p.maneuverAssist){text(`GEAR [G] ${p.gearDown?'DOWN':'UP'}`,230,108,11,green);text(`AIRBRAKE [X] ${p.airbrake?'OPEN':'CLOSED'}`,410,108,11,p.airbrake?amber:dim)}
 else text('AUTO GEAR',230,108,11,dim);
 const cautions=[];
 if((p.engineHealth??1)<.6)cautions.push('ENGINE DAMAGE');
 if((p.controlHealth??1)<.6)cautions.push('CONTROL DAMAGE');
 if(fuel<.08)cautions.push('LOW FUEL');
 text(cautions.join(' · '),940,108,10,cautions.length?red:dim,'right');
 c.restore();
}
