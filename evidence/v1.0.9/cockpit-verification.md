# Bomber cockpit verification

`node tests/bomber-cockpit-browser.cjs` passed in cloud Chromium using SwiftShader, native Tab/Enter menu navigation to Strike, native V view switch and native W/D/ArrowUp control input. No state writes or physics stepping. Confirmed bomber-only display and geometry selection, stick movement, all eight engine-control lever meshes moving together, no page errors and panel inside the narrow viewport.

Screenshots inspected at 1280×800, 640×600 and 390×700. The phone display omits the secondary station and preserves larger primary airspeed/altitude, attitude, fuel/power and stores/airframe readings. Horizon and HUD target marker remain visible. The cockpit is original low-poly art, not a dimensional B-2 replica. See `cockpit-design.md` for public historical references and limitations.

`node --test tests/cockpit-interior.test.js tests/bomber-instruments.test.js`: four cases passed, including retained fighter controls, frame-rate-independent input smoothing, separate bomber group/dual controls and truthful signed-G/fuel/stores readouts.

Fighter regression: `QA_OUTPUT_DIR=/tmp/jets-bomber-cockpit/fighter-regression node tests/cockpit-browser.cjs` also passed native stick/throttle and neutral recovery with no page errors. The fighter panel remains its original two-instrument arrangement.
