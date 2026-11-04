// Explicit arcade feature support. Missing/legacy aircraft IDs never opt in.
const CAPABILITIES=Object.freeze({
 fa18e:Object.freeze({aoaOverride:true,simulationAirbrake:true}),
 su27:Object.freeze({aoaOverride:true,simulationAirbrake:true})
});
const has=(p,feature)=>!!p&&!p.bomber&&Object.hasOwn(CAPABILITIES,p.aircraftId)&&CAPABILITIES[p.aircraftId][feature]===true;
export const supportsAoaOverride=p=>has(p,'aoaOverride');
export const aoaOverrideActive=p=>supportsAoaOverride(p)&&p.aoaLimiterOff===true;
export function sanitizeAoaOverride(p){p.aoaLimiterOff=aoaOverrideActive(p);return p;}
export const usesSimulationAirbrakeDeployment=p=>has(p,'simulationAirbrake');
