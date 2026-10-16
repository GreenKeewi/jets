# Skybreak

An original static 3D browser jet game, built for approachable keyboard flying. No build step, accounts, microphone, camera, server simulation, or external runtime CDN. Three.js is vendored with its MIT license.

## Play

Serve this directory with a static server, for example `python3 -m http.server 8201`, then open the page in a WebGL-capable browser. Audio starts on launch and can be muted with M. All menus, pairing code fields, mission settings, pause screens, and navigation use native keyboard-accessible controls.

- **Dogfight:** 1v1, 2v2, or 3v3. Empty seats are bots. Build a heat or radar lock, use the appropriate countermeasure, and protect the squadron. Arcade weapons receive a small top-up every 22 seconds so a sortie does not become unwinnable after missed shots.
- **Strike & escape:** fly a broad-wing bomber against a fictional coastal depot and reach the escape area, or intercept the bomber as a defender. The projected ground ring shows the bomb impact estimate; a mint ring means the release window is valid.
- **Free flight:** start on runway 36, take off, pass five route gates, return through the approach, land and stop. G enables optional route and landing assistance. Manual flight keys override it while held. Off-runway/unsafe touchdowns recover into a go-around. An early practice landing does not award route completion. Multiplayer free flight is a shared, host-led route; wingmates can fly formation.

## Keyboard

W/S or Up/Down climb/descend; A/D or Left/Right bank and turn; Q/E fine rudder; Shift increases power; Z or minus reduces power; X air/wheel brakes. Space heat seeker; R radar missile; F flares; C chaff; B bomb; V chase/cockpit; G free-flight route assist; H controls; Escape or P pause; M mute. Release flight controls to level out. Tab, Enter and native select arrow keys navigate menus. Pairing supports Ctrl+A/C/V in its text fields.

## Direct manual multiplayer

One host and up to five guests connect using **data-only WebRTC** and `iceServers: []`. Each guest needs a separate complete offer/answer exchange. ICE gathering must finish before codes export. There is no automatic Wi-Fi lobby discovery and no STUN/TURN/signalling service. Same Wi-Fi alone does not guarantee a direct connection: client isolation, restricted school/guest networks, firewalls, mDNS and managed browser policy can prevent it. Exchange fresh codes after reloads or host disconnects.

The host runs mission rules and bot physics. Identity comes from the connection, not client input. Ordered reliable control/actions and unordered zero-retransmit axes/snapshots use sequence validation, host-clock action cooldowns, rate limits, stale-input neutralization and buffer pressure handling. Guests interpolate snapshots. Disconnected seats become bots; reconnecting seats regain control. Fresh guests claim an available living bot seat or clearly spectate until the next sortie when no seat is available. No media permissions are requested.

## Verification

`npm test` runs deterministic simulation and input/protocol tests. Browser evidence and detailed multiplayer reports are produced separately by the test runner. Tests include six browser contexts in one cloud machine; those tests do **not** establish physical separate-device Wi-Fi compatibility.

The original generated menu illustration is labeled as illustration. Gameplay is rendered live in 3D. Static batching keeps the scene to approximately 80–150 draw calls depending on mission and effects. Sound and assist rules are intentionally arcade-oriented rather than a real aircraft certification model.
