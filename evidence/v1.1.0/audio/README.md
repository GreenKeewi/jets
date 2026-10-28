# Procedural audio and cockpit warning verification

`render-result.json` records Chromium's actual `OfflineAudioContext` output at
48 kHz, stereo, two seconds per mix. `render.html` is the standalone browser
harness. Serve the repository root and open
`/evidence/v1.1.0/audio/render.html`; its result appears in the page as JSON.
No external assets or JavaScript dependencies are required.

All eight mixes passed: dry engine, cockpit, afterburner, mute, volume zero,
20% volume, dead aircraft, and combined combat/missile events. Samples were
finite, peaks stayed below 1, mute/zero/death were silent, cockpit was quieter
than chase, afterburner was stronger than dry power, volume reduced output,
and all 12 scheduled combat transients ended. Representative peaks: dry .582,
cockpit .260, afterburner .670, combined events .535. Noise is synthesized
randomly, so repeated renders will differ slightly.

This verifies rendered PCM and graph cleanup. It is **not a human listening
test**, a subjective realism rating, or a speech output recording. The updated
mix uses original broadband exhaust, low combustion noise, quiet turbine
harmonics, nozzle hiss and short combat attacks. No audio was downloaded.

`warning-tests.txt` contains nine deterministic cases covering a level-flight
ridge collision, actual authored terrain, arcade world velocity, vertical sink,
bounded work, safe versus unsafe runway descent, priority/preemption, sustained
G/bank conditions, aircraft limits, repeat limits, gesture activation, absent
speech support, volume/mute, and cancellation on pause/menu/ground/death/cleanup.
Speech is replaced with a deterministic fake, including overlapping-voice checks.
`focused-tests.txt` records the four related test files passing together.

Re-run from the repository root:

```sh
node tests/flight-warnings.test.js
node --test tests/audio-mixing.test.js tests/threat-audio.test.js tests/flight-speed-cues.test.js tests/flight-warnings.test.js
python3 -m http.server 8033 --bind 127.0.0.1
```

Open `http://127.0.0.1:8033/evidence/v1.1.0/audio/render.html` after starting the
server. Browser voices and voice availability depend on the operating system.
The terrain prediction and cockpit thresholds are gameplay approximations, not
certified flight warning logic. Prediction uses the simulation's surface height
and current world velocity over at most six seconds; it does not predict a
pilot's future turn or pull-up.
