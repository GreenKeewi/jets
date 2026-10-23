import {SERVER_ENDPOINTS,normalizeEndpoints,probeRegions,selectRegion} from './server-client.js?v=skybreak14-1023';

// Unconfigured builds expose no live-server join control and make no requests.
export function mountServerUI(container,network,{endpoints=SERVER_ENDPOINTS,canConnect=()=>true,arena=()=> 'coast',probe=probeRegions}={}) {
  if (!container) return () => {};
  let configured;
  try { configured=normalizeEndpoints(endpoints); } catch { configured=[]; }
  container.hidden=!configured.length;
  if (!configured.length) return () => {};
  container.innerHTML=`<section class="net-panel" aria-label="Shared sky"><h3>One shared sky.</h3><p>Join up to six pilots. The server runs the match; empty seats are bots.</p><label>Match<select data-server="match"><option value="versus">Versus · humans and bots</option><option value="coop">Co-op · friends against AI</option></select></label><label>Your team<select data-server="team"><option value="auto">Auto balance</option><option value="0">Alpha</option><option value="1">Bravo</option></select></label><p>Choose before joining; co-op reserves Alpha for up to three friends. Return to the menu and leave to switch teams.</p><div class="net-actions"><button type="button" data-server="join">Join shared sky</button><button type="button" data-server="leave" disabled>Leave / play solo</button></div><p data-server="status" role="status" aria-live="polite">Check availability and join. Solo and friend rooms stay available.</p><small>Eastern North America location preference, not guaranteed Canadian hosting. Network distance affects latency. This free service has a six-player capacity and daily limits; no player account is needed. Cloudflare receives connection metadata; match state is held in memory.</small></section>`;
  const el=key=>container.querySelector(`[data-server="${key}"]`);
  let busy=false,operation=0,disposed=false;
  function refresh(state=network.server.state) {
    el('join').disabled=busy||state.connected||state.connecting||!canConnect();
    el('match').disabled=el('team').disabled=busy||state.connected||state.connecting;
    el('leave').disabled=!busy&&!state.connected&&!state.connecting;
    el('join').textContent=busy?'Connecting…':state.connected?'In shared sky':'Join shared sky';
    if(state.connected) el('status').textContent=`Connected${Number.isFinite(state.latencyMs)?` · ${state.latencyMs} ms round trip`:''}. The server keeps flying while menus are open.`;
    else if(state.diagnostic) el('status').textContent=state.diagnostic==='Dedicated servers are not configured.'?'Check availability and join. Solo and friend rooms stay available.':state.diagnostic;
  }
  const unsubscribe=network.server.subscribe(refresh);
  el('join').onclick=async()=>{
    if(busy||!canConnect())return;
    const current=++operation;busy=true;refresh();el('status').textContent='Checking the shared sky…';
    try {
      const probes=await probe(configured);
      if(disposed||current!==operation)return;
      const choice=selectRegion(probes,{pool:'global',arenaId:arena()});
      const occupied=choice.rooms.find(room=>room.players>0&&room.joinable&&(room.match||'versus')===el('match').value);
      await network.connectServer(choice,{pool:'global',arenaId:occupied?.arenaId||arena(),match:el('match').value,team:el('match').value==='coop'?0:el('team').value==='auto'?'auto':Number(el('team').value)});
    } catch(error) { if(!disposed&&current===operation)el('status').textContent=`${error.message} Solo and friend rooms are still available.`; }
    finally { if(!disposed&&current===operation){busy=false;const text=el('status').textContent;refresh();if(!network.server.state.connected)el('status').textContent=text;} }
  };
  el('leave').onclick=()=>{operation++;busy=false;network.selectPeer();refresh();el('status').textContent='Disconnected. Choose Launch sortie to fly solo.';};
  refresh();
  return()=>{disposed=true;operation++;unsubscribe();};
}
