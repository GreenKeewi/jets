# Guest gun cadence under jitter — 2026-10-16

This release fixes the guest gun cadence regression in preceding published commit `5f14d863f866e6ae3ecd9bba7d5a131012fd53d3`. The saved checkpoint was resumed and revalidated before publication.

`baseline.json` reproduces the formerly source-derived P2 in the actual createNetwork sender/host pipeline plus 60Hz host simulation, using the deterministic RTC transport fixture and fake arrival clock. At sends 0/100/200/300ms with 20/19/20/19ms delay, previous dual cooldowns yield host4 / guest2 shots. `fixed.json` yields host4 / guest4 with the held-gun path. This is a demonstrated deterministic integration failure and repair, not a native WebRTC or Wi-Fi observation.

The fix moves the gun out of reliable action pulses into realtime held input, with a 250ms host freshness timeout. The simulation still owns 10-round/s cadence, ammo, bullets, damage and outcomes. A release clears firing on arrival; expiry/reordering/generation checks prevent stale firing. Reliable action traffic cannot refresh gun freshness. Q/E remain pulse-only. Pairing changes to JETS4; both players must reload and exchange fresh codes. Older JETS2/JETS3 codes fail clearly.

`unit-final.txt`: 59/59 tests pass, including the new actual-pipeline jitter, release/loss/expiry and reordered-release regressions. Existing strike bombing/escape and controls/gun simulation suites pass.

`multiplayer-app.json`: three actual rendered game documents, native keys, normal animation, deterministic RTC transport fixture. Both 1v1 + two late guests replay paths normalize to 2v2; guest gun/power/turn input reaches host and returns in snapshots; holding/repeating Q/E still spends one missile per press. JavaScript errors: none. Native offer remains blocked with NoLocalCandidatesError under the managed browser policy. No policy/proxy changes were used.

The resumed verification reran all 59 tests, the deterministic pipeline rate reproduction and the rendered multiplayer application checks. Runtime fingerprints are in `source-hashes.json`. Exact GitHub Pages build/deploy success is recorded separately after pushing; local browser evidence does not establish public-origin availability. `public-curl.txt` records the persistent CONNECT HTTP403 proxy restriction.

No hub, taxi or firetruck files are part of this change. Native WebRTC and physical-device Wi-Fi behavior remain unverified; no browser policy or proxy bypass was used.
