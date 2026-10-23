# Skybreak Jets

An original static 3D browser jet game, built for approachable keyboard flying. No build step, player accounts, microphone, camera or external runtime CDN. Solo and peer play remain independent of the optional, separately hosted authoritative server. Three.js is vendored with its MIT license.

## Play

Serve this directory with a static server, for example `python3 -m http.server 8201`, then open the page in a WebGL-capable browser. Audio starts on launch and can be muted with M. All menus, pairing code fields, mission settings, pause screens, and navigation use native keyboard-accessible controls.

- **Dogfight:** solo bot skirmishes support 1v1, 1v2, 1v3, 2v2, 3v3, 3v2v3 and custom squads. Pick two or three teams, with one to four aircraft per team (12 total). Your squad count includes you; every other seat is a bot. Score takedowns over eight minutes, then press R or the Respawn button after an airframe loss to rejoin the same running match. Direct multiplayer keeps its original symmetric 1v1, 2v2, 3v3 elimination modes. Empty network seats are bots. Build a heat or radar lock, use the appropriate countermeasure, and protect the squadron. Normal dogfights now use the smarter former Ace behavior, with the same physics, fuel, health and ammunition rules. Weapons refill only within 250 m of your HOME base, with a re-entry cooldown.
- **Strike & escape:** fly a broad-wing bomber against a fictional coastal depot and reach the escape area, or intercept the bomber as a defender. The projected ground ring shows the bomb impact estimate; a mint ring means the release window is valid.
- **Free flight:** choose the five-gate Local loop or longer Northpoint Ridge and Westhaven Island tours. Every route starts and ends at Coastal Air Base. L toggles optional route/landing assistance; flight keys temporarily override it. Unsafe touchdowns trigger a safe go-around. Gear is required and remote airports do not accept landing or service. Multiplayer free flight remains a shared, host-led route.

The expanded archipelago occupies a 72 × 72 km flight area across eight authored islands. All three airports now have 2.5 km runways. Terrain collision and rendered terrain share the same height model. Airports, coastal settlements, harbours and mountain ridges give the longer routes distinct destinations.

## Arcade travel

At cruise, airborne aircraft cover up to 50% more world distance while indicated knots, energy, signed G and vision effects use the normal flight model. The boost blends in from 120 to 220 m/s of indicated airspeed; grounded aircraft, departure climbs, gear-down flight and free-flight final approach keep normal travel. AI, weapon lead, missile speeds, bomb impact estimates and collision sweeps use the actual world motion. This is intentional arcade balance, not real-world groundspeed.

## Keyboard

**A / D** or **Left / Right** bank and turn visually left / right. **Up / Down** increases / reduces engine power; Shift and Z/minus remain power aliases. **W / S** climbs / descends. Normal mode self-levels. X toggles persistent air/wheel brakes and G toggles gear in either mode. K enables advanced attitude-hold controls. Open Settings to customize keys; preferences save on this browser, conflicting keys are rejected, and Reset defaults restores the original layout. **Hold Space for the machine gun**: unguided rounds need no lock, so lead the target with the crosshair. Weapons restock only near your HOME base. **Fighters: Q fires a heat-seeking missile; E fires a radar missile. Bombers have guns and bombs only.** Build a short/full lock respectively, then press once. Holding or auto-repeat on Q/E does not steer, change power or launch repeatedly. F flares; C chaff; B bomb; R respawn in bot skirmishes; V chase/cockpit; L free-flight route assist; I extra instruments; H controls; Escape or P pause; M tactical map; N mute. In K mode, release pitch/roll input to hold the current attitude and roll back level manually. Tab, Enter and native select arrows navigate menus. Pairing fields support Ctrl+A/C/V.

Positive simulation yaw/roll retains the authored world/AI convention. Pilot-facing input, radar, directional hints, aircraft bank, cockpit horizon and clockwise compass headings use one consistent view convention. Westhaven's east–west arrival is labelled runway 27 for its displayed heading; the runway geometry and flight route are unchanged.

## Play with friends

Open **Play with friends → Create room** and share the invite link or eight-character room code. An invite link joins automatically; a code goes into **Join room**. Once your friends connect, the host chooses the mission and presses **Launch with N pilots**. Up to six pilots share one host-led world. Each browser needs the current release. Keep the host tab open; a reload creates a new room.

