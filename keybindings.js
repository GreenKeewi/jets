export const BINDINGS_KEY='skybreak-keybindings-v1';
export const BINDINGS=[
 ['pitchUp','Pitch up',['KeyW']],['pitchDown','Pitch down',['KeyS']],['left','Bank left',['KeyA','ArrowLeft']],['right','Bank right',['KeyD','ArrowRight']],['powerUp','Increase power',['ArrowUp','ShiftLeft','ShiftRight']],['powerDown','Decrease power',['ArrowDown','KeyZ','Minus']],['gun','Gun',['Space']],['heat','Heat missile',['KeyQ']],['radar','Radar missile',['KeyE']],['flare','Flares',['KeyF']],['chaff','Chaff',['KeyC']],['bomb','Bomb',['KeyB']],['airbrake','Airbrake / wheel brake',['KeyX']],['gear','Landing gear',['KeyG']],['advanced','Advanced flight',['KeyK']],['assist','Route assist',['KeyL']],['camera','Camera',['KeyV']],['respawn','Respawn',['KeyR']],['map','Tactical map',['KeyM']],['mute','Sound',['KeyN']],['instruments','Extra instruments',['KeyI']],['pause','Pause',['KeyP']],['help','Flight manual',['KeyH']]
];
export const defaultBindings=()=>Object.fromEntries(BINDINGS.map(([id,,codes])=>[id,[...codes]]));
export const keyLabel=code=>({ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Space:'Space',ShiftLeft:'Left Shift',ShiftRight:'Right Shift',Minus:'−'}[code]||code.replace(/^Key|^Digit/,''));
export function rebind(bindings,id,code){
 if(!BINDINGS.some(b=>b[0]===id)||!/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Minus|Equal|Bracket(Left|Right)|Semicolon|Quote|Comma|Period|Slash|Backslash)$/.test(code))return{error:'That key is reserved for navigation or is unsupported. Choose a letter, number, arrow or punctuation key.'};
 const conflict=BINDINGS.find(([other])=>other!==id&&bindings[other]?.includes(code));
 if(conflict)return{error:`${keyLabel(code)} is already assigned to ${conflict[1]}. Change that control first.`};
 return{bindings:{...bindings,[id]:[code]}};
}
// Old v1 preferences have no map action. Reserve M for the newly requested map
// without resetting unrelated custom controls. Only a conflicting M assignment
// moves; retain its other aliases, or select an unused default/fallback key.
export function loadBindings(storage,onMigration=()=>{}){
 const defaults=defaultBindings();
 try{
  const saved=JSON.parse(storage.getItem(BINDINGS_KEY));if(!saved||typeof saved!=='object'||Array.isArray(saved))return defaults;
  const legacy=saved.map===undefined,entries=BINDINGS.filter(([id])=>!legacy||id!=='map');
  const seen=new Set(),empty=Object.fromEntries(BINDINGS.map(([id])=>[id,[]]));
  for(const [id] of entries){
   if(!Array.isArray(saved[id])||!saved[id].length)return defaults;
   for(const code of saved[id]){if(seen.has(code)||!rebind(empty,id,code).bindings)return defaults;seen.add(code);}
  }
  const loaded=Object.fromEntries(entries.map(([id])=>[id,[...saved[id]]]));
  if(legacy){
   const changes=[];
   for(const [id,label,codes] of entries){
    if(!loaded[id].includes('KeyM'))continue;
    loaded[id]=loaded[id].filter(code=>code!=='KeyM');
    if(!loaded[id].length){
     const choices=[...codes,'KeyN','KeyT','KeyY','KeyU','KeyO','KeyJ',...Array.from({length:10},(_,n)=>`Digit${n}`),...Array.from({length:26},(_,n)=>`Key${String.fromCharCode(65+n)}`)];
     const replacement=choices.find(code=>code!=='KeyM'&&!seen.has(code));
     if(!replacement)return defaults;
     loaded[id]=[replacement];seen.add(replacement);
    }
    changes.push(`${label}: ${loaded[id].map(keyLabel).join(' / ')}`);
   }
   loaded.map=['KeyM'];
   saveBindings(storage,loaded);
   try{onMigration(`Tactical map: M. ${changes.length?changes.join('; ')+'. ':''}Other saved controls kept. You can change these in Controls.`)}catch{}
  }
  return loaded;
 }catch{return defaults;}
}
export function canonicalKey(code,bindings){if(code==='Escape')return code;const item=BINDINGS.find(([id])=>bindings[id]?.includes(code));return item?item[2][0]:null;}
export function saveBindings(storage,bindings){try{storage.setItem(BINDINGS_KEY,JSON.stringify(bindings));return true;}catch{return false;}}
