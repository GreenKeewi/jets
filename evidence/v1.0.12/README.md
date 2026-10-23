# v1.0.12 tactical map verification

Scope: M tactical map, N sound, saved-binding migration, airport ownership/service labels and concise HOME direction/HUD feedback. No physics, team assignment, repair or restock rules changed.

The map samples the actual terrain heightfield into one cached 320×320 world raster, reused across opening, movement and heading changes. North-up world projection matches the game's +Z north/-X screen-right convention. Airport ownership follows airportForTeam including valley/team swaps; HOME uses the local pilot's actual homeBaseId. Free-flight remote airports are friendly but explicitly unsupported for landing/restock. Enemy contacts are limited to radar-range or selected target; teammates are shown. Shapes, letters, labels and a readable text legend avoid colour-only identification.

257 game tests and 15 backend tests passed. Focused cases verify all team-relative airport assignments, viewport projection, known-contact filtering, objectives, actual HOME-only restock/repair and saved binding migration/conflicts/reset. Browser tests use native M/Escape/N/Tab and actual rebinding UI, rendered desktop and 390 px narrow layouts, coast/valley/freeflight ownership fixtures and no-service HUD feedback. They do not claim a complete flown sortie. Screenshots are inspected and final report is in map/.

Flight continues while the modal is open; local controls are neutral and keyboard focus stays inside. Map text explains this. Mapped close key and Escape restore the flight focus. Terrain is locally rendered with no external map requests, tracking, infrastructure or credentials.

Existing limitations remain: public dedicated backend is unconfigured, cross-network peer play unverified, and audio not human-listened. Public browser certificate restrictions are not bypassed; Pages deployment and downloaded artifacts are checked separately.
