# v1.1.0 verification

Verified locally on 28 October 2026. This repository is a static ES-module browser game; there is no production build step. All changed JavaScript passed syntax checks and `git diff --check` passed.

## Automated checks

- `npm test`: all 48 simulation/model/controller/network test files pass. See `simulation-tests.txt`.
- `cd server && npm test`: all 15 protocol and real loopback WebSocket checks pass. The installed executor uses Node 20.19.2; the server declares Node >=22, so this does not establish a Node 22 deployment result.
- `tests/sortie-upgrade-browser.cjs`: Chromium WebGL passed with no page errors. Uses native selectors/keys for aircraft, tank choices, O/K controls, rebinding, volume/voice controls, and co-op lobby. See [browser report](browser/report.json) and screenshots.
- Independent review covered station normalization, fuel/respawn state, snapshot/input validation, late joins and compatibility. Fixed co-op late joins with reinforcements off, solo settings collapsing on changes, and audio reactivation after page navigation; new regressions cover the latter two state paths where applicable.

## What the checks establish

F-16 total missile count cannot exceed six; three tanks produce 160% internal fuel capacity and add 20% internal fuel each. Internal starting fuel and full external tanks are accounted together. Incompatible wingtip radar stores and malformed remote layouts are rejected. Empty stations stay empty on restock. Su-37 has no external tank option.

HOME passes repair up to 18 points once per distinct entry, including when weapons are already full. Staying in the volume, re-entering during cooldown, visiting a hostile airport, or being dead cannot generate repeated repair. Passes do not refill fuel. Respawns restore selected stores/fuel and reset the AoA override.

Maximum-afterburner straight tail chases are intercepted in tested envelopes at 30/60/144 Hz. Motor cutoff/coast drag/lifetime remain finite; a separate crossing-break fixture escapes while its straight-flight control is hit. Seeded samples show weaker chaff and stronger low-clearance radar interference without blanket immunity; authored terrain blocks line of sight. These are game abstractions rather than real-world weapon-performance claims.

Model tests check one F-16 engine versus two on the F/A-18E and Su-37, distinct silhouettes, compatible visible stores, outward hull normals and right-hand F-16 cockpit controls. Rendered screenshots were inspected; the center cursor remains visible. Target details and transient messages occupy the lower HUD. O toggles the F-16-only bounded override without toggling K advanced mode; tunnel vision never disables inputs or fully blacks out the image.

Two actual rendered documents share a 2-friendly / 4-enemy configuration and selected loadout. The test uses the project's deterministic RTC data-channel fixture, with explicit crash positions and accelerated time to verify 30-second AI return. This is not a physical-device Wi-Fi, public PeerJS, or real NAT traversal test. Host-owned settings, locking, late joins, no-respawn co-op boundaries and guest validation are also covered by deterministic network/controller tests.

## Audio and limits

[Audio evidence](audio/README.md) includes eight actual OfflineAudioContext mixes and nine deterministic warning scenarios. Samples are finite, below clipping, silent when muted and clean up scheduled voices. Terrain prediction uses shared terrain and current world trajectory, suppresses safe ground/taxi/landing cases, and prioritizes warnings without overlapping speech.

No human listening test or operating-system speech recording was performed. Voice quality and availability depend on the browser/OS. No sustained performance benchmark, physical-controller test or public multiplayer playtest is claimed. The new aircraft remain original simplified game models; Su-37 is explicitly a prototype. [Aircraft references and gameplay assumptions](../aircraft-loadouts-reference.md).

## Reproduce

Serve the repository at loopback port 8201, ensure Playwright and Chromium are available, then run:

```sh
npm test
(cd server && npm ci --ignore-scripts && npm test)
python3 -m http.server 8201 --bind 127.0.0.1
# Separate terminal:
node tests/sortie-upgrade-browser.cjs
```

Set `JETS_URL` or `QA_OUTPUT_DIR` to override the browser origin/evidence folder.
