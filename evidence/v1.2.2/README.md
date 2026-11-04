# v1.2.2 control restoration

Compared v1.2.0 commit 939433a against its predecessor 7564f3d. Restored the original human advanced-mode branch in sim.js, the normal-mode bank/turn yaw expression and the advanced attitude coordinated-turn expression. Existing energy, alpha, G, speed, sweep and damage constraints remain. K again switches between normal self-leveling and advanced attitude hold. Saved keybindings are preserved.

The compatibility build and asset query versions are advanced to skybreak122-1104 so old control simulations do not silently mix in friend rooms. No Cloudflare files or settings changed.

Verification commands:

- `npm test`: 347 passing.
- `npm test --prefix server`: 15 passing.
- `JETS_URL=http://127.0.0.1:8203 node tests/restored-controls-browser.cjs`: PASS.
- `JETS_URL=http://127.0.0.1:8203 QA_OUTPUT_DIR=evidence/v1.2.2/regression node tests/tomcat-browser.cjs`: PASS; no page errors.

The focused native browser test uses airborne fixtures then A/D, W/S and K, checking both turn directions, pitch directions, return to level and advanced attitude hold. The broader test covers the hangar, native takeoff, sweep, camera look, real bomb impacts, HOME landing, defence and two-document independent peer equipment. Reports record actual results. Narrow viewport and data-channel fixtures are not physical-device or Internet-WebRTC checks.
