// Optional pairing panel. Native controls keep all text exchange keyboard accessible.
export function mountNetworkUI(container, network) {
  if (!container) return () => {};
  container.innerHTML = `<section class="net-panel" aria-label="LAN multiplayer pairing">
    <h3>Fly together · direct LAN</h3>
    <p>One host, up to five guests. Each guest exchanges a different offer and answer with the host. Same Wi-Fi alone does not discover or guarantee a connection.</p>
    <div class="net-actions"><button type="button" data-net="host">1 · Host session</button><button type="button" data-net="offer">2 · Create guest offer</button><button type="button" data-net="leave">Leave session</button></div>
    <label>Code received from the other player<textarea data-net="incoming" rows="3" spellcheck="false" autocomplete="off" placeholder="Paste a complete JETS1 offer or answer here"></textarea></label>
    <div class="net-actions"><button type="button" data-net="join">Guest · accept offer</button><button type="button" data-net="answer">Host · accept answer</button></div>
    <label>Your code to send back<textarea data-net="outgoing" rows="3" readonly spellcheck="false" aria-describedby="net-code-help"></textarea></label>
    <div class="net-actions"><button type="button" data-net="select">Select your code</button><button type="button" data-net="copy">Copy your code</button></div>
    <small id="net-code-help">Tab to a code box. Ctrl+A / Ctrl+C copies; Ctrl+V pastes. Chromebook Search+V can open clipboard history. Share codes only with intended players: they contain local network connection details.</small>
    <p data-net="status" role="status" aria-live="polite"></p><ul data-net="roster" aria-label="Guest seats"></ul>
    <details><summary>Connection help</summary><p>No accounts, microphone, camera, backend, lobby discovery or relay server. Use the same reachable local network. Guest Wi-Fi/client isolation, school networks, local firewalls or mDNS restrictions can block direct connections. If pairing fails, check those settings with the network owner, then exchange fresh codes. Reloads and host disconnects require new pairing. The host owns mission rules and simulation.</p></details>
  </section>`;
  if (!document.querySelector('[data-jets-net-style]')) {
    const style = document.createElement('style'); style.dataset.jetsNetStyle = '';
    style.textContent = '.net-panel{font:inherit}.net-panel h3{margin:0 0 .5rem}.net-panel p{line-height:1.5}.net-panel label{display:block;margin:.8rem 0 .3rem;font-size:.9rem;font-weight:700}.net-panel textarea{box-sizing:border-box;display:block;width:100%;margin-top:.35rem;resize:vertical;min-height:66px;max-height:180px;font:12px monospace;color:#eef6ff;background:#122334;border:1px solid #71879b;border-radius:8px;padding:10px}.net-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.net-actions button{font:inherit;padding:10px 14px;border:1px solid #71879b;border-radius:8px;background:#24445b;color:#fff;cursor:pointer}.net-panel :focus-visible{outline:3px solid #ffd056;outline-offset:3px}.net-panel button:disabled{opacity:.5;cursor:wait}.net-panel small{display:block;line-height:1.5;opacity:.8}.net-panel ul{padding-left:20px}.net-panel li button{margin-left:10px}.net-panel details{margin-top:12px}';
    document.head.append(style);
  }
  const el = name => container.querySelector(`[data-net="${name}"]`);
  let busy = false;
  function message(text) { el('status').textContent = text; }
  async function run(task) {
    if (busy) return; busy = true;
    container.querySelectorAll('button').forEach(b => b.disabled = true);
    try { await task(); } catch (error) { message(error.message); }
    finally { busy = false; container.querySelectorAll('button').forEach(b => b.disabled = false); }
  }
  function output(code) { el('outgoing').value = code; el('outgoing').focus(); el('outgoing').select(); }
  el('host').onclick = () => run(() => { network.host(); el('outgoing').value = ''; });
  el('offer').onclick = () => run(async () => output(await network.createOffer()));
  el('join').onclick = () => run(async () => output(await network.acceptOffer(el('incoming').value)));
  el('answer').onclick = () => run(async () => { await network.acceptAnswer(el('incoming').value); el('incoming').value = ''; });
  el('leave').onclick = () => { network.disconnect(); el('outgoing').value = ''; el('incoming').value = ''; };
  el('select').onclick = () => { el('outgoing').focus(); el('outgoing').select(); };
  el('copy').onclick = () => run(async () => {
    if (!el('outgoing').value) { message('Create an offer or accept an offer first.'); return; }
    try { await navigator.clipboard.writeText(el('outgoing').value); message('Code copied. Give it to the intended player.'); }
    catch { el('outgoing').focus(); el('outgoing').select(); message('Code selected. Press Ctrl+C to copy it.'); }
  });
  const unsubscribe = network.subscribe(state => {
    message(`${state.role === 'offline' ? 'Solo' : state.role === 'host' ? 'Host' : `Guest ${state.localId || '(pairing)'}`} · ${state.diagnostic}`);
    el('roster').replaceChildren();
    for (const peer of state.peers) {
      const row = document.createElement('li'); row.textContent = `${peer.id} · ${peer.status}`;
      if (state.role === 'host') { const button = document.createElement('button'); button.type = 'button'; button.textContent = `Remove ${peer.id}`; button.onclick = () => network.removePeer(peer.id); row.append(button); }
      el('roster').append(row);
    }
  });
  return () => { unsubscribe(); container.replaceChildren(); };
}
