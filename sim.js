// Flight and combat rules are renderer-independent so missions can be replayed deterministically.
export const RUNWAY={x:-1800,z:-2000,halfLength:1000,width:100};
export const ROUTE=[{x:-1800,y:300,z:-200},{x:0,y:650,z:1300},{x:2100,y:600,z:0},{x:300,y:480,z:-2100},{x:-1800,y:260,z:-3500}];
export const TARGET={x:0,y:4,z:700};
export const ESCAPE={x:2700,y:500,z:-1500,radius:550};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angle=(v)=>Math.atan2(Math.sin(v),Math.cos(v));
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export const horizontal=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function forward(p){return{x:Math.sin(p.yaw)*Math.cos(p.pitch),y:Math.sin(p.pitch),z:Math.cos(p.yaw)*Math.cos(p.pitch)}}
function random(g){g.rng=(1664525*g.rng+1013904223)>>>0;return g.rng/4294967296}
function spawnPilot(g,i,team){
 const free=g.mode==='freeflight',strike=g.mode==='strike',attacker=g.role==='defend'?1:0;
 const bomber=strike&&team===attacker&&i===(team===0?0:g.teamSize);
 let pos=free?{x:RUNWAY.x,y:3,z:-2720}:strike?(team===attacker?{x:(i%g.teamSize)*180,y:450,z:-2450-(i%g.teamSize)*200}:{x:1800+(i%g.teamSize)*150,y:650,z:300-(i%g.teamSize)*250}):{x:(i%g.teamSize)*240-180,y:700+(i%g.teamSize)*80,z:team===0?-1850:1850};
 return{id:i===0?'host':`bot${i}`,team,human:i===0,bomber,pos,yaw:free?0:strike?(team===attacker?0:-Math.PI/2):team===0?0:Math.PI,pitch:0,roll:0,speed:free?0:bomber?110:140,throttle:free?0:0.78,hp:100,heat:6,radar:4,flares:6,chaff:6,bombs:bomber?3:0,heatCD:0,radarCD:0,flareCD:0,chaffCD:0,bombCD:0,lock:0,targetId:null,dead:false,grounded:free,landed:false,aiTimer:0,aiShot:2+i*.6,aiDefend:0,aiBreak:0,aiNextBreak:7+i*1.9,rearm:0,aiEvade:0,trail:[]};
}
export function createGame({mode='dogfight',teamSize=1,role='attack',seed=64821,difficulty='normal'}={}){
 if(!['dogfight','strike','freeflight'].includes(mode))mode='dogfight';
 const g={version:1,mode,teamSize:clamp(Math.floor(teamSize)||1,1,3),role:role==='defend'?'defend':'attack',difficulty,rng:seed>>>0,time:0,tick:0,status:'playing',result:null,pilots:[],missiles:[],countermeasures:[],bombs:[],effects:[],events:[],serial:0,targetHp:100,bombed:false,routeIndex:0,flightStage:'takeoff',approachIndex:0,missionMessage:'',escaped:false};
 for(let i=0;i<(mode==='freeflight'?1:g.teamSize*2);i++)g.pilots.push(spawnPilot(g,i,i<g.teamSize?0:1));
 emit(g,'start',mode==='freeflight'?'Clear for takeoff. Add power, then gently climb.':mode==='strike'?(g.role==='attack'?'Strike package airborne. Reach the target, then escape.':'Intercept the bomber before it escapes.'):'Weapons free. Protect your wingmates.');
 return g;
}
export function configurePlayers(g,ids=['host']){
 const seats=[];for(let i=0;i<g.teamSize;i++){seats.push(i);seats.push(g.teamSize+i)}
 if(g.mode==='freeflight'){for(let i=1;i<ids.length;i++){const p=spawnPilot(g,i,0);p.pos.x+=i*35;p.pos.z-=i*65;g.pilots.push(p)};g.pilots.forEach((p,i)=>{p.id=ids[i]||`bot${i}`;p.human=!!ids[i]});return;}
 for(let i=0;i<Math.min(ids.length,seats.length);i++){const p=g.pilots[seats[i]];p.id=ids[i];p.human=true}
}
function emit(g,type,text,extra={}){g.events.push({id:++g.serial,type,text,t:g.time,...extra});if(g.events.length>24)g.events.shift()}
function kill(g,p,source){if(p.dead)return;p.hp=0;p.dead=true;g.effects.push({id:++g.serial,type:'explosion',pos:{...p.pos},age:0,life:2.3});emit(g,'kill',`${p.human?'Pilot':p.bomber?'Bomber':'Bandit'} down`,{pilotId:p.id,source});}
export function desiredHeading(p,target){return Math.atan2(target.x-p.pos.x,target.z-p.pos.z)}
function ai(g,p,dt){
 let target;
 if(g.mode==='strike'&&p.bomber){target=g.bombed?ESCAPE:{x:TARGET.x,y:430,z:TARGET.z-350};if(!g.bombed&&horizontal(p.pos,target)<420&&p.bombCD<=0){return{...steer(p,target),bomb:true,throttle:0}}}
 else {const enemies=g.pilots.filter(x=>!x.dead&&x.team!==p.team);target=enemies.sort((a,b)=>dist(p.pos,a.pos)-dist(p.pos,b.pos))[0];if(!target)return{};p.targetId=target.id;target=target.pos}
 let i=steer(p,target);const headingError=Math.abs(angle(desiredHeading(p,target)-p.yaw));p.aiNextBreak-=dt;p.aiBreak=Math.max(0,(p.aiBreak||0)-dt);if(p.aiNextBreak<=0&&headingError>.8){p.aiBreak=3+random(g)*2;p.aiNextBreak=11+random(g)*6}if(p.aiBreak>0){i.roll=Math.sin(g.time*.7+p.pos.x*.001)*.12;i.pitch=(600-p.pos.y)*.002}const desiredSpeed=p.bomber?115:118+(g.pilots.indexOf(p)%3)*16;i.throttle=p.speed<desiredSpeed?.5:-.25;
 const incoming=g.missiles.find(m=>m.targetId===p.id&&!m.decoyed&&dist(m.pos,p.pos)<620);
 p.aiShot=Math.max(0,(p.aiShot||0)-dt);p.aiDefend=Math.max(0,(p.aiDefend||0)-dt);
 p.aiEvade=Math.max(0,p.aiEvade-dt);
 if(incoming&&p.aiDefend<=0){p.aiDefend=5+random(g)*2;if(random(g)<.57){i.flare=incoming.type==='heat';i.chaff=incoming.type==='radar'}p.aiEvade=2.5+random(g)*1.5}
 if(p.aiEvade>1.5){i.roll+=(p.team===0?0.45:-0.45);i.pitch=clamp(i.pitch+0.15,-1,1)}
 if(g.mode!=='freeflight'&&p.targetId&&p.lock>0.8&&p.aiShot<=0){const enemy=g.pilots.find(q=>q.id===p.targetId);if(enemy&&dist(p.pos,enemy.pos)<2300){i.fireHeat=p.heat>0&&(random(g)<.65||p.radar<=0);i.fireRadar=!i.fireHeat&&p.lock>1.45;p.aiShot=4.5+random(g)*2.5}}
 if(p.pos.y<150)i.pitch=Math.max(0.45,i.pitch);
 if(p.pos.y>1700)i.pitch=Math.min(-0.5,i.pitch);
 if(Math.abs(p.pos.x)>6000||Math.abs(p.pos.z)>6000){return steer(p,{x:0,y:650,z:0})}
 return i;
}
export function steer(p,target){const heading=angle(desiredHeading(p,target)-p.yaw),d=horizontal(p.pos,target),pitch=Math.atan2(target.y-p.pos.y,Math.max(100,d));return{roll:clamp(heading*2.1,-1,1),pitch:clamp((pitch-p.pitch)*3.8,-1,1),yaw:clamp(heading*0.12,-0.3,0.3),throttle:0}}
function selectTarget(g,p){let best=null,score=Infinity;const f=forward(p);for(const q of g.pilots){if(q.dead||q.team===p.team)continue;const d=dist(p.pos,q.pos);const dot=((q.pos.x-p.pos.x)*f.x+(q.pos.y-p.pos.y)*f.y+(q.pos.z-p.pos.z)*f.z)/Math.max(1,d);const a=Math.acos(clamp(dot,-1,1));if(d<4200&&a<0.58&&d*(a+0.2)<score){best=q;score=d*(a+0.2)}}return best}
function launch(g,p,type){const cd=type==='heat'?'heatCD':'radarCD';if(p[cd]>0||p[type]<=0)return;const target=g.pilots.find(q=>q.id===p.targetId&&!q.dead);if(!target||p.lock<(type==='heat'?0.45:1.45))return;
 p[type]--;p[cd]=type==='heat'?1.65:2.5;const f=forward(p);g.missiles.push({id:++g.serial,type,ownerId:p.id,team:p.team,targetId:target.id,pos:{x:p.pos.x+f.x*18,y:p.pos.y+f.y*18-2,z:p.pos.z+f.z*18},dir:f,speed:p.speed+90,age:0,life:type==='heat'?13:17,decoyed:false});emit(g,'launch',type==='heat'?'Fox two · heat seeker away':'Fox one · radar missile away',{pilotId:p.id});}
