// Arcade countermeasure balance, not a physical infrared seeker model.
// The caller supplies the simulation RNG so replays and host snapshots agree.
export const HEAT_SEEKER=Object.freeze({
 afterburnerThreshold:.82,flareRange:1100,flareAge:2.2,
 idleFlareChance:.78,militaryFlareChance:.60,
 afterburnerFlareChance:.30,fullAfterburnerFlareChance:.18
});

export function heatFlareChance(target){
 const power=Math.max(0,Math.min(1,Number.isFinite(target.throttle)?target.throttle:HEAT_SEEKER.afterburnerThreshold));
 const threshold=HEAT_SEEKER.afterburnerThreshold;
 // Use actual combustion state, not commanded throttle during fuel exhaustion/cooldown.
 if(!target.bomber&&target.afterburnerActive===true&&power>threshold){
  const burner=(power-threshold)/(1-threshold);
  return HEAT_SEEKER.afterburnerFlareChance+(HEAT_SEEKER.fullAfterburnerFlareChance-HEAT_SEEKER.afterburnerFlareChance)*burner;
 }
 const thrust=Math.min(1,power/threshold);
 return HEAT_SEEKER.idleFlareChance+(HEAT_SEEKER.militaryFlareChance-HEAT_SEEKER.idleFlareChance)*thrust;
}

export function tryHeatFlare(missile,target,countermeasures,random){
 if(missile.type!=='heat'||missile.decoyed||missile.seekerLost||!target)return null;
 // Arrays survive snapshot JSON round trips; a Set would silently lose history.
 const tried=missile.flareBurstsTried||(missile.flareBurstsTried=[]);
 for(const flare of countermeasures){
  if(flare.type!=='flare'||flare.ownerId!==target.id||flare.age>=HEAT_SEEKER.flareAge)continue;
  // All six particles from one release share burstId. Old snapshots without it
  // receive one fallback attempt, never six particles' worth of repeated rolls.
  const burst=flare.burstId??'legacy';
  if(tried.includes(burst)||Math.hypot(flare.pos.x-missile.pos.x,flare.pos.y-missile.pos.y,flare.pos.z-missile.pos.z)>=HEAT_SEEKER.flareRange)continue;
  tried.push(burst);
  // Failure is remembered for this burst. A fresh release earns a fresh chance;
  // continuing to fly through the same cloud does not reroll every frame.
  if(random()<heatFlareChance(target))return flare;
 }
 return null;
}
