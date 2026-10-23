# v1.0.10 verification

Radar uses actual `terrainHeight` samples, with transparent water, low-opacity land/elevation shading, coastline highlights and real runway endpoints. One 160×160 local raster is cached until the player moves 2 km; heading/movement transform the cached image each HUD draw. Its 12.8 km footprint covers the entire 3.52 km radius even at the rebuild boundary. Contacts/ownship draw above it. No network map requests or tracking.

Tests compare terrain/contact transforms across headings and movement, actual coast/valley samples, alpha bounds and cache reuse. Browser checks use explicit geographic fixtures followed by native I/V and normal animation frames; they cover coast, heading/movement, enemy island/bomber cockpit, and actual valley mode/fighter cockpit at390px width. Screenshots inspected; off-circle terrain pixels are explicitly checked transparent. This is not a claim of manual navigation testing. `radar/report.json` and screenshots record the results.

B-2 acquisition/altitude tests cover lock identity, eventual launch, acquisition limits, player climb at30/60/144Hz and complete AI bombing/escape from six airport/frame-rate combinations. Details in `bomber-balance.md`.

Final combined suite:234 game tests and12 backend tests passed. Browser radar test passed with zero page errors. This release does not deploy the public multiplayer backend or claim cross-network validation.
