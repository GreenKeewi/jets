// Local-only alternative when Wrangler's network-interface discovery is unavailable.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:8787,inspectorPort:0,workers:[{name:'skybreak-local',modules:true,scriptPath:new URL('./dist/worker.js',import.meta.url).pathname,compatibilityDate:'2026-10-22',compatibilityFlags:['nodejs_compat'],bindings:{REGION:'enam',ALLOWED_ORIGINS:'https://greenkeewi.github.io'},durableObjects:{SKY:{className:'SkyRoom',useSQLite:true}}}]}));
console.log(String(await mf.ready));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await mf.dispose();process.exit(0);});
