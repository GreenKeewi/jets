# v1.2.0 verification · 2026-11-04

Work is confined to GreenKeewi/jets. No Cloudflare configuration, endpoint, credentials, paid service or unrelated repository was changed. Existing friend-room peer-to-peer play remains the active path.

- Game tests: **343 passing**, including new models, sweep geometry and physics, hard speed caps, low-speed AoA envelope versus structural G, pure roll/pitch, camera recentering, four bombs/two racks, three physical impacts, friendly-landing completion, HOME bomb replenishment, interception win/loss, and per-pilot equipment isolation/respawn preservation.
- Continuous simulation sorties: each of F-16C, F/A-18E, Su-27 and F-14B takes off, drops at least three bombs that physically hit the target, and lands at HOME successfully without position writes. Unopposed airborne attackers can actually destroy the defending airfield. These are deterministic simulation checks, not a human playtest.
- Node server tests: **15 passing**; local source compatibility is retained, but no backend was deployed or configured.
- `node tests/tomcat-browser.cjs`: actual local Chromium WebGL, native hangar controls, narrow layout, keyboard takeoff, roll/pitch, five-step sweep, wheel camera look/recenter and native B bomb releases with ballistic impacts. Explicit approach and landing fixtures verify the offensive mission's objective/result UI; defensive fixtures verify airborne enemies, runway player and victory. A pair of actual rendered application documents uses the deterministic RTC fixture to verify different jets/loadouts, synchronized authoritative snapshots and locked equipment. This is not physical-device or cross-network WebRTC evidence.
- Node syntax checks on application/server JavaScript and `git diff --check`: passed. The static application has no separate build/lint script.

[Structured browser report](browser/report.json) · [Su-27 hangar](browser/su27-hangar.png) · [F-14 hangar](browser/f14-hangar.png) · [Narrow hangar](browser/hangar-narrow.png) · [Wings forward](browser/f14-wings-out.png) · [Wings swept](browser/f14-wings-aft.png) · [Return objective](browser/strike-return-objective.png) · [Friendly-landing success](browser/strike-success.png).

See [aircraft-reference.md](../../aircraft-reference.md) for primary/public references, all speed units and approximations, original model/skin implementation and the limits of the alpha/sweep model. Prior tests that required Su-37 canards/vectoring, automatic bank-to-yaw, one-hit bomber strikes or airborne escape circles were replaced with checks for the requested behavior. Prior release evidence remains historical.

New controls: **[ / ]** sweep wings forward/aft (also HUD buttons). **A/D** roll without turning; **W/S** pitch through the bank. **O** alpha override on F/A-18E/Su-27. **B** releases bombs. Trackpad scroll or drag the flight canvas looks around, then recenters. **J** rear view and **T** tank jettison remain.

Physical mobile, cross-network multiplayer, subjective audio and exact real-aircraft fidelity are not established. Friend-room compatibility is **JETS12 / skybreak120-1104**: reload clients and create fresh invites. Per-player equipment is chosen before launch; it cannot be swapped during an active sortie. No backend setup was performed.
