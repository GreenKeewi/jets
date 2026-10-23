// Arcade countermeasure balance, not a physical infrared seeker model.
// The caller supplies the simulation RNG so replays and host snapshots agree.
export const HEAT_SEEKER=Object.freeze({
 afterburnerThreshold:1.1,flareRange:1100,flareAge:2.2,
 idleFlareChance:.78,militaryFlareChance:.60,
 afterburnerFlareChance:.30,fullAfterburnerFlareChance:.18
});

export function heatFlareChance(target){
 const power=Math.max(0,Math.min(1.1,Number.isFinite(target.throttle)?target.throttle:HEAT_SEEKER.afterburnerThreshold));
 // Actual combustion state wins over the throttle command, including fuel-out.
 if(!target.bomber&&target.afterburnerActive===true)return HEAT_SEEKER.fullAfterburnerFlareChance;
 const thrust=Math.min(1,power);
 return HEAT_SEEKER.idleFlareChance+(HEAT_SEEKER.militaryFlareChance-HEAT_SEEKER.idleFlareChance)*thrust;
}

export function tryHeatFlare(missile,target,countermeasures,random){
 if(missile.type!=='heat'||missile.decoyed||missile.seekerLost||!target)return null;
 // Arrays survive snapshot JSON round trips; a Set would silently lose history.
 const tried=missile.flareBurstsTried||(missile.flareBurstsTried=[]);
 for(const flare of countermeasures){
  if(flare.type!=='flare'||flare.ownerId!==target.id||flare.age>=HEAT_SEEKER.flareAge)continue;
  // All particles from one release share burstId. Old snapshots without it
  // receive one fallback attempt, never six particles' worth of repeated rolls.
  const burst=flare.burstId??'legacy';
  if(tried.includes(burst)||Math.hypot(flare.pos.x-missile.pos.x,flare.pos.y-missile.pos.y,flare.pos.z-missile.pos.z)>=HEAT_SEEKER.flareRange)continue;
  tried.push(burst);
  // Failure is remembered for this burst. A fresh release earns a fresh chance;
  // continuing to fly through the same cloud does not reroll every frame.
  if(random()<heatFlareChance(target)*burstChanceScale(tried.length-1))return flare;
 }
 return null;
}

// Each new burst provides another roll, with diminishing returns. The existing
// failed-burst history survives snapshots; a persistent cloud never rerolls.
export function burstChanceScale(previousAttempts){return 1/(1+Math.max(0,previousAttempts)*.65);}
export function tryRadarChaff(missile,target,countermeasures,random){
 if(missile.type!=='radar'||missile.decoyed||missile.seekerLost||!target)return null;
 const tried=missile.chaffBurstsTried||(missile.chaffBurstsTried=[]);
 for(const cloud of countermeasures){
  if(cloud.type!=='chaff'||cloud.ownerId!==target.id||cloud.age>=2.2)continue;
  const burst=cloud.burstId??'legacy';
  if(tried.includes(burst)||Math.hypot(cloud.pos.x-missile.pos.x,cloud.pos.y-missile.pos.y,cloud.pos.z-missile.pos.z)>=1100)continue;
  tried.push(burst);if(random()<.64*burstChanceScale(tried.length-1))return cloud;
 }
 return null;
}
