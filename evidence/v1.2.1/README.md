# v1.2.1 verification

The F-14 had floating rudder geometry, generic wingtip rails, oversized canopy proportions and an incorrect swept-span silhouette. Its replacement details now share the appropriate wing/tail assemblies. The hangar previously hid station dropdowns and kept departure fuel outside customization; native station/store buttons, presets and fuel cards now use the existing saved and synchronized equipment state.

- `npm test`: 347 passing, including four new Tomcat geometry, sweep/LOD, roll-spoiler and station mapping checks.
- `npm test --prefix server`: 15 passing.
- `node tests/hangar-browser.cjs`: local Chromium WebGL, desktop and 390px layouts, native compatible store selection, fuel selection, keyboard Space activation, presets, forced Strike racks and airborne sweep; no page errors. Explicit airborne fixture is used for the model views.
- `JETS_URL=http://127.0.0.1:8202 QA_OUTPUT_DIR=evidence/v1.2.1/peer-browser node tests/tomcat-browser.cjs`: PASS: native takeoff, A/D roll, W pitch, sweep, camera return, three real ballistic bomb impacts, HOME landing success, defence victory and independent synchronized F-14/Su-27 equipment. See its report for the method. The camera-return check waits for the state rather than a fixed delay to accommodate software rendering.

[Desktop editor](browser/visual-editor-desktop.png) · [Narrow editor](browser/visual-editor-narrow.png) · [Wings forward](browser/tomcat-extended.png) · [Wings swept](browser/tomcat-swept.png) · [Front view](browser/tomcat-front.png)

Browser reports are saved alongside the screenshots. Narrow viewport coverage is browser emulation, not a physical touchscreen test. The two-document multiplayer test uses a deterministic data-channel fixture rather than an Internet WebRTC connection. No Cloudflare changes. The model remains deliberately simplified, not an engineering-grade reproduction.
