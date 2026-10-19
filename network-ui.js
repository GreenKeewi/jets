// Room codes are the default. Manual, data-only LAN pairing is an advanced fallback.
export function mountNetworkUI(container, network, { onLaunch } = {}) {
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
    <ul data-net="roster" aria-label="Pilots in the room"></ul>
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
    style.textContent = '.net-panel{font:inherit}.net-panel h3{margin:0 0 .5rem}.net-panel p{line-height:1.5}.net-guide{padding-left:22px;font-size:.88rem;line-height:1.6}.net-panel label{display:block;margin:.8rem 0 .3rem;font-size:.9rem;font-weight:700}.net-panel textarea,.net-panel input{box-sizing:border-box;display:block;width:100%;margin-top:.35rem;font:14px monospace;color:#eef6ff;background:#122334;border:1px solid #71879b;border-radius:8px;padding:12px}.net-panel textarea{resize:vertical;min-height:66px;max-height:180px;font-size:12px}.net-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.net-actions button{font:inherit;padding:10px 14px;border:1px solid #71879b;border-radius:8px;background:#24445b;color:#fff;cursor:pointer}.net-panel [data-net="create-room"],.net-panel [data-net="launch"]{background:#d7f087;color:#13251c;border-color:#d7f087;font-weight:700}.net-panel :focus-visible{outline:3px solid #ffd056;outline-offset:3px}.net-panel button:disabled{opacity:.5;cursor:default}.net-panel small{display:block;line-height:1.5;opacity:.8}.net-panel ul{padding-left:20px}.net-panel li button{margin-left:10px}.net-panel details{margin-top:18px}.net-room{margin:18px 0;padding:18px;border:1px solid #76b79f;border-radius:12px;background:#132e2d}.net-room-code{display:block;letter-spacing:.12em;font-size:clamp(1.5rem,5vw,2rem);color:#d7f087;margin:8px 0}.net-panel [data-net="status"]{padding:12px;border-radius:8px;background:#142f3d;min-height:1.5em}.net-panel [hidden]{display:none!important}';
    document.head.append(style);
  }
  const el = name => container.querySelector(`[data-net="${name}"]`);
  el('build').textContent = `Room build: ${network.build || 'unknown'} · both players should show the same version`;
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
  const unsubscribe = network.subscribe(state => {
    message(`${state.role === 'offline' ? 'Solo' : state.role === 'host' ? 'Host' : state.localId ? `Pilot ${state.localId}` : 'Joining'} · ${state.diagnostic}`);
    el('roster').replaceChildren();
    if (state.role === 'host') { const row = document.createElement('li'); row.textContent = 'You · host'; el('roster').append(row); }
    if (state.role === 'guest' && state.connected) { const row = document.createElement('li'); row.textContent = 'Host · connected'; el('roster').append(row); }
    for (const peer of state.peers) {
      const row = document.createElement('li'); row.textContent = `${peer.id === state.localId ? 'You' : `Pilot ${peer.id}`} · ${peer.connected ? 'connected' : state.roomCode ? 'joining…' : peer.status}`;
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
  return () => { unsubscribe(); container.replaceChildren(); };
}
