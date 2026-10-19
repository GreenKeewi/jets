# Skybreak

An original static 3D browser jet game, built for approachable keyboard flying. No build step, accounts, microphone, camera, server simulation, or external runtime CDN. Three.js is vendored with its MIT license.

## Play

Serve this directory with a static server, for example `python3 -m http.server 8201`, then open the page in a WebGL-capable browser. Audio starts on launch and can be muted with M. All menus, pairing code fields, mission settings, pause screens, and navigation use native keyboard-accessible controls.

- **Dogfight:** solo bot skirmishes support 1v1, 1v2, 1v3, 2v2, 3v3, 3v2v3 and custom squads. Pick two or three teams, with one to four aircraft per team (12 total). Your squad count includes you; every other seat is a bot. Score takedowns over eight minutes, then press R or the Respawn button after an airframe loss to rejoin the same running match. Direct multiplayer keeps its original symmetric 1v1, 2v2, 3v3 elimination modes. Empty network seats are bots. Build a heat or radar lock, use the appropriate countermeasure, and protect the squadron. Standard bots keep the first sortie approachable; optional Ace bots turn, counter and fire more effectively using the same aircraft health and ammunition. Arcade weapons receive a small top-up every 22 seconds so a sortie does not become unwinnable after missed shots.
- **Strike & escape:** fly a broad-wing bomber against a fictional coastal depot and reach the escape area, or intercept the bomber as a defender. The projected ground ring shows the bomb impact estimate; a mint ring means the release window is valid.
- **Free flight:** choose the quick five-gate Local loop, nine-gate Northpoint Ridge trip, or nine-gate Westhaven Island trip. Start at Coastal Air Base, take off, follow the gates, approach the selected destination, land and stop. Northpoint has a raised runway; Westhaven has an east–west runway. G enables optional route and landing assistance. Flight keys temporarily override it; release them to resume assistance, or press G to switch it off. Unsafe touchdowns recover above the actual terrain into a go-around. Practice landings at another field do not award the selected route. Multiplayer free flight is a shared, host-led route; wingmates can fly formation.

The archipelago occupies a 30 × 26 km flight area, with approximately 180 km² of authored land across three islands. Terrain collision and rendered terrain share the same height model. Airports, coastal settlements, harbours and mountain ridges give the longer routes distinct destinations.

## Keyboard

**A / D** or **Left / Right** bank and turn visually left / right. **Up / Down** increases / reduces engine power; Shift and Z/minus remain power aliases. **W / S** climbs / descends. X air/wheel brakes. **Hold Space for the machine gun**: unguided rounds need no lock, so lead the target with the crosshair. Gun ammunition tops up during the sortie. **Q fires a heat-seeking missile; E fires a radar missile.** Build a short/full lock respectively, then press once. Holding or auto-repeat on Q/E does not steer, change power or launch repeatedly. F flares; C chaff; B bomb; R respawn in bot skirmishes; V chase/cockpit; G free-flight route assist; I extra instruments; H controls; Escape or P pause; M mute. Release flight controls to level out. Tab, Enter and native select arrows navigate menus. Pairing fields support Ctrl+A/C/V.

Positive simulation yaw/roll retains the authored world/AI convention. Pilot-facing input, radar, directional hints, aircraft bank, cockpit horizon and clockwise compass headings use one consistent view convention. Westhaven's east–west arrival is labelled runway 27 for its displayed heading; the runway geometry and flight route are unchanged.

## Direct manual multiplayer

One host and up to five guests connect using **data-only WebRTC** and `iceServers: []`. Each guest needs a separate complete offer/answer exchange. ICE gathering must finish before codes export. There is no automatic Wi-Fi lobby discovery and no STUN/TURN/signalling service. Same Wi-Fi alone does not guarantee a direct connection: client isolation, restricted school/guest networks, firewalls, mDNS and managed browser policy can prevent it. Exchange fresh codes after reloads or host disconnects.

The host runs mission rules and bot physics. Identity comes from the connection, not client input. Ordered reliable control/actions and unordered zero-retransmit axes/snapshots use sequence validation, host-clock action cooldowns, rate limits, stale-input neutralization and buffer pressure handling. Sortie generations reject delayed packets from earlier starts, restarts and pause boundaries. Guests interpolate snapshots. Disconnected seats become bots; reconnecting seats regain control. Fresh guests claim an available living bot seat or clearly spectate until the next sortie when no seat is available. Free flight seats connected pilots at launch, so a fresh mid-flight guest waits for the next sortie. No media permissions are requested.

If the host's game tab becomes hidden, the sortie explicitly pauses for everyone; return and choose Resume to continue. A guest opening a personal menu or hiding their own tab neutralizes their controls and silences their local sound without pausing the host. This accommodates browsers suspending animation frames in hidden tabs.

## Verification

`npm test` runs deterministic simulation, terrain/mission and input/protocol tests, including every destination, runway heading/elevation, shared host route authority, six-pilot takeoffs, bot combat and hostile packet handling. Browser evidence and detailed multiplayer reports are produced separately by the test runner. Tests include six browser contexts in one cloud machine; those tests do **not** establish physical separate-device Wi-Fi compatibility.

