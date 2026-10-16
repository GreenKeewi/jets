# Skybreak

An original static 3D browser jet game, built for approachable keyboard flying. No build step, accounts, microphone, camera, server simulation, or external runtime CDN. Three.js is vendored with its MIT license.

## Play

Serve this directory with a static server, for example `python3 -m http.server 8201`, then open the page in a WebGL-capable browser. Audio starts on launch and can be muted with M. All menus, pairing code fields, mission settings, pause screens, and navigation use native keyboard-accessible controls.

- **Dogfight:** 1v1, 2v2, or 3v3. Empty seats are bots. Build a heat or radar lock, use the appropriate countermeasure, and protect the squadron. Standard bots keep the first sortie approachable; optional Ace bots turn, counter and fire more effectively using the same aircraft health and ammunition. Arcade weapons receive a small top-up every 22 seconds so a sortie does not become unwinnable after missed shots.
- **Strike & escape:** fly a broad-wing bomber against a fictional coastal depot and reach the escape area, or intercept the bomber as a defender. The projected ground ring shows the bomb impact estimate; a mint ring means the release window is valid.
- **Free flight:** choose the quick five-gate Local loop, nine-gate Northpoint Ridge trip, or nine-gate Westhaven Island trip. Start at Coastal Air Base, take off, follow the gates, approach the selected destination, land and stop. Northpoint has a raised runway; Westhaven has an east–west runway. G enables optional route and landing assistance. Flight keys temporarily override it; release them to resume assistance, or press G to switch it off. Unsafe touchdowns recover above the actual terrain into a go-around. Practice landings at another field do not award the selected route. Multiplayer free flight is a shared, host-led route; wingmates can fly formation.

The archipelago occupies a 30 × 26 km flight area, with approximately 180 km² of authored land across three islands. Terrain collision and rendered terrain share the same height model. Airports, coastal settlements, harbours and mountain ridges give the longer routes distinct destinations.

## Keyboard

W/S or Up/Down climb/descend; A/D or Left/Right bank and turn; Q/E fine rudder; Shift increases power; Z or minus reduces power; X air/wheel brakes. Space heat seeker; R radar missile; F flares; C chaff; B bomb; V chase/cockpit; G free-flight route assist; I optional expanded instruments; H controls; Escape or P pause; M mute. Release flight controls to level out. Tab, Enter and native select arrow keys navigate menus. Pairing supports Ctrl+A/C/V in its text fields. The default HUD shows the current task and essential flight/combat cues; cockpit view puts speed, altitude, thrust and attitude in its functional panel.

## Direct manual multiplayer

One host and up to five guests connect using **data-only WebRTC** and `iceServers: []`. Each guest needs a separate complete offer/answer exchange. ICE gathering must finish before codes export. There is no automatic Wi-Fi lobby discovery and no STUN/TURN/signalling service. Same Wi-Fi alone does not guarantee a direct connection: client isolation, restricted school/guest networks, firewalls, mDNS and managed browser policy can prevent it. Exchange fresh codes after reloads or host disconnects.

The host runs mission rules and bot physics. Identity comes from the connection, not client input. Ordered reliable control/actions and unordered zero-retransmit axes/snapshots use sequence validation, host-clock action cooldowns, rate limits, stale-input neutralization and buffer pressure handling. Sortie generations reject delayed packets from earlier starts, restarts and pause boundaries. Guests interpolate snapshots. Disconnected seats become bots; reconnecting seats regain control. Fresh guests claim an available living bot seat or clearly spectate until the next sortie when no seat is available. Free flight seats connected pilots at launch, so a fresh mid-flight guest waits for the next sortie. No media permissions are requested.

If the host's game tab becomes hidden, the sortie explicitly pauses for everyone; return and choose Resume to continue. A guest opening a personal menu or hiding their own tab neutralizes their controls and silences their local sound without pausing the host. This accommodates browsers suspending animation frames in hidden tabs.

## Verification

`npm test` runs deterministic simulation, terrain/mission and input/protocol tests, including every destination, runway heading/elevation, shared host route authority, six-pilot takeoffs, bot combat and hostile packet handling. Browser evidence and detailed multiplayer reports are produced separately by the test runner. Tests include six browser contexts in one cloud machine; those tests do **not** establish physical separate-device Wi-Fi compatibility.

The original generated menu illustration is labeled as illustration. Gameplay is rendered live in 3D. Original cloud images are volume-rendered by the included offline Python tool; the game loads their small local WebP derivatives. Spatial terrain chunks, instanced forest cells, static geometry batching, distance aircraft models and adaptive pixel ratio keep the expanded world practical; a measured six-aircraft browser scene used 171 draw calls and 253,098 triangles. Scene cost varies with the view and effects. Paused and completed sorties retain the last 3D frame rather than rendering continuously. Graphics loss safely neutralizes controls and requires an explicit resume after recovery. Sound and assist rules are intentionally arcade-oriented rather than a real aircraft certification model.
