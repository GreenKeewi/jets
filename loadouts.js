// Bounded air-to-air game layouts, not exhaustive aircraft certifications.
// Model coordinates are local metres: +X right, +Y up, +Z nose.
const point=(id,label,x,y,z,allowed,store='empty')=>Object.freeze({id,label,position:Object.freeze({x,y,z}),allowed:Object.freeze(['empty',...allowed]),defaultStore:store});
const pair=(id,label,x,y,z,allowed,stores=['heat','heat'])=>[
 point(`${id}-l`,`${label} · left`,-x,y,z,allowed,stores[0]),
 point(`${id}-r`,`${label} · right`,x,y,z,allowed,stores[1])
];
const stations=(tip,outer,mid,inner,center,extra=[],withTanks=true)=>Object.freeze([
 ...pair('wingtip','Wingtip',...tip,['heat']),
 ...pair('outerwing','Outer wing',...outer,['heat','radar','bomb']),
 ...pair('midwing','Mid wing',...mid,['heat','radar','bomb'],['radar','radar']),
 ...extra,
 ...(withTanks?[...pair('innerwing','Inner tank',...inner,['tank'],['empty','empty']),point('centerline','Centerline tank',0,...center,['tank'])]:[])
]);
const define=(id,name,description,dryMass,fuelCapacity,tuning,hardpoints)=>Object.freeze({id,name,label:name,description,dryMass,internalFuelCapacity:fuelCapacity,fuelCapacity,tuning:Object.freeze(tuning),flight:Object.freeze({...tuning,dryMass,fuelCapacity}),hardpoints,stations:hardpoints,maxMissiles:hardpoints.filter(s=>s.allowed.includes('heat')||s.allowed.includes('radar')).length,maxTanks:hardpoints.filter(s=>s.allowed.includes('tank')).length});
export const EXTERNAL_TANK_FUEL_FRACTION=.2;
export const AIRCRAFT_DEFINITIONS=Object.freeze({
 f16:define('f16','F-16C Fighting Falcon','Light single-engine fighter · six missile stations',8500,3200,{parasite:.0001,induced:3000,turnInduced:11000,maxThrust:18,burnerThrust:36,groundThrust:8.5,stallSpeed:78,turnDragLimit:24,maxSpeed:670.56,wingArea:27.87,maxG:9,aoaLimit:25,turnLoad:8,fuelBurn:1},stations([10.35,-.28,-4.9],[7.5,-.7,-3.3],[5.35,-.8,-2.2],[3.15,-1,-1.3],[-1.9,-1.3])),
 fa18e:define('fa18e','F/A-18E Super Hornet','Twin-engine naval fighter · eight missile stations',14500,6600,{parasite:.000115,induced:3300,turnInduced:11500,maxThrust:19,burnerThrust:33,groundThrust:8.1,stallSpeed:72,turnDragLimit:24,maxSpeed:530.56,wingArea:46.45,maxG:7.5,aoaLimit:22,turnLoad:7.5,fuelBurn:1.45},stations([12.45,-.3,-4.1],[9.1,-.8,-3],[6.8,-.8,-1.6],[4.3,-1.1,-.8],[-1.9,-1.8],pair('cheek','Fuselage',1.75,-1.25,1,['radar'],['radar','radar']))),
 su27:define('su27','Su-27 Flanker','Blue-camouflage Flanker · twin engines · no canards',16300,9400,{parasite:.000105,induced:3400,turnInduced:10500,maxThrust:20,burnerThrust:38,groundThrust:8.3,stallSpeed:75,turnDragLimit:25,maxSpeed:694.44,wingArea:62,maxG:9,aoaLimit:24,turnLoad:9,fuelBurn:1.7},stations([14.15,-.3,-5.9],[11,-.8,-4.8],[8,-.8,-3.5],[5.2,-1.3,-2.2],[-1.5,-3],pair('belly','Belly',1.35,-1.2,-2.5,['heat','radar'],['radar','radar']),false)),
 f14:define('f14','F-14B Tomcat','Twin-seat swing-wing fleet fighter · manual wing sweep',19800,7348,{parasite:.0001,induced:3600,turnInduced:11500,maxThrust:20,burnerThrust:36,groundThrust:8.2,stallSpeed:76,turnDragLimit:25,maxSpeed:690.23,wingArea:52.5,maxG:7.5,aoaLimit:24,turnLoad:7.5,fuelBurn:1.6},stations([5.8,-.55,2],[4.9,-.85,1],[2.2,-1.2,-2],[3.6,-1.35,-3],[-1.7,-1],pair('belly','Fuselage',1.3,-1.15,1,['heat','radar'],['radar','radar'])))
});
export const HARDPOINTS=Object.freeze(Object.fromEntries(Object.entries(AIRCRAFT_DEFINITIONS).map(([id,a])=>[id,a.hardpoints])));
export function normalizeAircraftId(id){if(id==='su37')id='su27';return typeof id==='string'&&Object.hasOwn(AIRCRAFT_DEFINITIONS,id)?id:'f16';}
export function aircraftDefinition(id){return AIRCRAFT_DEFINITIONS[normalizeAircraftId(id)];}
export function defaultLoadout(id){return{stations:Object.fromEntries(aircraftDefinition(id).hardpoints.map(s=>[s.id,s.defaultStore]))};}
export function validLoadout(id,value){
 if(!Object.hasOwn(AIRCRAFT_DEFINITIONS,id)||!value||typeof value!=='object'||Array.isArray(value)||!Object.hasOwn(value,'stations')||Object.keys(value).some(key=>key!=='stations'))return false;
 const assignments=value.stations;if(!assignments||typeof assignments!=='object'||Array.isArray(assignments))return false;
 const hardpoints=aircraftDefinition(id).hardpoints;
 return Object.entries(assignments).every(([key,type])=>hardpoints.some(s=>s.id===key&&typeof type==='string'&&s.allowed.includes(type)));
}
export function normalizeLoadout(id,value){
 if(value===undefined||value===null)return defaultLoadout(id);
 const supplied=value&&typeof value==='object'&&!Array.isArray(value)&&value.stations&&typeof value.stations==='object'&&!Array.isArray(value.stations)?value.stations:{};
 return{stations:Object.fromEntries(aircraftDefinition(id).hardpoints.map(s=>{const type=Object.hasOwn(supplied,s.id)?supplied[s.id]:null;return[s.id,typeof type==='string'&&s.allowed.includes(type)?type:'empty'];}))};
}
export function loadoutStores(id,value){
 const a=aircraftDefinition(id),loadout=normalizeLoadout(id,value),assigned=a.hardpoints.map(s=>({...s,type:loadout.stations[s.id]}));
 const heat=assigned.filter(s=>s.type==='heat').length,radar=assigned.filter(s=>s.type==='radar').length,tanks=assigned.filter(s=>s.type==='tank').length,bombs=assigned.filter(s=>s.type==='bomb').length*2;
 const externalFuelCapacity=a.internalFuelCapacity*EXTERNAL_TANK_FUEL_FRACTION*tanks;
 return{heat,radar,tanks,bombs,missiles:heat+radar,totalMissiles:heat+radar,stations:assigned,internalFuelCapacity:a.internalFuelCapacity,externalFuelCapacity,fuelCapacity:a.internalFuelCapacity+externalFuelCapacity};
}
export function strikeLoadout(id,value){
 const l=normalizeLoadout(id,value),stations=aircraftDefinition(id).stations.filter(s=>s.allowed.includes('bomb'));
 for(const s of stations.slice(0,2))l.stations[s.id]='bomb';return l;
}
export function loadoutCapacity(id,value){
 const a=aircraftDefinition(id),supplied=value===null||value===undefined?null:value?.stations;
 const tanks=a.hardpoints.reduce((sum,s)=>sum+(s.allowed.includes('tank')&&(supplied&&Object.hasOwn(supplied,s.id)?supplied[s.id]==='tank':!supplied&&s.defaultStore==='tank')?1:0),0);
 return a.internalFuelCapacity*(1+EXTERNAL_TANK_FUEL_FRACTION*tanks);
}
