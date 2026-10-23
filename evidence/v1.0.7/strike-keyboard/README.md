# Complete native-keyboard Strike & Escape validation

23 October 2026, v1.0.7 (`7043cd2`). Chromium/SwiftShader on localhost, 1024×650. Automated telemetry-guided native keyboard input through normal animation frames; no position writes, injected health/ammo, simulation stepping, disabled enemies or time acceleration.

Final sortie completed in 157.97 simulation seconds with “Clean getaway”, 100 health and two of three bombs remaining. Takeoff occurred normally from the runway. SAM warning at 96.85 seconds, flare at 96.97, explicit “SAM defeated by bomber flares” at 96.98. Target destroyed at 107.77, escape completed at 157.97. Zero browser errors. Screenshots inspected.

An earlier complete sortie also passed at 157.72 seconds; its SAM lost track in sun glare before flares. Two preliminary controller attempts failed near takeoff (early steep bank, then rapid near-stall pitch reversals). Corrected the test pilot to hold a straight climb, build airspeed before banking, and flare immediately on an active SAM warning. No production flight/game changes were needed. The test driver now asserts an actual SAM flare defeat.

Audio remains functionally measured, not perceptually listened to: no listening-capable tool was available. No public certificate bypass, Cloudflare credential or account changes.