export function bombSolution(p){const t=Math.sqrt(Math.max(0,p.pos.y-4)*2/45),f=forward(p);return{x:p.pos.x+f.x*p.speed*t,y:4,z:p.pos.z+f.z*p.speed*t}}
export function canBomb(g,p){return p.bomber&&p.bombs>0&&!g.bombed&&p.pos.y>100&&p.pos.y<1000&&horizontal(bombSolution(p),TARGET)<330}
function counter(g,p,type){const key=type==='flare'?'flares':'chaff',cd=type+'CD';if(!p[key]||p[cd]>0)return;p[key]--;p[cd]=1.2;for(let i=0;i<6;i++)g.countermeasures.push({id:++g.serial,type,ownerId:p.id,pos:{...p.pos},vel:{x:(random(g)-.5)*60,y:(random(g)-.5)*40-12,z:(random(g)-.5)*60},age:0,life:type==='flare'?3.8:5});emit(g,'counter',type==='flare'?'Flares out':'Chaff out',{pilotId:p.id})}
function updatePilot(g,p,input,dt){
 if(p.dead)return;
 for(const k of ['heatCD','radarCD','flareCD','chaffCD','bombCD'])p[k]=Math.max(0,p[k]-dt);
 p.rearm=(p.rearm||0)+dt;if(p.rearm>22&&g.mode!=='freeflight'){p.rearm=0;p.heat=Math.min(6,p.heat+2);p.radar=Math.min(4,p.radar+1);if(p.human)emit(g,'rearm','Weapons topped up · +2 heat, +1 radar',{pilotId:p.id})}
 const i=input||{};p.throttle=clamp(p.throttle+(Number(i.throttle)||0)*dt*.38,0,1);
 const maxSpeed=p.bomber?172:210,minSpeed=p.grounded?0:55;
 const drag=p.grounded?9:10;
 const targetSpeed=p.throttle*maxSpeed;
 p.speed=clamp(p.speed+(targetSpeed-p.speed)*dt*.24-(i.brake?(p.grounded?45:33):0)*dt-p.pitch*dt*10,minSpeed,maxSpeed+22);
 if(p.grounded){p.pitch=0;p.roll=0;p.yaw+=clamp(Number(i.roll)||0,-1,1)*dt*(p.speed<60?0.32:0.15)+clamp(Number(i.yaw)||0,-1,1)*dt*.28;
 if(p.speed>72&&Number(i.pitch)>.12){p.grounded=false;p.landed=false;p.pitch=.08;p.pos.y=4;emit(g,'takeoff','Positive climb. Gear up — follow the route.',{pilotId:p.id});if(g.mode==='freeflight')g.flightStage='route'}
 }else{
 const wantedRoll=clamp(Number(i.roll)||0,-1,1)*1.0;
 p.roll+=(wantedRoll-p.roll)*Math.min(1,dt*3.8);
 const wantedPitch=clamp(Number(i.pitch)||0,-1,1)*.52;
 p.pitch+=(wantedPitch-p.pitch)*Math.min(1,dt*1.8);
 p.yaw=angle(p.yaw+(Math.sin(p.roll)*.62+clamp(Number(i.yaw)||0,-1,1)*.17)*dt*(clamp(p.speed/100,.35,1.3)));
 }
 const f=forward(p);p.pos.x+=f.x*p.speed*dt;p.pos.z+=f.z*p.speed*dt;
 if(!p.grounded)p.pos.y+=f.y*p.speed*dt-Math.max(0,83-p.speed)*dt*.48;
 const overRunway=Math.abs(p.pos.x-RUNWAY.x)<RUNWAY.width&&Math.abs(p.pos.z-RUNWAY.z)<RUNWAY.halfLength;
 if(!p.grounded&&p.pos.y<=3){
 if(g.mode==='freeflight'&&overRunway&&p.speed<115&&Math.abs(angle(p.yaw))<.35&&Math.abs(p.roll)<.35&&p.pitch>-.28){p.grounded=true;p.pos.y=3;p.landed=true;p.pitch=0;p.roll=0;g.flightStage=g.routeIndex>=ROUTE.length?'landed':'practice';emit(g,'landed',g.routeIndex>=ROUTE.length?'Touchdown! Hold brakes and roll to a stop.':'Practice landing. Take off again to finish the route.',{pilotId:p.id})}
 else if(g.mode==='freeflight'){p.pos.y=100;p.pitch=.18;p.speed=Math.max(110,p.speed);p.throttle=.8;emit(g,'recovery','Go around · safe recovery. Follow the landing guide and try again.',{pilotId:p.id});g.flightStage=g.routeIndex>=ROUTE.length?'approach':'route';g.approachIndex=0}
 else kill(g,p,'terrain');
 }
 p.pos.y=Math.max(p.grounded?3:0,Math.min(4000,p.pos.y));
 if(g.mode!=='freeflight'){
 const q=selectTarget(g,p);if(q&&q.id===p.targetId)p.lock=Math.min(3,p.lock+dt);else{p.targetId=q?.id||null;p.lock=q?dt:0}
 if(i.fireHeat)launch(g,p,'heat');if(i.fireRadar)launch(g,p,'radar');if(i.flare)counter(g,p,'flare');if(i.chaff)counter(g,p,'chaff');
 if(i.bomb&&p.bomber&&p.bombs>0&&p.bombCD<=0){p.bombs--;p.bombCD=1;g.bombs.push({id:++g.serial,ownerId:p.id,pos:{...p.pos},vel:{x:f.x*p.speed,y:f.y*p.speed,z:f.z*p.speed},age:0});emit(g,'bomb','Bomb released',{pilotId:p.id})}
 }
}
function updateMissiles(g,dt){for(const m of g.missiles){m.age+=dt;const target=g.pilots.find(p=>p.id===m.targetId&&!p.dead);if(target){const appropriate=m.type==='heat'?'flare':'chaff';if(!m.decoyed&&g.countermeasures.some(c=>c.ownerId===target.id&&c.type===appropriate&&c.age<2.2&&dist(c.pos,m.pos)<700)){m.decoyed=true;emit(g,'evade',`${appropriate==='flare'?'Heat seeker':'Radar missile'} defeated`,{pilotId:target.id});}
 if(!m.decoyed){const d=dist(m.pos,target.pos);const lead=d/Math.max(1,m.speed);const f=forward(target),aim={x:target.pos.x+f.x*target.speed*lead*.55,y:target.pos.y+f.y*target.speed*lead*.55,z:target.pos.z+f.z*target.speed*lead*.55};const len=dist(m.pos,aim);const blend=Math.min(1,dt*(m.type==='heat'?2.7:2.2));m.dir.x+=( (aim.x-m.pos.x)/len-m.dir.x)*blend;m.dir.y+=((aim.y-m.pos.y)/len-m.dir.y)*blend;m.dir.z+=((aim.z-m.pos.z)/len-m.dir.z)*blend;const norm=Math.hypot(m.dir.x,m.dir.y,m.dir.z);m.dir.x/=norm;m.dir.y/=norm;m.dir.z/=norm;
 if(d<32){target.hp-=m.type==='heat'?48:60;m.age=m.life;g.effects.push({id:++g.serial,type:'hit',pos:{...target.pos},age:0,life:.8});emit(g,'hit','Missile hit',{pilotId:m.ownerId,targetId:target.id});if(target.hp<=0)kill(g,target,m.ownerId)}
 }}m.speed=Math.min(m.type==='heat'?325:390,m.speed+dt*65);m.pos.x+=m.dir.x*m.speed*dt;m.pos.y+=m.dir.y*m.speed*dt;m.pos.z+=m.dir.z*m.speed*dt;if(m.pos.y<0)m.age=m.life}
 g.missiles=g.missiles.filter(m=>m.age<m.life);
}
function mission(g,dt){
 if(g.mode==='freeflight'){const p=g.pilots[0];if(g.flightStage==='route'){const waypoint=ROUTE[g.routeIndex];if(waypoint&&dist(p.pos,waypoint)<360){g.routeIndex++;emit(g,'gate',g.routeIndex<ROUTE.length?`Route gate ${g.routeIndex} cleared`:'Route complete. Line up with the runway and reduce power.');if(g.routeIndex>=ROUTE.length){g.flightStage='approach';g.approachIndex=0}}}
 if(g.flightStage==='landed'&&g.routeIndex>=ROUTE.length&&p.speed<5){g.status='complete';g.result={title:'Beautiful landing',text:'Route flown, runway reached, aircraft safely stopped.',winner:0}}
 return;
 }
 if(g.mode==='strike'){const bomber=g.pilots.find(p=>p.bomber);if(bomber?.dead){g.status='complete';g.result={title:bomber.team===0?'Strike intercepted':'Interceptor victory',text:'The bomber was stopped before reaching its escape zone.',winner:1-bomber.team};return}if(g.bombed&&bomber&&horizontal(bomber.pos,ESCAPE)<ESCAPE.radius&&bomber.pos.y>100){g.escaped=true;g.status='complete';g.result={title:bomber.team===0?'Clean getaway':'Bomber escaped',text:'The target was destroyed and the strike aircraft reached safety.',winner:bomber.team};return}}
 const alive=[g.pilots.some(p=>!p.dead&&p.team===0),g.pilots.some(p=>!p.dead&&p.team===1)];
 if(!alive[0]||!alive[1]){g.status='complete';g.result={title:alive[0]?'Air superiority':'Squadron defeated',text:alive[0]?'The skies are yours. Every opposing aircraft is down.':'Your squadron has been intercepted. Try another sortie.',winner:alive[0]?0:1}}
 if(g.time>480){g.status='complete';g.result={title:'Sortie complete',text:'Fuel reserve reached. The squadron is returning to base.',winner:null}}
}
export function step(g,inputs={},dt=1/60){if(g.status!=='playing')return;dt=clamp(dt,0,.05);g.time+=dt;g.tick++;for(const p of g.pilots)updatePilot(g,p,p.human?(inputs[p.id]||{}):ai(g,p,dt),dt);updateMissiles(g,dt);
 for(const c of g.countermeasures){c.age+=dt;c.pos.x+=c.vel.x*dt;c.pos.y+=c.vel.y*dt;c.pos.z+=c.vel.z*dt;c.vel.y-=12*dt}g.countermeasures=g.countermeasures.filter(c=>c.age<c.life);
 for(const b of g.bombs){b.age+=dt;b.vel.y-=45*dt;b.pos.x+=b.vel.x*dt;b.pos.y+=b.vel.y*dt;b.pos.z+=b.vel.z*dt;if(b.pos.y<=4){if(horizontal(b.pos,TARGET)<330&&!g.bombed){g.targetHp=0;g.bombed=true;emit(g,'target','Target destroyed. Turn toward ESCAPE.');g.effects.push({id:++g.serial,type:'target',pos:{...TARGET},age:0,life:8})}else emit(g,'miss','Bomb missed. Circle back for another pass.');b.pos.y=-999}}g.bombs=g.bombs.filter(b=>b.pos.y>-100);
 for(const e of g.effects)e.age+=dt;g.effects=g.effects.filter(e=>e.age<e.life);mission(g,dt);
}
export function snapshot(g){return JSON.parse(JSON.stringify(g))}
export function applySnapshot(g,s){if(!s||s.version!==1||!Array.isArray(s.pilots)||s.pilots.length>6)return false;Object.assign(g,s);return true}