Room matching uses the official free [PeerJS Cloud](https://peerjs.com/server/cloud) service. The pinned PeerJS 1.5.5 client is vendored locally under its MIT license and loaded only when creating/joining a room. [Cloudflare's public STUN](https://developers.cloudflare.com/realtime/turn/faq/) helps find direct network paths. These services receive the connection metadata needed for setup; gameplay data travels peer-to-peer. There are no accounts, embedded service credentials, audio/video calls or media permissions. The room code/invite grants access to the game, so share it only with intended players.

This fixes the long manual exchange and adds automatic signaling/NAT discovery, but does **not** guarantee connectivity on restricted networks. PeerJS Cloud is shared infrastructure without an availability guarantee. Some school/work networks, isolated Wi-Fi, browser policies and strict NATs still require a TURN relay. No TURN relay is configured; no paid infrastructure or account has been created. The UI distinguishes missing rooms from direct connection failures and offers retry/leave instead of an indefinite wait. Existing connected pilots can keep playing during a signaling-service interruption, but new guests need it restored.

The collapsed **Advanced → manual LAN pairing** fallback still uses data-only WebRTC with `iceServers: []`; it does not contact the room service or STUN. That fallback needs a separate complete offer/answer exchange per guest and a reachable local network. Both players must reload and exchange fresh codes after a host reload or disconnect. No automatic Wi-Fi lobby discovery is claimed.

The host runs mission rules and bot physics. Identity comes from the connection, not client input. Ordered reliable control/actions and unordered zero-retransmit axes/snapshots use sequence validation, host-clock action cooldowns, rate limits, stale-input neutralization and buffer pressure handling. Sortie generations reject delayed packets from earlier starts, restarts and pause boundaries. Guests interpolate snapshots. Disconnected seats become bots; reconnecting seats regain control. Fresh guests claim an available living bot seat or clearly spectate until the next sortie when no seat is available. Free flight seats connected pilots at launch, so a fresh mid-flight guest waits for the next sortie. No media permissions are requested.

If the host's game tab becomes hidden, the sortie explicitly pauses for everyone; return and choose Resume to continue. A guest opening a personal menu or hiding their own tab neutralizes their controls and silences their local sound without pausing the host. This accommodates browsers suspending animation frames in hidden tabs.

## Verification

`npm test` runs deterministic simulation, terrain/mission and input/protocol tests, including every destination, runway heading/elevation, shared host route authority, six-pilot takeoffs, bot combat and hostile packet handling. Browser evidence and detailed multiplayer reports are produced separately by the test runner. Tests include six browser contexts in one cloud machine; those tests do **not** establish physical separate-device Wi-Fi compatibility.

The original generated menu illustration is labeled as illustration. Gameplay is rendered live in 3D. Original cloud images are volume-rendered by the included offline Python tool; the game loads their small local WebP derivatives. Spatial terrain chunks, instanced forest cells, static geometry batching, distance aircraft models and adaptive pixel ratio keep the expanded world practical; a measured six-aircraft browser scene used 171 draw calls and 253,098 triangles. Scene cost varies with the view and effects. Paused and completed sorties retain the last 3D frame rather than rendering continuously. Graphics loss safely neutralizes controls and requires an explicit resume after recovery. Sound and assist rules are intentionally arcade-oriented rather than a real aircraft certification model.

## Strike objective regression

Strike success requires both destruction of the depot and arrival in the escape zone; eliminating all defenders keeps the bombing mission active. The simulation suite includes both roles and every squad size. `tests/strike-realtime.cjs` repeats the original reproduction seed through native keyboard combat, bomb release and escape at normal animation speed, without position writes or simulation stepping. See `evidence/controls/strike-realtime.json` for the current native-key browser result; `evidence/strike-regression-20261016.json` records the preceding release. Direct public-origin verification remains blocked by the cloud proxy; successful Pages jobs are recorded separately in the hub release manifest.

## Current controls and multiplayer verification

The current game uses pairing protocol `JETS6`. Reload both players before exchanging fresh codes; older `JETS2`/`JETS3`/`JETS4` codes are rejected with a clear version message so both players see the same valley terrain. Gun damage, ammunition, cooldown, bullets and mission outcomes remain host-authoritative; guests send bounded realtime held-gun state and discrete weapon actions, and receive snapshots.

Normal-animation browser fixtures exercise actual keys at all four cardinal headings in chase/cockpit, including projected forward/wingtip movement, cockpit bank, power/pitch, press-only Q/E, gun tracers, and results Escape. A separate three-document application integration fixture covers guest controls and both replay paths after late joins. This executor's managed Chromium policy `WebRtcIPHandling: disable_non_proxied_udp` returns no native LAN candidates. The integration transport fixture is explicitly **not native WebRTC or a physical Wi-Fi test**. No browser policy or proxy bypass is used. Control/camera reports from the preceding release remain under `evidence/controls/`; current network reports are under `evidence/gun-jitter/`.


## Guest gun cadence under jitter

The gun uses realtime held input with a 250 ms freshness timeout. The host simulation alone sets its 10-round/second cadence and ammunition. A release stops firing on arrival; a lost release/update expires the gun state, and reliable missile/countermeasure traffic cannot renew it. Q/E remain discrete, press-only missiles. JETS5 rejects older pairing versions so both players must reload and exchange fresh codes.

The deterministic transport-plus-host-simulation regression reproduces four local shots versus two guest shots with the previous dual 100 ms cooldowns and 20/19/20/19 ms delays; the repair produces four versus four. Separate regressions cover release, dropped updates, expiry, reordering and the existing pause/replay generation boundaries. See `evidence/gun-jitter/README.md`. Native LAN connectivity remains unverified under this cloud browser's managed policy.

## Mach flight, squad formations and rejoining

Fighter cruise at 78% power is 315 metres/second (about 612 knots); 686 metres/second is a hard safety cap, not a speed instantly obtained by selecting full power. Afterburner starts at 110% throttle and runs while fuel remains; Mach uses a fixed 343 m/s reference. Indicated speed excludes the arcade world-travel boost. Local air wisps remain world-anchored, low-altitude water has instanced whitecaps, and Speed FOV grows by at most 11.5 degrees in chase view (9.5 in cockpit) (disabled by reduced-motion preference). Exhaust, transonic vapor and wind audio support that sense of acceleration. Low-power freeflight route approaches and bomber speeds remain tuned for the existing missions.

Squads begin at airport runways and take off in sequence before engaging. Airport departures replace the previous airborne formation and seeded approach spawns. Aircraft use swept-volume collisions, including high-speed head-on and wingmate collisions; bots predict close passes and separate rather than deliberately ram.

Amber advisory warnings identify an enemy acquiring or holding a lock. Red warnings distinguish incoming heat/radar missiles, relative clock bearing and an approximate impact window. Flares defeat heat seekers; chaff defeats radar guidance. Seeker angle, bounded turning and radar illumination mean hard maneuvers can also break missile tracking. Missile launch cooldowns remain unchanged (heat 1.65 s, radar 2.5 s).

Human skirmish respawns are available after three seconds, and bots rejoin after eight. Time and team scores persist. Rejoining aircraft return to an available airport departure position; missiles aimed at the previous airframe cannot reacquire its replacement. Runway queues keep waiting aircraft clear of departing traffic.

Rendering work is bounded: 48 near-air wisps (24 in adaptive low quality), instanced water detail, pooled effects and a 12-aircraft cap. Reduced-motion users do not get extra speed FOV or air wisps. These are designed performance bounds, not a measured Chromebook frame-rate claim.

### Verification of this release

The deterministic suite covers speed, legacy routes/controls/network behavior, asymmetric and three-team squads, formation geometry, directional ambushes, swept collisions, countermeasure and seeker behavior, scores and repeated respawns. Controller/DOM tests use test doubles and are explicitly not a 3D playtest. The native-key suite in tests/squad-browser.cjs is ready for a WebGL-capable environment. Actual rendered browser verification was blocked here: the installed test browser could not launch in the executor sandbox, while the reachable cloud browser reports WebGL disabled even for the previous public release. No browser security or network settings were changed.


## High-G pilot limits and heat defense

Sustained positive G is estimated from actual speed and flight-path acceleration along the pilot's up axis. Exposure builds slowly above 7.5 G. Brief turns leave vision clear; prolonged high G adds a mild peripheral vignette, with blackout reserved for sustained severe strain. Turn and weapon inputs are neutralized briefly during blackout so the airframe unloads. Recovery is faster, and controls return automatically as vision clears. Bots share the same limits and ease off when strained. Respawn creates a fresh pilot; pause, help, and result screens remain readable. This is an arcade approximation rather than a medical or aircraft model.

Each incoming heat missile gets one seeded flare-defeat roll per release burst, not per particle or frame. Flares can fail at any power setting. Fighter afterburner above 82% power sharply reduces flare effectiveness; cutting power before release improves the odds. Evasive flight still works through the existing seeker angle, turn and tracking limits. Radar missiles retain their separate chaff behavior.

In cockpit view, the dashes around the fixed central plus now follow the projected world horizon. They move with pitch, rotate with the visible horizon, and mark the sky side with UP.

Verification for this follow-on release was limited to source/syntax and deployment-version checks, as requested. No additional gameplay tests or rendered playtest were run.


## Valley battles and flight energy

Dogfight now offers a Battle area selector: Coastal sky or Northern valley. The northern island has a broad winding valley with a low floor and tall ridgelines, shared by collision checks and the existing heightfield renderer. Squads now depart from airports rather than appearing in midair. Human and bot skirmish respawns also return to an airport; queued departures wait for runway clearance. Once airborne, pilots must still clear the valley terrain and ridgelines.

Valley bots lead their turns back along the corridor, keep engagements near the valley floor, sample terrain ahead, and use gentle steering while recovering from high G. Pilots can still climb out by choice. Existing coast, strike, runway routes, weapons, squad sizes and local-network play remain available. The valley reuses the existing tiled terrain meshes and tree batches; it adds no scenery draw calls or assets.

Aircraft speed now integrates engine thrust, speed-squared drag, load-dependent induced drag, airbrakes and gravity along the flight path. A climb spends speed on altitude; a descent gains speed; a sustained hard turn costs energy. The same flight-path load used by pilot-G physiology drives induced drag. Throttle remains important rather than forcing an immediate target speed. Low airspeed produces sink and softer pitch response, while the HUD shows climb/descent and a low-energy warning. Turn authority decreases above 240 m/s and pitch rate is load-limited, with further supersonic softening: Mach-1/Mach-2 turns need much more space, while load-squared drag spends energy. Route assist adds power for climbs. Peripheral FOV opening, sparse nearby world-fixed air streaks and wind sound build earlier approaching Mach 1 without changing the actual metres-per-second speed. Reduced-motion suppression and the 48/24-wisp performance cap are retained. Approximate level cruise remains near 78% power and fighters retain the Mach-2 speed limit. This is a forgiving game energy model, not a validated aircraft simulator.

As requested, this release received only source/syntax and deployment-version verification. No gameplay suite, simulated sortie or rendered playtest was run for these changes.


## Room-code release verification

The room-code release retains JETS5 gameplay packets, reliable control/action messages and a separate unordered zero-retransmit realtime channel on the same peer connection. The host assigns pilot identity and owns the simulation. Roster information now precedes a late join's start message. Leaving cancels pending asynchronous room setup, closes its signaling client, and restores solo controls. Room IDs are cryptographically generated and contain no player names. A full room rejects additional guests with a useful message. Reloads require a new host code; there is no permanent lobby or account.

As requested, verification for this release is source inspection, JavaScript syntax checks and deployment/version verification only. No gameplay test suite, mocked transport run or two-device WebRTC playtest was run. The managed browser's previously observed WebRTC/WebGL restrictions remain in place.


## Combat flow and responsive power (2026-10-19)

Throttle taps make fine adjustments; holding the power keys now sweeps the lever through its full range in about a second. The existing power percentage is more legible and updates immediately. Airspeed still follows thrust, drag, gravity and aircraft energy rather than jumping to the commanded speed.

Nearby selected enemies get a small dotted gun-lead ring, based on the same round speed and lifetime as the simulation. It is a prediction, not aim assist. Brief center hit ticks replace repeated gun-hit toasts. Weapons retain their acquisition cone and range, while target hysteresis prevents similar formation members from repeatedly stealing a lock. Bots retain a separate pursuit target, lead short intercepts, fire limited aligned gun bursts, unload into short extensions after overshoots or low energy, and cut afterburner before attempting heat-missile flares. Formation, collision and terrain avoidance retain priority.

Numeric instruments, cockpit canvas and expanded radar refresh at approximately 10 Hz; unchanged text is not rewritten. Hidden radar is not redrawn. Aiming, projected target/waypoint positions, horizon, damage, hit feedback and warning changes remain immediate. Rendering lowers resolution in gradual steps after sustained sub-30 fps and recovers more slowly after a long fast interval. Later upgrades below add bounded atmospheric cues and original aircraft assets.

Per the requested deployment-only scope, verification covers syntax, module sources and deployed-version checks. No gameplay tests, simulated sorties, performance benchmark or rendered 3D playtest were run for this release.

Room compatibility remains rooms3-1019, preserving existing compatible room clients. A separate client asset build now versions invite URLs and the visible game-build label, so visual/control-only releases do not require a protocol mismatch. The raw WebRTC transport serializer and matching compatibility checks are unchanged.

## Combat missions, damage, pilot styles and sound

**Objective missions are currently disabled and hidden in the player UI.** The retained implementation has four mission choices: the existing dogfight/skirmish, Escort, Intercept and Survive an ambush. Escort protects an unarmed AI transport along a short coastal or valley route. Intercept gives the other squad that transport and asks you to stop it before the exit. Both have a 150-second mission limit, route checkpoints and explicit results. Ambush starts the attackers behind your formation; the ambushed squad wins by surviving 90 seconds or eliminating the attackers. Mission results and the pause menu offer a direct retry. These objective missions do not respawn aircraft. The existing eight-minute solo skirmish and R rejoin remain available under Dogfight.

The host owns routes, deadlines, damage and results. All six human seats remain fighter seats; an objective transport uses one additional AI seat, never exceeds the 12-aircraft cap, and cannot be claimed by late joins. Existing room setup and JETS5 transport are retained.

Cautious bots extend out of danger sooner, aggressive bots press their pursuit and weapon windows, and the first two bots in a squad coordinate a target with an offset wingman approach. These are modifiers to the same flight controls, weapon rules, energy/G limits, collision prediction and terrain avoidance. Personality is identified in the existing selected-target label.

Confirmed hits show short spark streaks, and damaged living aircraft below 75% airframe leave smoke. These use two fixed buffer draws: at most 96 spark segments and 144 smoke points, halved at lower adaptive quality and suppressed for reduced motion. No growing particle lists, external assets or camera shake are added. A brief message beside airframe health identifies cannon, heat missile, radar missile, terrain or aircraft-collision damage and an incoming bearing where known. It is immediate hit feedback rather than an added results panel.

Four reusable nearby-aircraft audio voices provide stereo bearing, bounded Doppler pitch and a close-pass rush. Engine layers follow throttle, afterburner, speed and cockpit view. Enemy lock is a slow advisory; heat missiles use paired falling whistles and radar missiles use a three-note rise, with directional bearing and faster urgent repetition. Audio starts through existing player gestures, respects mute/pause/hidden tabs, and cancels pending tones. No audio downloads or media permissions are needed.

Verification for this release is source inspection, JavaScript syntax and deployed-version checks only, as requested. No optional gameplay suite, simulated sortie, listening test, performance benchmark or rendered WebGL playtest was run.

## Objective mission release switch

Escort, Intercept and Survive an ambush are retained behind `COMBAT_MISSIONS_ENABLED=false` in `combat-missions.js`. The selector and help text are hidden by default in HTML and remain hidden/disabled in the controller. Launch configuration and simulation creation normalize mission IDs to Dogfight; objective snapshots and older hosts starting objective missions are rejected, with a reload notice for guests. There is no URL, saved-setting or network override. Ordinary Dogfight/skirmish, Strike & escape, Free flight, bot personalities, damage effects, audio and throttle behavior remain available.

To re-enable, set the source flag to `true` and publish with fresh versions for `combat-missions.js`, `sim.js`, `render.js`, `game.js` and the game entry point. The UI and mission implementation then resume together. Keep `network.js` room compatibility at `rooms3-1019` and the raw serializer unchanged; its import version only controls the client build/invite cache.

This disable-only release received source/syntax and deployed-file checks. No optional tests or gameplay runs were performed.


## Airport departures, landing and repair

Players and enemy aircraft begin at airports, including skirmish respawns. Add power with Up; above 80 m/s (about 155 knots), gently hold W to take off. Aircraft waiting behind a departure hold until the runway ahead clears. Normal mode brakes automatically after landing at low power. In K mode, X is the wheel brake.

Land on your own HOME airport runway in either direction: line up, keep the wings level, descend gently and touch down at no more than 115 m/s (about 224 knots). After a successful touchdown, slow below 8 m/s (about 15 knots), reduce power to 20% or less and remain on the runway. Repairs restore 8 health points per second after 3 seconds without another hit. Starting at an airport is not itself a qualifying landing.

Grounded aircraft are immune to missiles and cannot launch missiles, but remain vulnerable to gunfire. Add power and take off again whenever ready. The HUD shows departure clearance, takeoff controls, repair status and nearby-airport service information. Flyby ammunition resupply remains separate from landing repairs.

## Airfield flyby resupply

A living aircraft flying within 250 m of any authored airfield's runway, taxiway or apron receives full gun ammunition, heat and radar missiles, flares, chaff, and bomber payload where equipped. Flyby resupply does not repair damage or restore health; use the runway landing-and-repair procedure above. Distance is three-dimensional from the visible pavement surfaces and their local elevation/heading, including the full 2.2 km coastal runway; flying high above a base does not count. There is no fuel resource to reset. Existing weapon cooldowns, flight physics and pilot-G recovery are unchanged.

Resupply happens once on entering the zone. Exit beyond 350 m and allow 12 seconds before a new entry to receive another refill. Camping inside or crossing the inner boundary repeatedly does not grant another refill. New spawns already near the runway must leave before their first service pass; full aircraft do not produce a redundant resupply message. Dead aircraft and objective transports are not serviced. Each squad services only at its own HOME airfield. Anywhere-in-the-air periodic ammunition top-ups have been removed.

A small nearby-airfield line beside the weapons shows distance, readiness and successful resupply; the pilot also receives one brief confirmation per refill. The host alone evaluates service and snapshots include resource counts, cooldown and entry latch for guests and reconnects. Room compatibility remains `rooms3-1019`, while the client asset build is `resupply2-1019`. Objective combat missions remain disabled behind their existing release flag.

As requested, verification is limited to source review, JavaScript syntax, and commit/Pages/deployed-file checks. No optional gameplay suite, simulated sortie, multiplayer session or rendered 3D playtest was run.


## Environmental seeker interference

Radar missiles have reduced turning authority and a chance to lose grounded or very low terrain-relative targets to ground clutter; low flight is not immunity. The airport update below separately makes aircraft immune to missiles while on the runway. Heat seekers can lose a target within eight degrees of the visible sun disk as seen from the missile, provided terrain does not hide the sun. Flying anywhere in daylight does not trigger it. Afterburner heat lowers sun-confusion susceptibility, and existing flare-burst and chaff rules are unchanged. Exposure is integrated in simulation seconds against one seeded threshold per missile and survives host snapshots.

This release received syntax, source and deployment checks only; no gameplay tests or browser playtest were run.


## Airport release notes (2026-10-21)

The airport update supersedes earlier aerial-start and aerial-respawn descriptions. Each squad departs a separate authored airport; Northern valley remains the combat destination rather than a midair spawn location. Runway ground state, repairs, damage and missile eligibility are host-authoritative and included in snapshots. Interpolation does not blend across ground/air, death or respawn state transitions. Missile immunity includes missiles launched before touchdown; those tracks are permanently dropped. Missiles have no area/splash damage in this simulation. Guns retain ordinary damage and pause ongoing repairs for three seconds.

Reload both players and create a new room: this release uses JETS6 / airports1-1021 so old clients cannot start with incompatible airport rules. Objective missions remain disabled. As explicitly requested, no gameplay tests, simulation suite, or browser playtest were run for this release. Only source/syntax review and publication status were checked.

## Skybreak Jets systems update · 22 October 2026

This section supersedes older controls and behavior described above.

- Flight uses metres/second with bounded runway thrust, gravity/drag energy exchange, signed normal G and fuel-mass-dependent handling. Fighter and flying-wing bomber are original F-16/B-2-inspired models, not licensed replicas or DCS assets. This remains an approachable arcade game, not a certified simulator.
- Select 25/50/75/100% starting fuel. Higher fuel mass reduces acceleration/agility. Consumption is scaled for useful game sorties, not a claim of real fuel endurance. Fighter afterburner starts at 110% throttle, has no timed burst limit or cooldown, and costs more fuel than dry thrust. This is game balance, not an F-16 engine model.
- In either control mode, X toggles persistent airbrakes; G toggles visible gear (cannot retract on the ground). Land only at your own HOME runway with gear down, low descent rate and level wings. Stop and reduce power to repair airframe/engine/control damage and refuel. The airport is missile-safe while on the runway but guns remain dangerous.
- Fly within 250 m of HOME pavement to refill weapons/countermeasures, without repairs or fuel. Exit beyond 350 m and observe the 12-second re-entry cooldown. Enemy airports do not service you. Passive in-flight 22-second weapon top-ups have been removed.
- Normal mode self-levels and automatically lowers gear for slow HOME approaches. K toggles advanced, explicitly arcade high-maneuverability assistance and manual systems. Body-axis roll/pitch supports complete rolls, loops and sustained inverted attitude. Cobra-style rotations are arcade assistance, not a claim that an F-16 performs a real Cobra.
- L toggles optional scenic route assist. Flight School is optional, available from the menu or H; there is no forced onboarding. Menus and flight can be operated by keyboard, including Tab/Shift+Tab, arrows, Enter/Space, Escape, R respawn, V view and I instruments.
- Bombers carry bombs and guns, never missiles. Their high-subsonic performance and original flying-wing silhouette are inspired by public B-2 references; the gun loadout is fictional gameplay.
- Engine/control-surface damage changes thrust and maneuver authority, with cockpit warnings. Engine, airflow, gear/brake/burner transitions and prioritized missile/caution tones use procedural audio, with no third-party recording assets.

Public shape references: [USAF F-16 overview](https://www.airmanmagazine.af.mil/Features/Display/Article/2595848/airframe-the-f-16-fighting-falcon/) (single engine, approximately 14.8 m length / 9.8 m span) and [USAF B-2 fact sheet](https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104482/b-2-spirit/) (tailless flying wing, high subsonic, approximately 20.9 m length / 52.1 m span). Models use exaggerated game-scale dimensions with original geometry and no copied proprietary game textures.

Friend-room compatibility is JETS8; old invites and manual pairing codes must be regenerated. Reload both devices and generate fresh room codes. Existing peer rooms remain distinct from the separately prepared authoritative-server work.

The home menu uses the actual aircraft and home airport as its WebGL backdrop. Local Chromium WebGL gameplay and cockpit screenshots are now verified; earlier cloud graphics limitations no longer describe this release. The public-site browser certificate warning was not bypassed.

### Current verification status

Automated physics, mission, controls and backend suites pass. Local browser testing includes native keyboard sorties, cockpit layouts and generated audio signals. No human listening or cross-network multiplayer validation is claimed. The optional shared-server endpoint remains empty until deployed with separately authorized Cloudflare access.

## v1.0.7 cloud update

Gear and airbrake work in both control modes. The Controls & accessibility dialog saves keyboard assignments, rejects conflicts, resets defaults, and offers reduced visual effects. First-person view includes original seated legs/boots, pedals, stick and a live throttle, with the readable instrument panel retained. See [cockpit design](cockpit-design.md).

Signed pilot load now comes from physical acceleration minus gravity in the pilot frame. Actual flight-path limiting replaces impossible sustained turns, with a signed G display. The original exposure effects were subsequently removed in v1.0.8. See [flight model and authoritative sources](flight-model.md) for the fictional envelopes and physiology simplifications. Fighter afterburner begins at 110%, continues without a timer, and consumes 8 kg/s (dry maximum 3.8 kg/s).

Strike depots now sit beyond the enemy airfield, with a long outbound route and escape. At most two occasional airfield SAM launches occur per sortie; bomber flares deterministically defeat these cinematic missiles. Bombers still carry bombs and guns only.

Audio includes a fix for powered sound from destroyed engines and false historical gun bursts. Browser-generated PCM and a running AudioContext were tested, not human-listened. The dedicated backend passed local Node and Cloudflare runtime tests but still has no public endpoint or configured deployment authorization. Existing friend rooms are separate; no cross-network multiplayer claim is made. See [verification evidence](evidence/v1.0.7/audio-backend.md).

## v1.0.8 immediate G-effects fix

Blackout, redout and G-induced control lockouts are removed entirely. G only adds a light, capped edge vignette with a clear center. The signed G meter and actual flight envelope remain. Sustained excessive G causes small, capped airframe wear after a grace period; ordinary turns do not. Existing home-base landing service repairs the wear. See [verification](evidence/v1.0.8/g-response/README.md) for the explicitly arcade values and tests.

## v1.0.9 cockpit and handling feedback

The B-2-inspired bomber now has its own broad two-seat cockpit, split windshield framing, wide instrument panel and grouped engine controls, based on public cockpit photographs. The fighter keeps its existing interior. All geometry is original, and the simplified instruments/controls are arcade representations.

Nearby world-fixed sea foam and land detail, closer peripheral airflow streaks, modestly wider speed FOV and a stronger wind/engine mix improve speed sensation. Indicated knots, fuel/energy, landing behavior and the existing 1.5× cruise travel scale are unchanged. Reduced-motion retains fixed FOV and disables added airflow streaks. See [speed verification](evidence/v1.0.9/speed-feel.md).

The full native-keyboard Strike & Escape validation now covers runway departure, SAM warning and flare defeat, a real bomb impact and the successful escape end state. The test pilot uses telemetry to choose native key presses, without position writes or simulation stepping. See [complete-sortie evidence](evidence/v1.0.9/strike-keyboard/README.md).

Northpoint now occupies a separate island, 17.90 km from HOME with a 3.90 km continuous water crossing along the direct route. The depot, SAMs, AI and escape markers use the moved airport. Northern Valley is a 22.84 km mountain corridor with eight linked bends and a 1.2 km floor; AI follows the bends and manages speed. Airbrake drag builds gradually to 12–16 m/s² at sea level, down from an abrupt 28, while wheel braking is unchanged.

## v1.0.10 radar terrain and bomber balance

Extra instruments (I) now show faint actual terrain/coastlines and runway strokes beneath radar contacts. The heading-up map shares contact coordinates, has a 3.5 km outer range and circular clipping, and caches a small local terrain raster across movement and heading changes. No external map service is used.

B-2-inspired bombers are harder to acquire: 2.8 km maximum acquisition range and half-speed lock accumulation, compared with the fighter's existing 4.2 km/full rate. This is fictional game balance, not real stealth performance. AI bombers climb toward 2,900 m and descend for the attack; player altitude remains manually controlled. See [balance details](bomber-balance.md) and [release evidence](evidence/v1.0.10/README.md).

## v1.0.11 friend teams and responsive countermeasures

In the friend-room lobby, choose Alpha or Bravo for each connected pilot before launch. Put friends on the same team to fight AI jets; empty squad seats remain bots. Hosts assign teams, guests may request their own team, and teams lock during the sortie. The new JETS8 room protocol requires fresh invitations and a reload on both devices. Dedicated-server co-op is implemented and tested locally, but no public server endpoint is configured.

F releases flares and C releases chaff once per discrete press, without a gameplay cooldown; holding a key does not drain stocks. V remains camera and all controls stay rebindable. Fighter inventories are 60/60 and bomber inventories 120/120, explicitly fictional game release counts because public sources do not establish universal verified capacities. Fresh matching bursts add opportunities with diminishing returns, not general missile immunity. HOME restocks finite supplies, and the requested cinematic bomber SAM flare guarantee remains. See [public research and game balance](countermeasures.md) and [combined verification](evidence/v1.0.11/README.md).

## v1.0.12 tactical map and airport services

M opens the live tactical map; M or Escape closes it. N now toggles sound, and V remains camera. Saved keyboard preferences migrate without resetting unrelated custom controls; any reassignment is explained in Controls. Map and sound remain rebindable.

The map shows actual terrain, your position/heading, team-relative airport labels, mission objectives and known contacts. H marks your only HOME service airport; F marks other friendly airports, X hostile airports, and — unassigned airports. Other airports do not provide landing service or restock. Land at HOME with gear down, stop and reduce power to repair/refuel. Enter within 250 m of HOME pavement to restock weapons/countermeasures; exit beyond 350 m before another pass, with the existing 12-second cooldown. The map does not pause the simulation; flight inputs are released while it is open.

See [verification and screenshots](evidence/v1.0.12/README.md).

## v1.0.13 optional enemy AI reinforcements

The friend-room host can enable enemy AI respawns before a same-team co-op dogfight: off by default, or 2/3/5 minutes (3 minutes initially selected). Human respawns are unchanged. Opposing-human-team games and other modes retain their existing rules. Settings lock during a sortie and synchronize to guests and late joiners. Each eligible enemy returns once at its team's runway, waiting for a clear spawn position and using normal takeoff behavior. Friendly bots and disconnected human seats are not reinforcement slots.

With reinforcements enabled, eliminating enemies starts their return timers instead of immediately winning. Losing the friendly squad still ends the match; the existing eight-minute sortie limit remains. The HUD displays the next return and remaining sortie time. Pause freezes simulation timers; a new sortie clears pending respawns. See [test evidence and limitations](evidence/v1.0.13/README.md).

## v1.0.14 correction: seconds, not minutes

Enemy AI reinforcements now offer Off / 15 / 30 / 60 seconds, with 30 seconds selected when first enabled. Legacy 120/180/300-second host/config values normalize to 30 seconds; Off stays Off. v1.0.13 did not persist this setting in browser storage, so there is no saved localStorage preference to migrate. Room settings remain session-scoped. Human respawns and other match rules are unchanged. [Verification](evidence/v1.0.14/README.md).
