// Current design: cosmetic vignette + gentle wear, no physiology impairment.
import {writeFileSync} from 'node:fs';
import {freshPilotG,advancePilotPhysiology,advanceAirframeWear,pilotGInput} from '../../../pilot-g.js';
const report={method:'Node simulation at30/60/144Hz. Supersedes intermediate blackout-timing experiment.',cases:[]};
for(const hz of [30,60,144])for(const load of [1,6,9,-1,-3,40,-40]){
 const p={...freshPilotG(),hp:100,grounded:false};let peakVision=0,controlsIntact=true;
 for(let n=0;n<120*hz;n++){p.normalLoad=load;advancePilotPhysiology(p,load,1/hz);advanceAirframeWear(p,1/hz);peakVision=Math.max(peakVision,p.gVision);controlsIntact&&=pilotGInput(p,{pitch:1,fireGun:true}).fireGun;}
 report.cases.push({hz,load,duration:120,peakVision,controlsIntact,hp:p.hp,airframeWear:p.airframeWear,blackout:!!p.blackedOut,redout:!!p.gRedout});
}
writeFileSync(new URL('./measurements.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