export const APPROACH=[{x:-2450,y:420,z:-4800},{x:-1800,y:360,z:-4800},{x:-1800,y:280,z:-3750}];
export function routeGuidance(g,p){
 let i={pitch:0,roll:0,yaw:0,throttle:0,brake:false},target,desiredPower=.7;
 if(p.grounded&&!p.landed){i.pitch=p.speed>76?.6:0;i.roll=clamp((RUNWAY.x-p.pos.x)*.02,-.4,.4);i.throttle=p.throttle<.97?1:0;return i}
 if(['landed','practice'].includes(g.flightStage)&&p.grounded){return{...i,throttle:-1,brake:true}}
 if(g.flightStage==='route')target=ROUTE[g.routeIndex];
 if(g.flightStage==='approach'){
   if(g.approachIndex<APPROACH.length){target=APPROACH[g.approachIndex];if(dist(p.pos,target)<230){g.approachIndex++;target=APPROACH[g.approachIndex]}desiredPower=.54}
   if(g.approachIndex>=APPROACH.length){const ahead=p.pos.z+420,height=Math.max(2,(-2150-ahead)*.17);target={x:RUNWAY.x,y:height,z:ahead};desiredPower=p.pos.y<18?.32:.42;i.brake=p.speed>103;
      if(p.pos.z>-1000&&p.pos.y>12){g.approachIndex=0;emit(g,'recovery','Missed approach · route assist is setting up another pass.',{pilotId:p.id});target=APPROACH[0];desiredPower=.7}
   }
 }
 if(target){const h=angle(desiredHeading(p,target)-p.yaw),distance=horizontal(p.pos,target),desiredPitch=Math.atan2(target.y-p.pos.y,Math.max(120,distance));i.roll=clamp(h*1.8,-1,1);i.pitch=clamp(desiredPitch/.52+(desiredPitch-p.pitch)*2,-1,1);if(g.flightStage==='approach'&&g.approachIndex>=APPROACH.length&&p.pos.y<12)i.pitch=-.025/.52;}
 i.throttle=p.throttle<desiredPower-.01?.5:p.throttle>desiredPower+.01?-.5:0;return i;
}