The original generated menu illustration is labeled as illustration. Gameplay is rendered live in 3D. Original cloud images are volume-rendered by the included offline Python tool; the game loads their small local WebP derivatives. Spatial terrain chunks, instanced forest cells, static geometry batching, distance aircraft models and adaptive pixel ratio keep the expanded world practical; a measured six-aircraft browser scene used 171 draw calls and 253,098 triangles. Scene cost varies with the view and effects. Paused and completed sorties retain the last 3D frame rather than rendering continuously. Graphics loss safely neutralizes controls and requires an explicit resume after recovery. Sound and assist rules are intentionally arcade-oriented rather than a real aircraft certification model.

## Strike objective regression

Strike success requires both destruction of the depot and arrival in the escape zone; eliminating all defenders keeps the bombing mission active. The simulation suite includes both roles and every squad size. `tests/strike-realtime.cjs` repeats the original reproduction seed through native keyboard combat, bomb release and escape at normal animation speed, without position writes or simulation stepping. See `evidence/controls/strike-realtime.json` for the current native-key browser result; `evidence/strike-regression-20261016.json` records the preceding release. Direct public-origin verification remains blocked by the cloud proxy; successful Pages jobs are recorded separately in the hub release manifest.

## Current controls and multiplayer verification

This control/gun release uses pairing protocol `JETS4`. Reload both players before exchanging fresh codes; older `JETS2`/`JETS3` codes are rejected with a clear version message. Gun damage, ammunition, cooldown, bullets and mission outcomes remain host-authoritative; guests send bounded realtime held-gun state and discrete weapon actions, and receive snapshots.

Normal-animation browser fixtures exercise actual keys at all four cardinal headings in chase/cockpit, including projected forward/wingtip movement, cockpit bank, power/pitch, press-only Q/E, gun tracers, and results Escape. A separate three-document application integration fixture covers guest controls and both replay paths after late joins. This executor's managed Chromium policy `WebRtcIPHandling: disable_non_proxied_udp` returns no native LAN candidates. The integration transport fixture is explicitly **not native WebRTC or a physical Wi-Fi test**. No browser policy or proxy bypass is used. Control/camera reports from the preceding release remain under `evidence/controls/`; current network reports are under `evidence/gun-jitter/`.


## Guest gun cadence under jitter

The gun uses realtime held input with a 250 ms freshness timeout. The host simulation alone sets its 10-round/second cadence and ammunition. A release stops firing on arrival; a lost release/update expires the gun state, and reliable missile/countermeasure traffic cannot renew it. Q/E remain discrete, press-only missiles. JETS4 rejects older pairing versions so both players must reload and exchange fresh codes.

The deterministic transport-plus-host-simulation regression reproduces four local shots versus two guest shots with the previous dual 100 ms cooldowns and 20/19/20/19 ms delays; the repair produces four versus four. Separate regressions cover release, dropped updates, expiry, reordering and the existing pause/replay generation boundaries. See `evidence/gun-jitter/README.md`. Native LAN connectivity remains unverified under this cloud browser's managed policy.

## Mach flight, squad formations and rejoining

Fighter cruise at 78% power is 285 metres/second (about 554 knots); full power reaches 686 metres/second, Mach 2 at the game's fixed 343 m/s reference. The speed readout measures actual world travel. Local air wisps remain world-anchored, low-altitude water has instanced whitecaps, and FOV grows by at most five degrees. Exhaust, transonic vapor and wind audio support that sense of acceleration. Low-power freeflight route approaches and bomber speeds remain tuned for the existing missions.

Squads begin in tight V or echelon formations with geometry-relative spacing. Whole rival squads arrive from seeded front, side or rear approaches, with rear squads close enough to create an ambush. Formation flying transitions into combat after a short lead-in. Aircraft use swept-volume collisions, including high-speed head-on and wingmate collisions; bots predict close passes and separate rather than deliberately ram.

Amber advisory warnings identify an enemy acquiring or holding a lock. Red warnings distinguish incoming heat/radar missiles, relative clock bearing and an approximate impact window. Flares defeat heat seekers; chaff defeats radar guidance. Seeker angle, bounded turning and radar illumination mean hard maneuvers can also break missile tracking. Missile launch cooldowns remain unchanged (heat 1.65 s, radar 2.5 s).

Human skirmish respawns are available after three seconds, and bots rejoin after eight. Time and team scores persist. Rejoining aircraft are placed clear of other planes with 2.5 seconds of protection and weapons safety; missiles aimed at the previous airframe cannot reacquire its replacement. A clear-path failure leaves the aircraft dead and asks the player to retry rather than spawning into an occupied position.

Rendering work is bounded: 48 near-air wisps (24 in adaptive low quality), instanced water detail, pooled effects and a 12-aircraft cap. Reduced-motion users do not get extra speed FOV or air wisps. These are designed performance bounds, not a measured Chromebook frame-rate claim.

### Verification of this release

The deterministic suite covers speed, legacy routes/controls/network behavior, asymmetric and three-team squads, formation geometry, directional ambushes, swept collisions, countermeasure and seeker behavior, scores and repeated respawns. Controller/DOM tests use test doubles and are explicitly not a 3D playtest. The native-key suite in tests/squad-browser.cjs is ready for a WebGL-capable environment. Actual rendered browser verification was blocked here: the installed test browser could not launch in the executor sandbox, while the reachable cloud browser reports WebGL disabled even for the previous public release. No browser security or network settings were changed.
