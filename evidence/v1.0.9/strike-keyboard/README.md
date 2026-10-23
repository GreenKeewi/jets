# Complete native-keyboard Strike & Escape

Final v1.0.9 map/cockpit build, local Chromium WebGL. `COCKPIT=1 QA_OUTPUT_DIR=evidence/v1.0.9/strike-keyboard node tests/strike-realtime.cjs` passed.

The automated pilot reads telemetry and sends native keyboard events through the normal animation loop. Native Tab/Enter launch and V select cockpit; no position writes, simulation stepping, time acceleration, disabled enemies, or injected health/ammunition. This is automated gameplay, not a human pilot assessment.

Observed runway takeoff, enemy-island approach, SAM warning, flare deployment and explicit “SAM defeated by bomber flares” at approximately 113 seconds. Bombing completed at 123.12 seconds; successful escape at 189.75 simulation seconds (229.96 wall seconds). End state: “Clean getaway”, full 100 HP, three flares remaining, no bombs remaining. Zero browser page errors. Screenshots of SAM defeat, target destruction and completion were inspected.

`report.json` records full event snapshots and periodic flight telemetry. The target was reachable with the new island separation and the final cockpit controls. This does not verify every mission variant, human audio perception or cross-network multiplayer.
