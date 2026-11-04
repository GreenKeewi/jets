# Aircraft and flight reference notes · v1.2.0

These are original simplified models and an approachable energy-based flight game. Public real-aircraft references guide proportions and behavior; War Thunder is a broad presentation/gameplay reference. No War Thunder mesh, skin, sound, UI artwork or proprietary flight-model code is included.

## Aircraft shape and appearance

- **Su-27:** rebuilt the fuselage cross-sections, cropped wings, leading-edge roots, long nose, separated engine nacelles and aft center stinger. Length/span is about 1.48 in both detail levels. It has a single-seat canopy, conventional center stick, no foreplanes and fixed exhaust nozzles. The three-tone blue/grey camouflage is generated locally from original functions and UVs; it evokes real Flanker schemes rather than reproducing a particular aircraft's paint diagram. [USAF museum photographs and Flanker family description](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/3566120/sukhoi-su-27ub-flanker-c-trainer/) show a two-seat UB, used for shared family/nacelle/tail cues rather than its canopy. [War Thunder's Su-27 page](https://wiki.warthunder.com/unit/su_27) was reviewed for the single-seat type, conventional layout, visible stores and energy-sensitive high-alpha gameplay.
- **F-14B:** original twin-tail, twin-nacelle model with a long tandem canopy and moving outer wings. Fixed glove-mounted stores remain attached while wingtip details and control surfaces follow the moving wings. [Smithsonian's Tomcat description](https://airandspace.si.edu/collection-objects/grumman-f-14dr-tomcat/nasm_A20040156000) supports the tandem swing-wing strike-fighter layout; [War Thunder's F-14A page](https://wiki.warthunder.com/unit/f_14a_early) provided a game-facing external-stores/airframe reference. Neither reference is presented as an exact F-14B reconstruction.
- Existing F-16 and F/A-18 choices remain. [NAVAIR's Super Hornet description](https://www.navair.navy.mil/product/FA-18EF-Super-Hornet) confirms the type's fighter/attack roles and mixed external ordnance.

## Maximum speeds

Simulation speed is metres per second; the HUD displays knots and a legacy fixed 343 m/s Mach reference. These are conservative, altitude-independent gameplay caps, approximating published best-condition performance. Real top speed depends on altitude, atmosphere, stores and variant; the game does not reproduce those complete schedules. Dive, afterburner and the existing arcade travel boost cannot exceed the cap in world motion either.

| Aircraft | Cap (m/s) | Approx. km/h | Basis |
| --- | ---: | ---: | --- |
| F-16C | 670.56 | 2,414 | [USAF fact sheet](https://www.jba.af.mil/About/Fact-Sheets/Display/Article/4282145/f-16c-fighting-falcon/) lists 1,500 mph / Mach 2 at altitude; mph converted to SI. |
| F/A-18E | 530.56 | 1,910 | Conservative game approximation of [Boeing's Mach 1.6 specification](https://www.boeing.com/defense/fighters-and-bombers/fa-18-super-hornet-and-ea-18-growler), using about 332 m/s as the conversion reference. It is not a universal real-aircraft limit. |
| Su-27 | 694.44 | 2,500 | Rounded from the [War Thunder type page's roughly 2,498 km/h at 12 km](https://wiki.warthunder.com/unit/su_27). This is a game/reference approximation, not manufacturer-certified test data. |
| F-14B | 690.23 | 2,485 | Family-level approximation from the [Cradle of Aviation's F-14A 1,544 mph figure](https://www.cradleofaviation.org/history/exhibits/jet_gallery/grumman_f-14a_tomcat.html), converted to SI. |

The F-14's wings-forward cap is 72% of its fully swept cap. Its actual sweep position affects the cap, drag, stall speed and handling continuously.

## AoA limiter and energy

The previous override's fixed 17 G ceiling and extra coordinated yaw are removed. [The government-indexed F-16 limiter study](https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/ADA177941.xhtml) explains that AoA limiting constrains effective normal-acceleration commands. The implemented approximation uses required lift coefficient `n × mass × g / (dynamic pressure × wing area)`, a 4.8/radian lift slope, and a density decrease with height to estimate effective alpha. This estimate is independent of pitch attitude, although it is not a measured body/airflow angle from a full six-degree-of-freedom simulation.

Normal game alpha limits are 25° F-16, 22° Super Hornet, 24° Su-27 and 24° F-14. F/A-18E and Su-27 O override permits 32° and 35° respectively. These thresholds and the post-stall penalty are explicitly authored game tuning, not verified aircraft FCS schedules or War Thunder internals. The structural positive-G ceiling remains 9 for F-16/Su-27 and 7.5 for F/A-18E/F-14, even with an alpha override. Low-speed override can increase nose authority but costs drag/energy and increases stall risk; at high speed it cannot authorize 17 G turns. Existing stronger peripheral vision, clear center, wear and HOME repairs remain. No blackout, redout or input lockout is restored.

## Sweep and controls

The [Heatblur developer manual](https://f14.manuals.heatblur.se/f14ab/systems/flight_controls_gear/wing_sweep.html) documents 20°–68° airborne travel, a real automatic Mach schedule and manual controls. This game intentionally exposes five manual settings (20°, 32°, 44°, 56°, 68°), with a 12°/second actuator and a gear-down forward-wing interlock. It does not implement CADC auto scheduling or 75° parking oversweep. Low-speed handling favors extended wings; high-speed drag and control response favor swept wings. These tradeoffs are approximate.

A/D (or left/right arrows) now command roll only. W/S rotates pitch about the banked body axis, so banking first and pulling W creates the turn. Both handling modes hold attitude when released; K changes roll response. Aircraft systems, weapons and other bindings remain available. Trackpad wheel gestures over the flight canvas, or pointer drag, provide temporary camera look; idle/release smoothly recenters without pointer lock.

The transcript's ambiguous “take out the respect” phrase was not used to justify deleting unrelated features or assets.
