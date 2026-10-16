// Optional pairing panel. Native controls keep all text exchange keyboard accessible.
export function mountNetworkUI(container, network) {
  if (!container) return () => {};
  const protocol=network.protocol||'JETS2';
  container.innerHTML = `<section class="net-panel" aria-label="LAN multiplayer pairing">
    <h3>Fly together · direct LAN</h3>
    <p>One host, up to five guests. Each guest exchanges a different offer and answer with the host. Same Wi-Fi alone does not discover or guarantee a connection.</p>
    <ol class="net-guide"><li><b>Host:</b> start a session and create an offer for one guest.</li><li><b>Guest:</b> paste that offer, make an answer, and send the answer back.</li><li><b>Host:</b> paste the answer and connect the guest. Repeat for your next guest.</li></ol>
    <div class="net-actions"><button type="button" data-net="host">1 · Host session</button><button type="button" data-net="offer">2 · Create guest offer</button><button type="button" data-net="leave">Leave session</button></div>
    <label>Code received from the other player<textarea data-net="incoming" rows="3" spellcheck="false" autocomplete="off" placeholder="Paste a complete ${protocol} offer or answer here"></textarea></label>
    <div class="net-actions"><button type="button" data-net="join">Guest · make answer</button><button type="button" data-net="answer">Host · connect guest</button></div>
    <label><span data-net="outgoing-label">Your code to share</span><textarea data-net="outgoing" rows="3" readonly spellcheck="false" aria-describedby="net-code-help"></textarea></label>
    <div class="net-actions"><button type="button" data-net="select">Select your code</button><button type="button" data-net="copy">Copy your code</button></div>
    <small id="net-code-help">Tab to a code box. Ctrl+A / Ctrl+C copies; Ctrl+V pastes. Chromebook Search+V can open clipboard history. Share codes only with intended players: they contain local network connection details.</small>
    <p data-net="status" role="status" aria-live="polite"></p><ul data-net="roster" aria-label="Guest seats"></ul>
    <details><summary>Connection help</summary><p>No accounts, microphone, camera, backend, lobby discovery or relay server. Use the same reachable local network. Guest Wi-Fi/client isolation, school networks, local firewalls or mDNS restrictions can block direct connections. If pairing fails, check those settings with the network owner, then exchange fresh codes. Reloads and host disconnects require new pairing. The host owns mission rules and simulation. Hiding the host game tab pauses the sortie for everyone until the host returns and resumes.</p></details>
  </section>`;
  if (!document.querySelector('[data-jets-net-style]')) {
    const style = document.createElement('style'); style.dataset.jetsNetStyle = '';
    style.textContent = '.net-panel{font:inherit}.net-panel h3{margin:0 0 .5rem}.net-panel p{line-height:1.5}.net-guide{padding-left:22px;font-size:.88rem;line-height:1.6}.net-panel label{display:block;margin:.8rem 0 .3rem;font-size:.9rem;font-weight:700}.net-panel textarea{box-sizing:border-box;display:block;width:100%;margin-top:.35rem;resize:vertical;min-height:66px;max-height:180px;font:12px monospace;color:#eef6ff;background:#122334;border:1px solid #71879b;border-radius:8px;padding:10px}.net-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.net-actions button{font:inherit;padding:10px 14px;border:1px solid #71879b;border-radius:8px;background:#24445b;color:#fff;cursor:pointer}.net-panel :focus-visible{outline:3px solid #ffd056;outline-offset:3px}.net-panel button:disabled{opacity:.5;cursor:default}.net-panel small{display:block;line-height:1.5;opacity:.8}.net-panel ul{padding-left:20px}.net-panel li button{margin-left:10px}.net-panel details{margin-top:12px}';
    document.head.append(style);
  }
  const el = name => container.querySelector(`[data-net="${name}"]`);
  let busy = false,activeOperation=0;
  function message(text) { el('status').textContent = text; }
  function refresh(){
    const state=network.state;
    el('host').disabled=busy||state.role!=='offline';
    el('offer').disabled=busy||state.role==='guest';
    el('join').disabled=busy||(state.role==='host'&&state.peers.length>0)||(state.role==='guest'&&state.connected);
    el('answer').disabled=busy||state.role!=='host';
    el('leave').disabled=state.role==='offline'&&!busy;
    for(const name of ['select','copy'])el(name).disabled=busy||!el('outgoing').value;
  }
  function clearOutput(){el('outgoing').value='';el('outgoing-label').textContent='Your code to share';refresh();}
  async function run(task,{sourceError=false,newCode=false}={}) {
    if (busy) return; busy = true;const operation=++activeOperation;
    if(newCode)clearOutput();refresh();
    try { await task(operation); }
    catch (error) { if(operation===activeOperation){message(error.message);if(sourceError){el('incoming').focus();el('incoming').select();}} }
    finally { if(operation===activeOperation){busy = false;refresh();} }
  }
  function output(code,operation,kind) {if(operation!==activeOperation)return;el('outgoing').value = code;el('outgoing-label').textContent=kind==='offer'?'Your offer. Send this to one guest.':'Your answer. Send this back to the host.';el('outgoing').focus();el('outgoing').select(); }
  el('host').onclick = () => run(() => { network.host(); el('outgoing').value = ''; });
  el('offer').onclick = () => run(async operation => output(await network.createOffer(),operation,'offer'),{newCode:true});
  el('join').onclick = () => run(async operation => output(await network.acceptOffer(el('incoming').value),operation,'answer'),{sourceError:true,newCode:true});
  el('answer').onclick = () => run(async () => { await network.acceptAnswer(el('incoming').value); el('incoming').value = ''; },{sourceError:true});
  el('leave').onclick = () => {activeOperation++;busy=false;network.disconnect();clearOutput();el('incoming').value='';};
  el('select').onclick = () => { el('outgoing').focus(); el('outgoing').select(); };
  el('copy').onclick = () => run(async operation => {
    if (!el('outgoing').value) { message('Create an offer or accept an offer first.'); return; }
    try { await navigator.clipboard.writeText(el('outgoing').value);if(operation===activeOperation)message('Code copied. Give it to the intended player.'); }
    catch {if(operation===activeOperation){el('outgoing').focus();el('outgoing').select();message('Code selected. Press Ctrl+C to copy it.');}}
  });
  const unsubscribe = network.subscribe(state => {
    message(`${state.role === 'offline' ? 'Solo' : state.role === 'host' ? 'Host' : `Guest ${state.localId || '(pairing)'}`} · ${state.diagnostic}`);
    el('roster').replaceChildren();
    for (const peer of state.peers) {
      const row = document.createElement('li'); row.textContent = `${peer.id} · ${peer.status}`;
      if (state.role === 'host') { const button = document.createElement('button'); button.type = 'button'; button.textContent = `Remove ${peer.id}`; button.onclick = () => network.removePeer(peer.id); row.append(button); }
      el('roster').append(row);
    }
    refresh();
  });
  return () => { unsubscribe(); container.replaceChildren(); };
}
