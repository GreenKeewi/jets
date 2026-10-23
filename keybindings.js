export const BINDINGS_KEY='skybreak-keybindings-v1';
export const BINDINGS=[
 ['pitchUp','Pitch up',['KeyW']],['pitchDown','Pitch down',['KeyS']],['left','Bank left',['KeyA','ArrowLeft']],['right','Bank right',['KeyD','ArrowRight']],['powerUp','Increase power',['ArrowUp','ShiftLeft','ShiftRight']],['powerDown','Decrease power',['ArrowDown','KeyZ','Minus']],['gun','Gun',['Space']],['heat','Heat missile',['KeyQ']],['radar','Radar missile',['KeyE']],['flare','Flares',['KeyF']],['chaff','Chaff',['KeyC']],['bomb','Bomb',['KeyB']],['airbrake','Airbrake / wheel brake',['KeyX']],['gear','Landing gear',['KeyG']],['advanced','Advanced flight',['KeyK']],['assist','Route assist',['KeyL']],['camera','Camera',['KeyV']],['respawn','Respawn',['KeyR']],['mute','Sound',['KeyM']],['instruments','Extra instruments',['KeyI']],['pause','Pause',['KeyP']],['help','Flight manual',['KeyH']]
];
export const defaultBindings=()=>Object.fromEntries(BINDINGS.map(([id,,codes])=>[id,[...codes]]));
export const keyLabel=code=>({ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Space:'Space',ShiftLeft:'Left Shift',ShiftRight:'Right Shift',Minus:'−'}[code]||code.replace(/^Key|^Digit/,''));
export function rebind(bindings,id,code){
 if(!BINDINGS.some(b=>b[0]===id)||!/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Minus|Equal|Bracket(Left|Right)|Semicolon|Quote|Comma|Period|Slash|Backslash)$/.test(code))return{error:'That key is reserved for navigation or is unsupported. Choose a letter, number, arrow or punctuation key.'};
 const conflict=BINDINGS.find(([other])=>other!==id&&bindings[other]?.includes(code));
 if(conflict)return{error:`${keyLabel(code)} is already assigned to ${conflict[1]}. Change that control first.`};
 return{bindings:{...bindings,[id]:[code]}};
}
export function loadBindings(storage){
 const defaults=defaultBindings();
 try{
  const saved=JSON.parse(storage.getItem(BINDINGS_KEY));if(!saved)return defaults;
  const seen=new Set(),empty=Object.fromEntries(BINDINGS.map(([id])=>[id,[]]));
  for(const [id] of BINDINGS){
   if(!Array.isArray(saved[id])||!saved[id].length)return defaults;
   for(const code of saved[id]){if(seen.has(code)||!rebind(empty,id,code).bindings)return defaults;seen.add(code);}
  }
  return Object.fromEntries(BINDINGS.map(([id])=>[id,[...saved[id]]]));
 }catch{return defaults;}
}
export function canonicalKey(code,bindings){if(code==='Escape')return code;const item=BINDINGS.find(([id])=>bindings[id]?.includes(code));return item?item[2][0]:null;}
export function saveBindings(storage,bindings){try{storage.setItem(BINDINGS_KEY,JSON.stringify(bindings));return true;}catch{return false;}}
