import * as THREE from './vendor/three.module.js';
import {createAircraft} from './aircraft.js?v=skybreak120-1104';
import {AIRCRAFT_DEFINITIONS} from './loadouts.js?v=skybreak120-1104';

// Native buttons mirror the canonical selects: the lobby, saved preferences and
// launch configuration all continue to use one source of truth.
export function mountVisualMenu(){
 const groups=[];
 function choices(id,items,label){
  const select=document.getElementById(id),host=document.createElement('div');host.className=`visual-choices ${id}-cards`;host.setAttribute('role','group');host.setAttribute('aria-label',label);
  select.parentElement.classList.add('visual-select');select.parentElement.after(host);
  for(const item of items){const button=document.createElement('button');button.type='button';button.className='choice-card';button.dataset.value=item.id;
   if(item.art){const art=document.createElement('span');art.className=`choice-art ${item.art}`;art.setAttribute('aria-hidden','true');art.innerHTML=item.art==='valley'?'<svg viewBox="0 0 240 90"><path d="M0 80L45 12 90 65 130 5 175 60 210 22 240 80Z"/><path class="map-route" d="M15 85Q70 45 105 72T230 52"/></svg>':'<svg viewBox="0 0 240 90"><path d="M0 25Q40 5 78 32T145 22T240 42V90H0Z"/><path class="map-route" d="M30 65Q100 28 210 64"/></svg>';button.append(art);}
   if(item.aircraft){const image=document.createElement('img');image.alt='';image.dataset.aircraftPreview=item.id;image.width=420;image.height=200;button.append(image);}
   const name=document.createElement('strong'),detail=document.createElement('span'),check=document.createElement('small');name.textContent=item.name;detail.textContent=item.description;check.className='choice-check';check.textContent='SELECT';button.append(name,detail,check);button.onclick=()=>{if(select.disabled)return;select.value=item.id;select.dispatchEvent(new Event('change',{bubbles:true}));refresh();};host.append(button);
  }
  groups.push({select,host});return host;
 }
 const aircraft=choices('aircraft-select',Object.values(AIRCRAFT_DEFINITIONS).map(a=>({id:a.id,name:a.name,description:a.id==='f16'?'Light & agile · single engine':a.id==='fa18e'?'Naval fighter · twin engines':a.id==='f14'?'Manual sweep · 20°–68°':'Blue camouflage · conventional Flanker',aircraft:true})),'Choose aircraft');
 choices('arena-select',[{id:'coast',name:'Coastal sky',description:'Open water & island airfields',art:'coast'},{id:'valley',name:'Northern valley',description:'Winding low-altitude mountain corridor',art:'valley'}],'Choose battle map');
 function refresh(){for(const {select,host} of groups){host.hidden=select.id==='arena-select'&&select.parentElement.hidden||select.id==='aircraft-select'&&document.getElementById('aircraft-config').hidden;for(const button of host.children){const selected=select.value===button.dataset.value;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));button.disabled=select.disabled;button.querySelector('.choice-check').textContent=selected?'✓ SELECTED':'SELECT';}}}
 const observer=new MutationObserver(refresh);for(const {select} of groups){observer.observe(select,{attributes:true,attributeFilter:['disabled']});observer.observe(select.parentElement,{attributes:true,attributeFilter:['hidden']});select.addEventListener('change',refresh);}
 // One temporary context renders actual game models for all three cards.
 try{
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(420,200);renderer.setPixelRatio(1);renderer.setClearColor(0x102c37,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,2.1,.1,250);camera.zoom=1.5;camera.updateProjectionMatrix();camera.position.set(39,32,49);camera.lookAt(0,0,0);scene.add(new THREE.HemisphereLight(0xe6f5ff,0x415864,2.4));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-12,25,20);scene.add(light);
  for(const image of aircraft.querySelectorAll('img')){const model=createAircraft(0,false,image.dataset.aircraftPreview);model.userData.gear.visible=false;scene.add(model);renderer.render(scene,camera);image.src=renderer.domElement.toDataURL('image/png');scene.remove(model);const geometries=new Set(),materials=new Set();model.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const mat of Array.isArray(node.material)?node.material:[node.material])if(mat)materials.add(mat);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
  renderer.dispose();
 }catch{for(const image of aircraft.querySelectorAll('img')){image.hidden=true;}}
 refresh();return refresh;
}
