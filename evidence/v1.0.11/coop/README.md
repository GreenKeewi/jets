# Co-op team verification

Friend-room lobby team selection is authoritative: the host can assign any connected pilot; guests can request only their own team. Each team permits three humans. Teams are frozen from launch until returning to the lobby; reconnecting a seat during the sortie preserves its assigned team. A full requested team never silently moves a player to the enemy side. Empty aircraft seats remain host-owned AI. Two friends on Alpha produce a real friendly squad against AI jets, with the existing finite elimination victory. Guns/missile locks skip friendly pilots; physical aircraft collisions remain possible.

The peer protocol is JETS8; old room/manual pairing codes must be regenerated. Host snapshots own pilot teams, AI, ammunition and result state; guests do not run a second AI simulation. Explicit roster configuration also preserves free flight and strike team membership.

Dedicated joins validate `team` (`auto`, 0 or 1) and `match` (`versus` or `coop`). Co-op reserves Alpha for at most three humans and keeps three enemy AI; its health capacity is three. Versus retains the existing six-human balanced default and optionally accepts an explicit team. Changing dedicated teams requires leaving and joining again; there is no in-flight team mutation packet. Co-op and versus queues cannot merge. Last-client departure removes the in-memory room. No accounts, credentials or persistence were added.

## Evidence

- Full isolated-branch suite: 227 passing tests (base v1.0.9 plus four co-op tests). Final combined release reruns are reported by the coordinator.
- Backend: 14 passing tests, including two real local WebSocket clients in the same co-op room, replicated AI identities and controlled synchronized victory; validation, capacity and disconnect/rejoin also covered.
- `tests/coop-browser.cjs`: two actual Chromium game documents, real lobby controls selecting Alpha for both pilots, launch, guest native throttle input applied by host and replicated back, team locks, controlled terminal fixture producing matching winning team and success UI, and switching teams after returning to lobby. No full combat sortie is claimed. Screenshots inspected; report records zero page errors.
- Native browser offer creation was attempted and returned `NoLocalCandidatesError`: “This browser did not provide any LAN connection candidates…” Managed Chromium policy `/etc/chromium/policies/managed/misc.json` sets `WebRtcIPHandling` to `disable_non_proxied_udp`. Policy was not changed or bypassed. The rendered UI integration therefore uses the deterministic RTC data-channel fixture; this is NOT a native WebRTC, Wi-Fi, internet or cross-network connection test.

Public authoritative multiplayer remains unavailable because `SERVER_ENDPOINTS=[]` and no Cloudflare deployment access is configured. The peer feature is reachable in the existing friend-room UI, subject to its unchanged PeerJS/STUN/network limitations. No live online multiplayer success is claimed.
