# Flight load and pilot effects

Skybreak is an arcade game, not a certified aircraft or human tolerance simulator.

The load instrument now measures signed specific force along the aircraft's pilot-up axis: `dot((vAfter-vBefore)/dt - gravity, up) / 9.81`. Physical velocity includes airspeed, the actual flight direction and stall sink, but excludes the world-travel speed multiplier. The final measurement includes energy-related speed change. It is not a pitch-delta approximation and is not clipped to an acceptable-looking HUD value. Ground support is 1 G; touchdown impulses are separately recorded as `contactLoad`, not treated as sustained aerodynamic exposure. Safe-recovery teleports likewise do not imply physiological acceleration.

In unaccelerated level flight the instrument reads +1; a steady straight climb reads the projection of gravity on the pilot axis; free fall reads zero; an ideal level coordinated 60-degree bank gives +2. Inverted straight flight and pushovers can read negative. Roll angle alone does not establish the load: acceleration matters. The displayed value has a short exponential instrument response.

A flight-control limiter reduces the *actual commanded change of flight path* before translation when it would exceed the game envelope: fighter +9/-3 G, bomber +3.5/-1.5 G, also limiting transverse loading. K mode retains free roll/body-axis steering but no longer bypasses this envelope. Mass, damage, stall and energy loss still constrain flight. This kinematic model does not resolve aerodynamic angle of attack, structural fatigue, body-seat inclination or impact injury. Brief sink/contact transients can exceed nominal command limits; no assertion that every 40 G impulse is instantly fatal is made.

Positive exposure accumulates above 4.5 G, with progressively reduced peripheral vision and then blackout. Negative exposure accumulates separately below -0.5 G, producing red tint; sustained severe strain can also blackout. Short pulses accumulate less exposure, unloading allows gradual recovery, and control returns after recovery. Thresholds, rates and durations are deliberately playable design values, not medical predictions. People, equipment, onset rates and histories differ. Smooth effects and the accessibility reduction setting avoid flashes.

## Sources researched

- [FAA: Acceleration in Aviation](https://www.faa.gov/pilots/safety/pilotsafetybrochures/Acceleration.pdf): pilot-axis sign conventions; positive-G peripheral visual loss, greyout and blackout; negative-G redout; tolerance varies with physiological state. This informs direction and progression, not the game's exact timing.
- [USAF: F-16 Fighting Falcon](https://www.183wg.ang.af.mil/RESOURCES/Fact-Sheets/Article/459577/f-16-fighting-falcon/): describes a nine-G aircraft capability and fly-by-wire controls. This motivates the fictional fighter's upper envelope; it is not a claimed aircraft-specific reproduction.
- [NASA Glenn: Acceleration Measurements](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/acceleration-measurements/): distinguishes sustained/quasi-steady accelerations from transient disturbances and explains orbital free fall. This supports treating contact impulses separately from sustained flight exposure.

## Engine balance

Fighter throttle now spans 0–110%. Dry power saturates at 100%; afterburner starts only at 110%, continues while fuel remains, and stops when the lever is reduced. There is no 15-second budget or cooldown. Fighter dry maximum consumption is 3.8 kg/s; burner consumption is 8 kg/s rather than 19 kg/s, about 2.1 times dry maximum. A full 3200 kg tank therefore supports about 6 minutes 40 seconds of continuous burner. These are gameplay values. Bombers remain capped at 100% with no afterburner.
