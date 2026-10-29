# Flight load and pilot effects

Skybreak is an arcade game, not a certified aircraft or human tolerance simulator.

The load instrument now measures signed specific force along the aircraft's pilot-up axis: `dot((vAfter-vBefore)/dt - gravity, up) / 9.81`. Physical velocity includes airspeed, the actual flight direction and stall sink, but excludes the world-travel speed multiplier. The final measurement includes energy-related speed change. It is not a pitch-delta approximation and is not clipped to an acceptable-looking HUD value. Ground support is 1 G; touchdown impulses are separately recorded as `contactLoad`, not treated as sustained aerodynamic exposure. Safe-recovery teleports likewise do not imply physiological acceleration.

In unaccelerated level flight the instrument reads +1; a steady straight climb reads the projection of gravity on the pilot axis; free fall reads zero; an ideal level coordinated 60-degree bank gives +2. Inverted straight flight and pushovers can read negative. Roll angle alone does not establish the load: acceleration matters. The displayed value has a short exponential instrument response.

A flight-control limiter reduces the *actual commanded change of flight path* before translation when it would exceed the game envelope: fighter +9/-3 G, bomber +3.5/-1.5 G; the explicit F/A-18E / Su-37 AoA-assist override raises their bounded command ceiling to +12 G while retaining −3 G, also limiting transverse loading. The player override is unavailable on F-16 and bomber aircraft; legacy F-16 flags are cleared on simulation updates and snapshot loading. The separately rebindable O action retains saved bindings. K mode retains its existing free roll/body-axis steering and does not bypass this envelope. Mass, damage, stall and energy loss still constrain flight. This kinematic model does not resolve aerodynamic angle of attack, structural fatigue, body-seat inclination or impact injury. Brief sink/contact transients can exceed nominal command limits; no assertion that every 40 G impulse is instantly fatal is made.

## Current arcade feedback (supersedes previous physiology tuning)

There are **no blackouts, redouts, blood effects, physiological exposure budgets or G-induced control locks**. All flight, weapon and countermeasure controls remain available at any load and duration. Legacy compatibility fields remain present with `blackedOut: false`, neutral exposure values and no release requirement, including after a snapshot is applied.

High loading produces stronger smoothly changing, neutral tunnel vision capped at 50% peripheral opacity, with a fully transparent central aiming region. It cannot become a central blackout. Reduced-effects mode reduces its opacity further. Signed G telemetry and the actual flight-path envelope remain unchanged.

Sustained excessive loading (above +7.5 G or below −2 G) causes slight airframe wear after five seconds. Wear accrues at just 0.15 HP per second, caps at ten outstanding HP, cannot reduce health below one, and never damages engine/control authority. Ordinary turns and brief pulls cause no wear. Unloading reduces the accumulated strain timer; a subtle AIRFRAME STRAIN message explains that HOME repairs wear. Wear does not trigger combat-hit flashes or impact sounds. Normal home landing/stop repair restores both HP and wear allowance.

These are deliberately forgiving game rules, not medical or structural certification claims. Earlier v1.0.7 blackout behavior and intermediate v1.0.8 duration-tuning experiments are superseded by this simpler user-requested design.

## Sources researched

- [FAA: Acceleration in Aviation](https://www.faa.gov/pilots/safety/pilotsafetybrochures/Acceleration.pdf): pilot-axis sign conventions; positive-G peripheral visual loss, greyout and blackout; negative-G redout; tolerance varies with physiological state. Retained as historical research only; physiological impairment is no longer implemented.
- [USAF: F-16 Fighting Falcon](https://www.183wg.ang.af.mil/RESOURCES/Fact-Sheets/Article/459577/f-16-fighting-falcon/): describes a nine-G aircraft capability and fly-by-wire controls. This motivates the fictional fighter's upper envelope; it is not a claimed aircraft-specific reproduction.
- [NASA Glenn: Acceleration Measurements](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/acceleration-measurements/): distinguishes sustained/quasi-steady accelerations from transient disturbances and explains orbital free fall. This supports treating contact impulses separately from sustained flight exposure.

## Engine balance

Fighter throttle now spans 0–110%. Dry power saturates at 100%; afterburner starts only at 110%, continues while fuel remains, and stops when the lever is reduced. There is no 15-second budget or cooldown. Fighter dry maximum consumption is 3.8 kg/s; burner consumption is 8 kg/s rather than 19 kg/s, about 2.1 times dry maximum. A full 3200 kg tank therefore supports about 6 minutes 40 seconds of continuous burner. These are gameplay values. Bombers remain capped at 100% with no afterburner.

## Missile and radar gameplay balance

Missiles use the same boosted world-travel distance scale as aircraft. Heat/radar missiles accelerate during finite 8.5/10 second motor phases, then coast with speed loss. Turning also spends energy. Their total 13/17 second lifetimes remain finite, and guidance retains a bounded angular correction rate, seeker cone and memory; radar guidance also requires the shooter to keep a supporting lock. Full afterburner in a straight line can no longer reliably outrun an in-envelope missile. Deterministic 30/60/144 Hz tests intercept a max-speed tail target from 0.9–3.5 km, and a coasting crossing-threat fixture can still be defeated by a bounded turn. These are fictional game envelopes, not weapon performance claims.

Radar guidance degrades progressively below 180 game metres of terrain-relative clearance, reaching its strongest clutter effect at 25 metres. Maximum clutter reduces guidance turning to 38% and adds a seeded track-loss opportunity integrated over time. At two seconds of maximum clutter, the game probability is about 73%; surviving tracks remain possible. Solid terrain separately blocks radar sight through seeker memory and stops a missile that crosses the terrain surface. Airport runway protection remains a separate narrow spawn/service rule; ground and low flight elsewhere do not grant immunity.

## v1.1.1 airbrake state correction

The F/A-18E and Su-37 now animate their aircraft-specific braking surfaces from the authoritative `airbrakeDeployment` state. Explicit X deployment works on the ground and remains continuous through takeoff/landing; automatic wheel braking does not extend those surfaces. Airborne drag uses the same smooth deployment amount. Existing drag and thrust coefficients are retained: at 315 m/s, 1,000 m altitude and half fuel, a five-second full-power pass is roughly 56 m/s slower with brakes than without. Full afterburner can still overcome brake drag, so X does not promise deceleration under every power setting. This is arcade balance, not measured aircraft performance.
