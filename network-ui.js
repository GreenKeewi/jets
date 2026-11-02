import {lobbyMatch} from './lobby-match.js?v=skybreak112-1102';

// Room codes are the default. Manual, data-only LAN pairing is an advanced fallback.
export function mountNetworkUI(container, network, { onLaunch, sortieSettings } = {}) {
  if (!container) return () => {};
  const protocol = network.protocol || 'JETS5';
  container.innerHTML = `<section class="net-panel" aria-label="Play with friends">
    <h3>Your friends. One room.</h3>
    <small data-net="build"></small>
    <p>Create a room and share one link. Your friends join; you launch the sortie.</p>
    <div class="net-actions"><button type="button" data-net="create-room">Create room</button><button type="button" data-net="leave">Leave / play solo</button></div>
    <div class="net-room" data-net="room-card" hidden>
      <span data-net="room-heading">Room code</span><strong class="net-room-code" data-net="room-code"></strong>
      <label>Invite link<input data-net="invite" readonly aria-label="Room invite link"></label>
      <div class="net-actions"><button type="button" data-net="copy-link">Copy invite link</button><button type="button" data-net="copy-room">Copy room code</button></div>
      <small>Anyone with this invite can join. Share it only with your friends. Keep the host’s tab open.</small>
    </div>
    <form data-net="room-form">
      <label>Have an invite?<input data-net="room-input" type="text" maxlength="500" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Room code or invite link"></label>
      <div class="net-actions"><button type="submit" data-net="join-room">Join room</button></div>
    </form>
    <p data-net="status" role="status" aria-live="polite"></p>
    <fieldset data-net="match-options" hidden><legend>Match &amp; teams</legend>
      <p data-net="settings-owner">The host configures the sortie. Every pilot can choose their own team before launch.</p>
      <div data-net="sortie-settings"></div>
      <div class="net-team-settings"><label>Enemy AI aircraft<select data-net="enemy-count" aria-describedby="net-match-help"><option value="1">1 aircraft</option><option value="2">2 aircraft</option><option value="3">3 aircraft</option><option value="4" selected>4 aircraft</option></select></label></div>
      <p id="net-match-help" data-net="match-help">Choose the same team to fight together against AI. Allied aircraft includes your human pilots; vacant allied seats are AI. Up to three human pilots per team.</p>
      <ul data-net="roster" aria-label="Pilots and team assignments"></ul>
      <fieldset data-net="respawn-options"><legend>Enemy AI reinforcements</legend><label class="net-check"><input type="checkbox" data-net="respawn-enabled"> Enable enemy AI respawns</label><label>Return after <select data-net="respawn-delay"><option value="15">15 seconds</option><option value="30" selected>30 seconds</option><option value="60">60 seconds</option></select></label><p data-net="respawn-help">Same-team co-op dogfights. Enemy AI return at their airport. Off keeps elimination victory; on runs until your squad is lost or the 8-minute sortie ends.</p></fieldset>
      <p class="net-match-summary" data-net="match-summary" role="status" aria-live="polite"></p>
    </fieldset>
    <div class="net-actions"><button type="button" data-net="launch" hidden>Launch together</button></div>
    <small>Online rooms use free PeerJS connection matching and Cloudflare STUN. They receive connection metadata; gameplay stays peer-to-peer. No account, camera or microphone needed. Some school/work networks and strict routers need a relay, which is not configured.</small>
    <details data-net="manual"><summary>Advanced · manual LAN pairing</summary>
      <p>Local-network fallback without the room service. Each guest needs a separate offer and answer. Same Wi-Fi does not guarantee a connection.</p>
      <ol class="net-guide"><li>Host creates an offer and sends it to one guest.</li><li>Guest pastes the offer and sends their answer back.</li><li>Host pastes the answer and connects the guest.</li></ol>
      <div class="net-actions"><button type="button" data-net="host">Host LAN session</button><button type="button" data-net="offer">Create guest offer</button></div>
      <label>Code from the other player<textarea data-net="incoming" rows="3" spellcheck="false" autocomplete="off" placeholder="Paste a complete ${protocol} offer or answer"></textarea></label>
      <div class="net-actions"><button type="button" data-net="join">Guest · make answer</button><button type="button" data-net="answer">Host · connect guest</button></div>
      <label><span data-net="outgoing-label">Your code to share</span><textarea data-net="outgoing" rows="3" readonly spellcheck="false"></textarea></label>
      <div class="net-actions"><button type="button" data-net="select">Select code</button><button type="button" data-net="copy">Copy code</button></div>
      <small>Ctrl+A / Ctrl+C copies; Ctrl+V pastes. Share these codes only with intended players: they contain local connection details. Reload both players before exchanging fresh codes.</small>
    </details>
    <details><summary>Connection help</summary><p>A room code lasts while its host keeps the page open. After a reload, share the new invite. If a room is not found, check the code and whether the host is still online. If a room is found but cannot connect, a firewall, isolated Wi-Fi, browser policy or strict NAT may be blocking direct WebRTC. Try a reachable home network or another connection permitted by the network owner. This version has no TURN relay to cross those restrictions. Do not disable browser security or school/work protections. Hiding the host’s game tab pauses the sortie until the host returns and resumes.</p></details>
  </section>`;
  if (!document.querySelector('[data-jets-net-style]')) {
    const style = document.createElement('style'); style.dataset.jetsNetStyle = '';
    style.textContent = '.net-panel{font:inherit}.net-panel h3{margin:0 0 .5rem}.net-panel p{line-height:1.5}.net-guide{padding-left:22px;font-size:.88rem;line-height:1.6}.net-panel label{display:block;margin:.8rem 0 .3rem;font-size:.9rem;font-weight:700}.net-panel textarea,.net-panel input{box-sizing:border-box;display:block;width:100%;margin-top:.35rem;font:14px monospace;color:#eef6ff;background:#122334;border:1px solid #71879b;border-radius:8px;padding:12px}.net-panel textarea{resize:vertical;min-height:66px;max-height:180px;font-size:12px}.net-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.net-actions button{font:inherit;padding:10px 14px;border:1px solid #71879b;border-radius:8px;background:#24445b;color:#fff;cursor:pointer}.net-panel [data-net="create-room"],.net-panel [data-net="launch"]{background:#d7f087;color:#13251c;border-color:#d7f087;font-weight:700}.net-panel :focus-visible{outline:3px solid #ffd056;outline-offset:3px}.net-panel button:disabled{opacity:.5;cursor:default}.net-panel small{display:block;line-height:1.5;opacity:.8}.net-panel ul{padding-left:20px}.net-panel li select{margin:8px;padding:8px;background:#122334;color:#eef6ff;border:1px solid #71879b;border-radius:5px}.net-panel li button{margin-left:10px}.net-panel details{margin-top:18px}.net-room{margin:18px 0;padding:18px;border:1px solid #76b79f;border-radius:12px;background:#132e2d}.net-room-code{display:block;letter-spacing:.12em;font-size:clamp(1.5rem,5vw,2rem);color:#d7f087;margin:8px 0}.net-panel [data-net="status"]{padding:12px;border-radius:8px;background:#142f3d;min-height:1.5em}.net-panel [data-net=respawn-options]{border:1px solid #719087;border-radius:8px;margin:15px 0;padding:12px}.net-panel [data-net=respawn-options] input{display:inline;width:auto;margin-right:8px}.net-panel [data-net=respawn-options] select{padding:8px;background:#122334;color:white;border:1px solid #71879b}.net-panel [data-net=respawn-options] p{font-size:12px}.net-panel [data-net=match-options]{border:1px solid #76b79f88;border-radius:10px;padding:18px;margin:18px 0;background:#0d253080}.net-panel [data-net=match-options]>legend{padding:0 8px;color:#d7f087;font-weight:700}.net-panel [data-net=match-options] p{font-size:12px;margin:10px 0}.net-panel .net-sortie-settings{margin:14px 0;padding:0;border:0}.net-panel .net-sortie-settings>summary{display:none}.net-panel .mission-config{margin:0;max-width:none;gap:12px 20px}.net-panel .mission-config label{font-size:11px;font-weight:600}.net-panel .mission-config p{flex-basis:100%;max-width:none;margin-left:0}.net-panel .net-team-settings select{display:block;margin-top:7px;background:#183b47;color:#f7f4e9;border:1px solid #7b9a9580;border-radius:7px;padding:9px 28px 9px 11px;font-size:12px}.net-panel .net-match-summary{border-top:1px solid #76b79f55;padding-top:14px;color:#d7f087}.net-panel .net-check{display:flex;align-items:center;gap:8px}.net-panel .net-check input{margin:0}.net-panel select:disabled{opacity:.6;cursor:default}.net-panel [hidden]{display:none!important}';
    style.textContent += '.net-panel .mission-config label{margin:0;flex:1 1 125px;min-width:0}.net-panel .mission-config select{width:100%;min-width:0;max-width:100%}.net-panel [data-net=roster]{padding:0;list-style:none;display:grid;gap:10px;margin:18px 0}.net-panel [data-net=roster] li{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:13px}.net-panel li select{margin:0}.net-panel li button{font:inherit;padding:7px 10px;border:1px solid #71879b;border-radius:5px;background:#24445b;color:#fff;margin:0}';
    document.head.append(style);
  }
  const el = name => container.querySelector(`[data-net="${name}"]`);
  // Reuse the menu's actual controls so mission, fuel and team settings stay in
  // one place. A stable marker restores their original position after leaving.
  const settingsMarker=sortieSettings?.parentNode?document.createComment('sortie settings home'):null;
  if(settingsMarker)sortieSettings.before(settingsMarker);
  const originalOpen=sortieSettings?.open;
  const alliedControl=sortieSettings?.querySelector('#team-size');
  const alliedLabel=sortieSettings?.querySelector('#squad-label')?.firstChild;
  const originalLabel=alliedLabel?.textContent;
  const originalOptions=alliedControl?[...alliedControl.options].map(option=>option.textContent):[];
  const enemyLabel=el('enemy-count').parentElement,enemySlot=container.querySelector('.net-team-settings');
  function restoreSettings(){
    enemySlot.append(enemyLabel);
    if(settingsMarker?.parentNode){settingsMarker.after(sortieSettings);sortieSettings.open=originalOpen;sortieSettings.classList.remove('net-sortie-settings');}
    if(alliedLabel)alliedLabel.textContent=originalLabel;
    alliedControl&&[...alliedControl.options].forEach((option,i)=>option.textContent=originalOptions[i]);
  }
  function syncSettings(state){
    const active=state.role!=='offline';
    el('match-options').hidden=!active;
    if(!active){restoreSettings();return;}
    if(sortieSettings){el('sortie-settings').append(sortieSettings);sortieSettings.open=true;sortieSettings.classList.add('net-sortie-settings');}
    const selectedMode=sortieSettings?.ownerDocument.querySelector('.mode-card.selected')?.dataset.mode||'dogfight';
    const missionId=sortieSettings?.querySelector('#combat-mission')?.value||'dogfight';
    const match=lobbyMatch(state,selectedMode,missionId);
    if(alliedControl)alliedControl.parentElement.after(enemyLabel);
    if(alliedLabel)alliedLabel.textContent=match.coop?'Allied aircraft':'Aircraft per team';
    if(alliedControl){
      const minimum=Math.max(1,...match.counts);
      for(const option of alliedControl.options){option.textContent=`${option.value} aircraft`;option.disabled=Number(option.value)<minimum;}
      alliedControl.value=String(match.teamSize);alliedControl.disabled=!match.editable;
    }
    el('enemy-count').value=String(match.enemyTeamSize);
    el('enemy-count').disabled=!match.editable||!match.coop;
    el('settings-owner').textContent=state.teamsLocked?'Sortie settings and teams are locked. Return to the lobby to change them.':state.role==='guest'?'The host configures the sortie. Choose your team below; the host launches everyone together.':'Configure the sortie, assign each pilot, then launch together.';
    const respawn=state.enemyRespawnSeconds||0;
    el('respawn-enabled').checked=respawn>0;if(respawn)el('respawn-delay').value=String(respawn);
    el('respawn-enabled').disabled=!match.editable||!match.coop;
    el('respawn-delay').disabled=!match.editable||!match.coop||!respawn;
    if(match.coop){
      const allies=match.counts[match.coopTeam],bots=match.teamSize-allies;
      el('match-summary').textContent=`${match.coopTeam===0?'Alpha':'Bravo'}: ${allies} ${allies===1?'pilot':'pilots'}${bots?` + ${bots} allied AI`:''} · ${match.enemyTeamSize} enemy AI · ${respawn?`enemy AI return every ${respawn} seconds`:'elimination victory'}`;
    }else el('match-summary').textContent=selectedMode==='dogfight'?'Pilots on opposing teams: equal squad sizes. Put every pilot on the same team to configure enemy AI and reinforcements.':'Mission teams use the selected aircraft count. Enemy AI reinforcements are available in same-team dogfights.';
  }
  const matchSettingsChanged=event=>{
    if(network.state.role==='offline')return;
    if(event.target===alliedControl)network.setMatchSettings?.({teamSize:Number(alliedControl.value)});
    refresh();
  };
  sortieSettings?.addEventListener('change',matchSettingsChanged);
  el('build').textContent = `Game build: ${network.build || 'unknown'} · room compatibility: ${network.compatibility || network.build || 'unknown'}`;
  let busy = false, activeOperation = 0;
  function message(text) { el('status').textContent = text; }
  function refresh() {
    const state = network.state, count = state.peers.filter(p => p.connected).length;
    const joining = state.role === 'guest' && (state.connected || state.connecting || state.roomOpening);
    el('create-room').disabled = busy || state.roomOpening || state.role === 'guest' || !!state.roomCode && state.roomOnline;
    el('create-room').textContent = state.roomCode && state.role === 'host' ? state.roomOnline ? 'Room created' : 'Reconnect room' : 'Create room';
    el('join-room').disabled = busy || joining || state.role === 'host';
    el('room-input').disabled = busy || joining || state.role === 'host';
    el('join-room').textContent = state.role === 'guest' && !joining ? 'Try joining again' : 'Join room';
    el('leave').disabled = state.role === 'offline' && !busy;
    el('host').disabled = busy || state.role !== 'offline';
    el('offer').disabled = busy || state.role === 'guest';
    el('join').disabled = busy || state.role === 'host' && state.peers.length > 0 || joining;
    el('answer').disabled = busy || state.role !== 'host';
    for (const name of ['select', 'copy']) el(name).disabled = busy || !el('outgoing').value;
    const share = state.role === 'host' && state.roomCode;
    el('room-card').hidden = !share;
    if (share) {
      el('room-code').textContent = `${state.roomCode.slice(0, 4)} ${state.roomCode.slice(4)}`;
      el('invite').value = network.inviteLink();
      el('room-heading').textContent = state.roomOnline ? 'Room code' : 'Room service offline';
    }
    for (const name of ['copy-link', 'copy-room']) el(name).disabled = !share || !state.roomOnline;
    el('launch').hidden = !onLaunch || state.role !== 'host' || count === 0;
    el('launch').textContent = `Launch with ${count + 1} pilots`;
    syncSettings(state);
  }
  function clearOutput() { el('outgoing').value = ''; el('outgoing-label').textContent = 'Your code to share'; refresh(); }
  async function run(task, { sourceError = false, newCode = false } = {}) {
    if (busy) return;
    busy = true; const operation = ++activeOperation;
    if (newCode) clearOutput(); refresh();
    try { await task(operation); }
    catch (error) { if (operation === activeOperation) { message(error.message); if (sourceError) { el('incoming').focus(); el('incoming').select(); } } }
    finally { if (operation === activeOperation) { busy = false; refresh(); } }
  }
  async function copy(text, fallback, success) {
    try { await navigator.clipboard.writeText(text); message(success); }
    catch { fallback.focus(); fallback.select(); message('Selected. Press Ctrl+C to copy.'); }
  }
  function output(code, operation, kind) {
    if (operation !== activeOperation) return;
    el('outgoing').value = code;
    el('outgoing-label').textContent = kind === 'offer' ? 'Send this offer to one guest.' : 'Send this answer back to the host.';
    el('outgoing').focus(); el('outgoing').select();
  }
  el('create-room').onclick = () => run(async () => { await network.createRoom(); clearOutput(); });
  el('room-form').onsubmit = event => { event.preventDefault(); run(() => network.joinRoom(el('room-input').value)); };
  el('copy-link').onclick = () => copy(network.inviteLink(), el('invite'), 'Invite copied. Send it to your friends; opening it joins your room.');
  el('copy-room').onclick = async () => {
    const code = network.state.roomCode;
    try { await navigator.clipboard.writeText(code); message('Room code copied. Friends paste it into Join room.'); }
    catch { el('invite').value = code; el('invite').focus(); el('invite').select(); message('Room code selected. Press Ctrl+C to copy.'); }
  };
  el('launch').onclick = () => onLaunch?.();
  el('enemy-count').onchange=()=>{network.setMatchSettings?.({enemyTeamSize:Number(el('enemy-count').value)});refresh();};
  el('respawn-enabled').onchange=()=>{network.setEnemyRespawn(el('respawn-enabled').checked?Number(el('respawn-delay').value):0);refresh()};el('respawn-delay').onchange=()=>{network.setEnemyRespawn(Number(el('respawn-delay').value));refresh()};
  el('host').onclick = () => run(() => { network.host(); clearOutput(); });
  el('offer').onclick = () => run(async operation => output(await network.createOffer(), operation, 'offer'), { newCode: true });
  el('join').onclick = () => run(async operation => output(await network.acceptOffer(el('incoming').value), operation, 'answer'), { sourceError: true, newCode: true });
  el('answer').onclick = () => run(async () => { await network.acceptAnswer(el('incoming').value); el('incoming').value = ''; }, { sourceError: true });
  el('leave').onclick = () => {
    activeOperation++; busy = false; network.disconnect(); clearOutput(); el('incoming').value = '';
    if (new URLSearchParams(location.hash.slice(1)).has('room')) history.replaceState(null, '', location.pathname + location.search);
  };
  el('select').onclick = () => { el('outgoing').focus(); el('outgoing').select(); };
  el('copy').onclick = () => run(() => copy(el('outgoing').value, el('outgoing'), 'Code copied. Give it to the intended player.'));
  function teamChoice(row,id,state){const select=document.createElement('select');select.setAttribute('aria-label',`Team for ${id}`);select.dataset.teamPilot=id;for(const [value,label] of [[0,'Alpha'],[1,'Bravo']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}select.value=String(state.teams?.[id]??0);select.disabled=state.teamsLocked||!(state.role==='host'||id===state.localId);select.onchange=()=>{if(!network.setTeam(id,Number(select.value))){select.value=String(network.state.teams?.[id]??0);message('Team is full or the sortie has started. Return to the lobby to switch.');}};row.append(select);}
  const unsubscribe = network.subscribe(state => {
    message(`${state.role === 'offline' ? 'Solo' : state.role === 'host' ? 'Host' : state.localId ? `Pilot ${state.localId}` : 'Joining'} · ${state.diagnostic}`);
    el('roster').replaceChildren();
    if (state.role === 'host') { const row = document.createElement('li'); row.textContent = 'You · host';teamChoice(row,'host',state); el('roster').append(row); }
    if (state.role === 'guest' && state.connected) { const row = document.createElement('li'); row.textContent = 'Host · connected';teamChoice(row,'host',state); el('roster').append(row); }
    for (const peer of state.peers) {
      const row = document.createElement('li'); row.textContent = `${peer.id === state.localId ? 'You' : `Pilot ${peer.id}`} · ${peer.connected ? 'connected' : state.roomCode ? 'joining…' : peer.status}`;
      if(peer.connected)teamChoice(row,peer.id,state);
      if (state.role === 'host') { const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Remove'; button.setAttribute('aria-label', `Remove pilot ${peer.id}`); button.onclick = () => network.removePeer(peer.id); row.append(button); }
      el('roster').append(row);
    }
    refresh();
  });
  const invite = new URLSearchParams(globalThis.location?.hash?.slice(1)).get('room');
  if (invite) {
    el('room-input').value = invite;
    // Let application initialization finish before a host can start the guest's sortie.
    queueMicrotask(() => { container.closest('dialog')?.showModal(); run(() => network.joinRoom(invite)); });
  }
  return () => { unsubscribe();sortieSettings?.removeEventListener('change',matchSettingsChanged);restoreSettings();settingsMarker?.remove();container.replaceChildren(); };
}
