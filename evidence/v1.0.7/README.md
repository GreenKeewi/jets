# v1.0.7 cloud verification

Clean separate checkout of GreenKeewi/jets main at 77c03f1; no unrelated repository operated on. Release build: skybreak7-1023.

- Full Node game suite: 200 passed, zero failed. Includes signed load and actual envelope at 30/60/144 Hz, brief/sustained physiology, 110% afterburner threshold, 120 seconds continuous burner and fuel cost, controls persistence/conflicts, runway/service behavior, long strike trajectories and guaranteed bomber-flare SAM defeat.
- Backend: 12 tests passed; final Cloudflare dry-run build and six-client local workerd smoke passed. These are local tests, not a public deployment.
- Native keyboard browser: afterburner active for over 17 simulation seconds without stepping; gear/airbrake in normal and advanced mode; key remap/conflict/reload/reset; cockpit stick/throttle response and neutral recovery. See JSON evidence and repeatable tests/release-browser.cjs, keybindings-browser.cjs, cockpit-browser.cjs.
- Screenshots inspected at 1280x800 and 640x600. Corrected hidden settings feedback, lap/boots composition and reversed stick animation.
- Audio: actual browser OfflineAudioContext PCM and running AudioContext/analyser; no human listening test. See audio-backend.md and audio.json.

Limits: browser gameplay uses explicit initial airborne fixtures for isolated flight assertions; a complete manually flown long strike sortie was not performed. Full bombing/escape trajectories were covered by deterministic simulation. Cross-network friend rooms, mobile latency and production dedicated multiplayer remain unverified. Public dedicated deployment was not attempted: Cloudflare authentication and approved account/free-plan configuration are missing. No credentials/accounts were created and no analytics were installed.

Reference research and model simplifications: ../../flight-model.md, ../../cockpit-design.md, ../../strike-mission.md.
