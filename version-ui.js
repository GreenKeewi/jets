// Package metadata is the canonical release version; this UI never blocks play.
export async function mountVersionLabel(label,fetchVersion=fetch){
 if(!label)return;
 try{
  const response=await fetchVersion('./package.json',{cache:'no-cache'});
  if(!response.ok)throw new Error('Version metadata unavailable');
  const {version}=await response.json();
  if(typeof version!=='string'||!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version))throw new Error('Invalid release version');
  label.textContent=`v${version}`;label.title=`Skybreak Jets version ${version}`;label.hidden=false;
 }catch{label.hidden=true;}
}
if(typeof document!=='undefined')mountVersionLabel(document.getElementById('game-version'));
