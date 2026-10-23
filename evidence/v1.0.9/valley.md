# Winding mountain corridor

Original terrain inspired by cinematic low-flight sequences, not a reproduction of a film or simulator location. The old shallow 7.2 km corridor is now approximately 22.8 km of connected bends, with a 1.2 km flat floor and 900–1060 m shoulders. It occupies the northern region at z≈17 km, preserving the open-water separation between the home field and relocated Northpoint. Terrain rendering and collision use the same height function.

The sampled centerline has eight direction changes. Its tightest sampled curvature radius exceeds 900 m; following it at 240 m/s physical speed and the existing 1.5× world travel is within the game's 9 G fighter envelope. The floor is intentionally generous enough for learning; cutting straight across successive bends reaches the rising shoulders.

AI now follows intermediate bends rather than aiming through intervening mountains. At a corridor end it climbs before reversing. Terrain avoidance previously repeatedly increased throttle, producing >500 m/s approaches to tight bends; valley AI now reduces throttle above 245 m/s through ordinary controls. There is no position snapping, HUD alteration or artificial speed clamp.

Eight valley tests cover length/bends, centerline/side clearance, ridge height, curvature, shared collision geometry, untouched airport water channel, and five 20-second AI entries including the end reversal. All five survived; measured minimum clearances are in `valley-ai.txt`. These are deterministic regression scenarios, not exhaustive combat survival guarantees. World/airport/squad regression tests are also run by the release coordinator.

`valley-low-pass.png` is an inspected actual Chromium gameplay screenshot after an explicit low-pass initial fixture, then native animation frames. It shows the corridor and cockpit instrument legibility; it is not a complete hand-flown valley traversal.
