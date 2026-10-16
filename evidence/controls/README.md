# Jets controls release verification — 2026-10-16 UTC

This folder contains local cloud Chromium results against this release source, not public-origin browser validation. The preceding release was `dc24281f78877f4354eb3480a995d7304bc2859f`; baseline reports demonstrate the inverted turn/bank, dismissible results, and late-guest replay capacity defects.

- `unit-final.txt`: 56 deterministic tests pass, including all roles/squad sizes for the preserved strike gate, gun swept collision/terrain/friendly exclusion, bounded six-stream snapshots and protocol validation.
- `keyboard-render.json`: 16 native-key cases across four cardinal headings and chase/cockpit. Checks actual renderer forward/wingtip projections, cockpit camera orthogonality and instrument pixels, Up/Down power, W/S pitch, Q/E once per press, gun tracers and result navigation. Pose/target fixtures are declared; normal animation runs without stepping.
- `gun-damage.json`: native held Space hits/kills a straight-ahead hostile, spends gun ammunition only, and opens the actual combat result. Physical key release does not activate Fly again; three Escape presses retain the dialog; a deliberate new Space replays with replenished ammunition; keyboard pause/menu works.
- `multiplayer-app.json`: three actual rendered documents use native guest keys and normal animation. Both Restart and Fly again normalize a 1v1 configuration after two late guests into 2v2 and seat all three humans. Guest gun, A/D, Up/Down, and press-only Q/E replicate through host authority. **Transport uses the deterministic RTC fixture**, not native WebRTC.
- `baseline-replay-capacity.json`: the preceding commit left the second late guest unseated in both replay paths.
- `strike-realtime.json`: native keyboard, original seed, no position writes or stepping. Defender elimination alone leaves strike active; bomb impact and escape complete it at simulation time about 46.55 seconds.
- `cockpit-small.json`: at 683×384 the weapon and instrument panels do not overlap horizontally; pause/resume restores gun focus. Screenshots show actual local gameplay, not illustrations.

The executor browser is managed with `WebRtcIPHandling: disable_non_proxied_udp`. Native offer creation returns `NoLocalCandidatesError`. No policy or proxy changes were made. Direct `https://greenkeewi.github.io/jets/` loads fail with `net::ERR_TUNNEL_CONNECTION_FAILED`; curl reports CONNECT HTTP 403. GitHub Pages deployment verification is separate. No physical Chromebook, separate-device LAN or Wi-Fi compatibility is claimed.

To reproduce with Node, Playwright and Chromium installed:

```sh
python3 -m http.server 8201 --bind 127.0.0.1
JETS_URL=http://127.0.0.1:8201/ QA_OUTPUT_DIR=/tmp/jets-controls node tests/browser-controls.cjs
JETS_URL=http://127.0.0.1:8201/ QA_OUTPUT_DIR=/tmp/jets-controls node tests/gun-browser.cjs
JETS_URL=http://127.0.0.1:8201/ QA_OUTPUT_DIR=/tmp/jets-controls node tests/multiplayer-controls.cjs
```

The multiplayer script records native offer availability, then explicitly substitutes the fixture for application/protocol checks. Never treat that fixture result as native connectivity evidence. JETS3 requires both players to reload and exchange fresh pairing codes.
