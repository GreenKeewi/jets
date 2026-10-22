import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountVersionLabel} from '../version-ui.js';
const metadata=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
test('home release label uses the package version and remains noninteractive',async()=>{
 const label={hidden:true};await mountVersionLabel(label,async(path,options)=>{assert.equal(path,'./package.json');assert.equal(options.cache,'no-cache');return{ok:true,json:async()=>metadata}});
 assert.equal(label.textContent,`v${metadata.version}`);assert.equal(label.hidden,false);assert.match(label.title,/Skybreak Jets version/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/<span id="game-version" class="menu-version" aria-label="Game version" hidden><\/span>/);assert.match(html,/src="version-ui.js\?v=/);
});
test('failed or invalid release metadata cannot block the game or show false versions',async()=>{
 for(const fetcher of [async()=>{throw Error('offline')},async()=>({ok:false}),async()=>({ok:true,json:async()=>({version:'<script>'})})]){const label={hidden:true};await mountVersionLabel(label,fetcher);assert.equal(label.hidden,true);assert.equal(label.textContent,undefined)}await mountVersionLabel(null,()=>{throw Error('must not run')});
});
