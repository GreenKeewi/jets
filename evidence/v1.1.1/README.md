# v1.1.1 model and aircraft-system fixes

Reviewed 29 October 2026 against the published v1.1.0 baseline commit `6305b36551e985ebc07d7f90e561e5cd6def87d1`. The game remains a static ES-module app with no production build step.

## Causes and corrections

The tank builder scaled a temporary sphere mesh, then passed only its original geometry to InstancedMesh. Static batching intentionally skips single-mesh batches, so the scale was lost. The tank buffer now directly contains a 1.4 × 1.4 × 6.8 elongated ellipsoid; per-station instance matrices retain that shape. Regression coverage checks every tank combination on F-16 and F/A-18E, as well as menu/detail/LOD use.

The new jets inherited the F-16's aft split brake panels, which were buried in their wider bodies. Su-37 now has a visible dorsal board. F/A-18E uses readable distributed spoiler/rudder/flap/aileron braking cues. Both use the authoritative `airbrakeDeployment` amount for visuals and drag, including ground/air transitions. Automatic wheel braking does not extend those surfaces. Existing drag and thrust coefficients remain unchanged because a five-second full-afterburner comparison already produced roughly 56 m/s less speed with brakes; continued acceleration at high power was not absent braking.

The Su-37 body now has a longer, pointed forebody, forward lower canopy, coherent white radome, flattened blended center, separated nacelles, smaller canards, swept twin fins and tail stinger. Near and distant models share those layout definitions. The final top-view capture framing is identical for both releases and includes the entire nose.

A shared capability table now enables the rebindable O override only for F/A-18E and Su-37. F-16, bomber, missing and unknown aircraft IDs cannot gain it. Legacy F-16 flags are cleared during simulation updates and snapshot loading. K advanced mode keeps its default control equations. The `aoaLimiter` saved-binding ID is retained, so custom keys survive; only its label and supported aircraft change. This remains a bounded arcade assist, not a physically resolved angle-of-attack model.

## Verification

- `npm test`: all 49 test files pass. See [simulation log](simulation-tests.txt).
- `cd server && npm test`: all 15 protocol/real-loopback-WebSocket tests pass. See [server log](server-tests.txt). Executor Node is 20.19.2; the server declares >=22, so this is not a Node22 deployment result.
- Five model regressions cover Su-37 near/distant proportions and canopy, tank geometry/instances across tank combinations, brake types and exact shared deployment, retraction and bounded/fallback state. See [model log](model-tests.txt).
- [Matched WebGL/model and native-key report](browser/report.json) and [full sortie/co-op browser report](sortie-browser/report.json) record rendered checks. The former includes baseline/current top, side and rear views, actual X/O/K handling, legacy F-16 state clearing and a saved KeyU binding reload. The latter preserves loadout/cockpit/repair/co-op regression coverage with both documents on the current compatibility build.
- Independent code and screenshot review checked capability gates, snapshots, saved bindings, LOD brake visibility, tank aspect ratio and the final Su-37 silhouette. The first visual review caught an intersecting radome material band; the nose now joins at one shared hull station. All changed JavaScript passes syntax checks and `git diff --check`.

Screenshots render the game's original geometry; they contain no private user data. Reference photographs were inspected but not copied into the game or release evidence. Geometry, fixed braking deflections and flight coefficients are simplified game design rather than manufacturer-certified reproductions. The existing common fighter collision sphere remains an arcade approximation. No new performance benchmark, physical-device multiplayer test or human audio/speech test is claimed.

## Visual references

- [San Diego Air & Space Museum archive: Charles Daniels' 1996 Su-37 prototype711 photograph](https://www.flickr.com/photos/sdasmarchives/14260362128/): recognizable prototype layout, forward canopy, nacelles and tail configuration.
- [MAKS Su-37 retrospective](https://t.me/s/aviasalonmaks/3010): prototype/canard/thrust-vectoring context; this is not the forward-swept S-37/Su-47.
- [Tommy H. Thomason's November2021 speed-brake article](https://thanlont.blogspot.com/2021/11/a-brief-history-of-usnavy-jet-speed.html): annotated Norman A. Graf photograph of Super Hornet braking surfaces. The photo supplies visual cues; fixed game angles are not a real FCS schedule.
- [NAVAIR F/A-18E/F product page](https://www.navair.navy.mil/product/FA-18EF-Super-Hornet): the E remains explicitly the single-seat Super Hornet variant.

## Reproduce

```sh
npm test
(cd server && npm test)
mkdir -p /tmp/jets-v110
git archive 6305b36551e985ebc07d7f90e561e5cd6def87d1 | tar -x -C /tmp/jets-v110
# Serve the baseline and current checkout in separate terminals:
python3 -m http.server 8212 --bind 127.0.0.1 --directory /tmp/jets-v110
python3 -m http.server 8211 --bind 127.0.0.1
# Separate terminal, with Playwright and Chromium available:
node tests/model-fixes-browser.cjs
JETS_URL=http://127.0.0.1:8211/ node tests/sortie-upgrade-browser.cjs
```

`JETS_BASELINE_URL`, `JETS_URL` and `QA_OUTPUT_DIR` override browser origins and output paths. JETS10 requires fresh room invites and both clients to reload.
